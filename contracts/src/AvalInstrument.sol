// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ASCBase} from "@gluwa/asc-contracts/contracts/readability/ASCBase.sol";
import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";

import {IAvalPayoutReceiver} from "./IAvalPayoutReceiver.sol";

/// @title AvalInstrument
/// @notice A documentary credit escrow on Creditcoin. A drawer issues an instrument naming a
/// drawee, a beneficiary and a required document hash. The drawee funds it, in native CTC or an
/// ERC20 (a stablecoin, in practice). The instrument is honored, and escrow released, the moment
/// the Attestcoin Protocol proves that a matching DocumentPresented event happened on the
/// registered source-chain AvalPresentment contract. No bank, no custodial oracle and no bridge
/// operator ever touches the funds or the decision.
contract AvalInstrument is Ownable, ReentrancyGuard, ASCBase {
    using SafeERC20 for IERC20;
    enum Status {
        Issued,
        Funded,
        Honored,
        Expired
    }

    enum AvalAction {
        Presented // 0
    }

    error InvalidAction(uint8 action);

    // keccak256("DocumentPresented(uint256,bytes32,address)")
    bytes32 public constant PRESENTED_EVENT_SIGNATURE = keccak256("DocumentPresented(uint256,bytes32,address)");

    struct Instrument {
        address drawer;
        address drawee;
        address beneficiary;
        address token; // the zero address means native CTC, otherwise an ERC20
        uint256 amount;
        bytes32 requiredDocumentHash;
        uint256 expiryBlock;
        Status status;
        address payoutRedirect;
    }

    mapping(uint256 => Instrument) public instruments;
    uint256 public nextInstrumentId = 1;

    /// @notice The one source-chain AvalPresentment contract whose events are trusted. Without
    /// this check, anyone could deploy their own contract, emit a DocumentPresented event with an
    /// arbitrary instrument id and hash, and prove it to fraudulently honor an instrument.
    address public sourcePresentmentContract;

    event InstrumentIssued(
        uint256 indexed id,
        address indexed drawer,
        address indexed drawee,
        address beneficiary,
        address token,
        uint256 amount,
        bytes32 requiredDocumentHash,
        uint256 expiryBlock
    );
    event InstrumentFunded(uint256 indexed id, uint256 amount);
    event InstrumentHonored(uint256 indexed id, address indexed paidTo, uint256 amount, bytes32 documentHash);
    event InstrumentExpired(uint256 indexed id, address indexed refundedTo, uint256 amount);
    event PayoutRedirected(uint256 indexed id, address indexed redirect);
    event SourcePresentmentContractRegistered(address indexed sourceContract);

    constructor() Ownable(msg.sender) {}

    /// @notice One-time setup by the deployer, pointing this contract at the trusted source-chain
    /// AvalPresentment contract.
    function registerSourcePresentmentContract(address _sourceContract) external onlyOwner {
        require(_sourceContract != address(0), "Source contract cannot be the zero address");
        sourcePresentmentContract = _sourceContract;
        emit SourcePresentmentContractRegistered(_sourceContract);
    }

    /// @notice Issue a new instrument. Called by the drawer (exporter/seller).
    /// @param drawee The party expected to fund the instrument.
    /// @param beneficiary The party paid once the instrument is honored.
    /// @param token The zero address for native CTC, or an ERC20 token address to settle in.
    /// @param amount The amount the drawee must fund, in the token's smallest unit.
    /// @param requiredDocumentHash The keccak256 hash of the document that must be presented on
    /// the source chain for this instrument to be honored.
    /// @param expiryBlock The Creditcoin block number after which the instrument can no longer be
    /// funded or honored.
    function issue(
        address drawee,
        address beneficiary,
        address token,
        uint256 amount,
        bytes32 requiredDocumentHash,
        uint256 expiryBlock
    ) external returns (uint256 id) {
        require(drawee != address(0), "Drawee cannot be the zero address");
        require(beneficiary != address(0), "Beneficiary cannot be the zero address");
        require(amount > 0, "Amount must be greater than 0");
        require(requiredDocumentHash != bytes32(0), "Required document hash cannot be empty");
        require(expiryBlock > block.number, "Expiry must be in the future");

        id = nextInstrumentId++;

        instruments[id] = Instrument({
            drawer: msg.sender,
            drawee: drawee,
            beneficiary: beneficiary,
            token: token,
            amount: amount,
            requiredDocumentHash: requiredDocumentHash,
            expiryBlock: expiryBlock,
            status: Status.Issued,
            payoutRedirect: address(0)
        });

        emit InstrumentIssued(id, msg.sender, drawee, beneficiary, token, amount, requiredDocumentHash, expiryBlock);
    }

    /// @notice Fund an instrument, locking its full amount in escrow. Called by the drawee. For
    /// an ERC20 instrument, approve this contract for at least the instrument's amount first.
    function fund(uint256 id) external payable nonReentrant {
        Instrument storage inst = instruments[id];
        require(inst.drawer != address(0), "Instrument does not exist");
        require(inst.status == Status.Issued, "Instrument is not awaiting funding");
        require(block.number <= inst.expiryBlock, "Instrument has expired");
        require(msg.sender == inst.drawee, "Only the drawee can fund this instrument");

        if (inst.token == address(0)) {
            require(msg.value == inst.amount, "Funding amount must match the instrument amount exactly");
        } else {
            require(msg.value == 0, "Do not send native value for an ERC20 instrument");
            IERC20(inst.token).safeTransferFrom(msg.sender, address(this), inst.amount);
        }

        inst.status = Status.Funded;
        emit InstrumentFunded(id, inst.amount);
    }

    /// @notice Redirect this instrument's payout to another contract, e.g. a collateral vault,
    /// when the beneficiary pledges it for financing. Only the beneficiary can set this, only
    /// while the instrument is funded and not yet honored, and only for native CTC instruments:
    /// the redirect is notified with a value-carrying call, which only makes sense for CTC.
    function setPayoutRedirect(uint256 id, address redirect) external {
        Instrument storage inst = instruments[id];
        require(inst.status == Status.Funded, "Instrument is not funded");
        require(msg.sender == inst.beneficiary, "Only the beneficiary can redirect payout");
        require(redirect != address(0), "Redirect cannot be the zero address");
        require(inst.token == address(0), "Payout redirect is only supported for native CTC instruments");

        inst.payoutRedirect = redirect;
        emit PayoutRedirected(id, redirect);
    }

    /// @notice Reclaim escrow for an instrument that expired unfunded, or return escrow to the
    /// drawee for one that was funded but never honored in time. Callable by anyone once expired.
    function markExpired(uint256 id) external nonReentrant {
        Instrument storage inst = instruments[id];
        require(inst.drawer != address(0), "Instrument does not exist");
        require(inst.status == Status.Issued || inst.status == Status.Funded, "Instrument already finalized");
        require(block.number > inst.expiryBlock, "Instrument has not expired yet");

        bool wasFunded = inst.status == Status.Funded;
        uint256 amount = inst.amount;
        inst.status = Status.Expired;

        if (wasFunded) {
            _payOut(inst.token, inst.drawee, amount);
            emit InstrumentExpired(id, inst.drawee, amount);
        } else {
            emit InstrumentExpired(id, address(0), 0);
        }
    }

    /// @dev Pays native CTC or an ERC20 out of this contract's own balance, whichever the
    /// instrument was funded in.
    function _payOut(address token, address to, uint256 amount) private {
        if (token == address(0)) {
            (bool sent, ) = to.call{value: amount}("");
            require(sent, "Native transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    function getInstrument(uint256 id) external view returns (Instrument memory) {
        return instruments[id];
    }

    // ---------------------------------------------------------------------
    // Attestcoin Protocol integration (ASCBase)
    // ---------------------------------------------------------------------

    function _processAndEmitEvent(uint8 action, bytes32, bytes memory encodedTransaction) internal override {
        if (action == uint8(AvalAction.Presented)) {
            _honor(encodedTransaction);
        } else {
            revert InvalidAction(action);
        }
    }

    function _honor(bytes memory encodedTransaction) internal nonReentrant {
        EvmV1Decoder.LogEntry[] memory logs = _validatePresentedLogs(encodedTransaction);
        (uint256 id, bytes32 documentHash) = _processPresentedLog(logs);

        Instrument storage inst = instruments[id];
        require(inst.drawer != address(0), "Instrument does not exist");
        require(inst.status == Status.Funded, "Instrument is not funded");
        require(block.number <= inst.expiryBlock, "Instrument has expired");
        require(documentHash == inst.requiredDocumentHash, "Presented document does not match instrument terms");

        inst.status = Status.Honored;
        uint256 amount = inst.amount;
        address redirect = inst.payoutRedirect;

        // setPayoutRedirect only allows a redirect on native CTC instruments, so a value-carrying
        // call here is always backed by CTC actually held by this contract.
        if (redirect != address(0)) {
            IAvalPayoutReceiver(redirect).onInstrumentHonored{value: amount}(id);
            emit InstrumentHonored(id, redirect, amount, documentHash);
        } else {
            _payOut(inst.token, inst.beneficiary, amount);
            emit InstrumentHonored(id, inst.beneficiary, amount, documentHash);
        }
    }

    function _validatePresentedLogs(bytes memory encodedTransaction)
        internal
        pure
        returns (EvmV1Decoder.LogEntry[] memory selectedLogs)
    {
        uint8 txType = EvmV1Decoder.getTransactionType(encodedTransaction);
        require(EvmV1Decoder.isValidTransactionType(txType), "Unsupported transaction type");

        EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(encodedTransaction);
        require(receipt.receiptStatus == 1, "Transaction did not succeed");

        selectedLogs = EvmV1Decoder.getLogsByEventSignature(receipt, PRESENTED_EVENT_SIGNATURE);
        require(selectedLogs.length > 0, "No DocumentPresented events found in transaction");
    }

    function _processPresentedLog(EvmV1Decoder.LogEntry[] memory presentedLogs)
        internal
        view
        returns (uint256 id, bytes32 documentHash)
    {
        require(presentedLogs.length > 0, "No presented logs");
        EvmV1Decoder.LogEntry memory log = presentedLogs[0];

        require(sourcePresentmentContract != address(0), "Source presentment contract not registered");
        require(
            log.address_ == sourcePresentmentContract,
            "Event not emitted by the registered presentment contract"
        );

        require(log.topics.length == 3, "Invalid DocumentPresented topics");
        require(log.topics[0] == PRESENTED_EVENT_SIGNATURE, "Not a DocumentPresented event");
        require(log.data.length == 32, "Invalid DocumentPresented data");

        id = uint256(log.topics[1]);
        documentHash = log.topics[2];

        return (id, documentHash);
    }
}
