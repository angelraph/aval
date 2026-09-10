// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {AvalInstrument} from "./AvalInstrument.sol";
import {IAvalPayoutReceiver} from "./IAvalPayoutReceiver.sol";

/// @title AvalCollateralVault
/// @notice A small lending pool that lets the beneficiary of a funded Aval instrument borrow
/// against it before it is honored, instead of waiting out the full presentment window. This is
/// receivables financing: the confirmed, escrowed instrument is the collateral. The loan is repaid
/// automatically, straight out of the instrument's payout, the instant Attestcoin proves the
/// document presentation on the source chain. There is no separate repayment step.
///
/// @dev This is a demo money market, not a production one. Lenders share one pool and are owed
/// back exactly the principal they deposited; interest collected on repaid loans accrues to the
/// protocol treasury rather than being distributed pro-rata to lenders (a production version
/// would use share-based accounting, e.g. ERC-4626, for that). If the underlying instrument
/// expires without ever being honored, the loan's principal is not recoverable here: that risk
/// sits with the pool, and a production version would price it into the rate or require
/// additional collateral.
contract AvalCollateralVault is Ownable, ReentrancyGuard, IAvalPayoutReceiver {
    enum LoanStatus {
        None,
        Active,
        Repaid,
        Defaulted
    }

    struct Loan {
        address borrower;
        uint256 principal;
        uint256 repaymentDue;
        LoanStatus status;
    }

    uint256 public constant LOAN_TO_VALUE_BPS = 8000; // borrow up to 80% of the instrument amount
    uint256 public constant ORIGINATION_FEE_BPS = 500; // 5% flat fee, paid on repayment
    uint256 public constant BPS_DENOMINATOR = 10000;

    AvalInstrument public immutable instrument;

    mapping(address => uint256) public lenderPrincipal;
    uint256 public totalLenderPrincipal;
    uint256 public protocolFees;

    mapping(uint256 => Loan) public loans; // keyed by instrument id

    event Deposited(address indexed lender, uint256 amount);
    event Withdrawn(address indexed lender, uint256 amount);
    event LoanOriginated(uint256 indexed instrumentId, address indexed borrower, uint256 principal, uint256 repaymentDue);
    event LoanRepaid(uint256 indexed instrumentId, uint256 amountToBorrower, uint256 feeCollected);
    event LoanDefaulted(uint256 indexed instrumentId);
    event ProtocolFeesWithdrawn(address indexed to, uint256 amount);

    constructor(address instrumentAddress) Ownable(msg.sender) {
        require(instrumentAddress != address(0), "Instrument address cannot be the zero address");
        instrument = AvalInstrument(instrumentAddress);
    }

    /// @notice Idle liquidity currently available for new loans or lender withdrawals.
    function availableLiquidity() public view returns (uint256) {
        return address(this).balance - protocolFees;
    }

    function deposit() external payable {
        require(msg.value > 0, "Deposit must be greater than 0");
        lenderPrincipal[msg.sender] += msg.value;
        totalLenderPrincipal += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(lenderPrincipal[msg.sender] >= amount, "Amount exceeds your deposited principal");
        require(availableLiquidity() >= amount, "Not enough idle liquidity right now, some is out on loan");

        lenderPrincipal[msg.sender] -= amount;
        totalLenderPrincipal -= amount;

        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Withdraw transfer failed");
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Borrow against a funded instrument. Call AvalInstrument.setPayoutRedirect(id,
    /// address(this)) first, from the same beneficiary account, so this vault is the one that
    /// receives the payout when the instrument is honored.
    function borrowAgainstInstrument(uint256 instrumentId) external nonReentrant {
        require(loans[instrumentId].status == LoanStatus.None, "A loan already exists for this instrument");

        AvalInstrument.Instrument memory inst = instrument.getInstrument(instrumentId);
        require(inst.status == AvalInstrument.Status.Funded, "Instrument is not funded");
        require(inst.beneficiary == msg.sender, "Only the instrument's beneficiary can borrow against it");
        require(inst.payoutRedirect == address(this), "Redirect the instrument's payout to this vault first");

        uint256 principal = (inst.amount * LOAN_TO_VALUE_BPS) / BPS_DENOMINATOR;
        uint256 fee = (principal * ORIGINATION_FEE_BPS) / BPS_DENOMINATOR;
        uint256 repaymentDue = principal + fee;

        require(availableLiquidity() >= principal, "Not enough pool liquidity for this loan");

        loans[instrumentId] =
            Loan({borrower: msg.sender, principal: principal, repaymentDue: repaymentDue, status: LoanStatus.Active});

        (bool sent, ) = msg.sender.call{value: principal}("");
        require(sent, "Loan disbursement failed");

        emit LoanOriginated(instrumentId, msg.sender, principal, repaymentDue);
    }

    /// @notice Called by AvalInstrument itself when a pledged instrument is honored. Takes the
    /// loan repayment out of the proceeds first, then forwards whatever is left to the borrower.
    function onInstrumentHonored(uint256 instrumentId) external payable override {
        require(msg.sender == address(instrument), "Only the instrument contract can call this");

        Loan storage loan = loans[instrumentId];
        require(loan.status == LoanStatus.Active, "No active loan for this instrument");

        uint256 received = msg.value;
        uint256 due = loan.repaymentDue;
        uint256 fee = due - loan.principal;
        uint256 toBorrower = received > due ? received - due : 0;

        loan.status = LoanStatus.Repaid;
        protocolFees += fee;

        emit LoanRepaid(instrumentId, toBorrower, fee);

        if (toBorrower > 0) {
            (bool sent, ) = loan.borrower.call{value: toBorrower}("");
            require(sent, "Remainder transfer to borrower failed");
        }
    }

    /// @notice Marks a loan defaulted once its instrument expired without ever being honored.
    /// This is a record-keeping call only; the pool absorbs the loss (see contract notes).
    function markLoanDefaulted(uint256 instrumentId) external {
        Loan storage loan = loans[instrumentId];
        require(loan.status == LoanStatus.Active, "No active loan for this instrument");

        AvalInstrument.Instrument memory inst = instrument.getInstrument(instrumentId);
        require(inst.status == AvalInstrument.Status.Expired, "Instrument has not expired");

        loan.status = LoanStatus.Defaulted;
        emit LoanDefaulted(instrumentId);
    }

    function withdrawProtocolFees(address to, uint256 amount) external onlyOwner nonReentrant {
        require(amount <= protocolFees, "Amount exceeds accrued fees");
        protocolFees -= amount;
        (bool sent, ) = to.call{value: amount}("");
        require(sent, "Fee withdrawal failed");
        emit ProtocolFeesWithdrawn(to, amount);
    }

    function getLoan(uint256 instrumentId) external view returns (Loan memory) {
        return loans[instrumentId];
    }
}
