// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {AvalInstrument} from "../src/AvalInstrument.sol";
import {AvalInstrumentHarness} from "./harness/AvalInstrumentHarness.sol";
import {AvalCollateralVault} from "../src/AvalCollateralVault.sol";
import {EvmV1Fixtures} from "./helpers/EvmV1Fixtures.sol";

contract AvalCollateralVaultTest is Test {
    AvalInstrumentHarness internal aval;
    AvalCollateralVault internal vault;

    address internal drawer = address(0xD1A0);
    address internal drawee = address(0xD1A1);
    address internal beneficiary = address(0xB0B0);
    address internal lender = address(0x1E0D);
    address internal registeredSource = address(0xA11CE);

    bytes32 internal constant DOC_HASH = keccak256("bill-of-lading:shipment-42");
    uint256 internal instrumentAmount = 1 ether;

    function setUp() public {
        aval = new AvalInstrumentHarness();
        aval.registerSourcePresentmentContract(registeredSource);
        vault = new AvalCollateralVault(address(aval));

        vm.deal(drawee, 10 ether);
        vm.deal(lender, 10 ether);
    }

    function _issueAndFund() internal returns (uint256 id) {
        vm.prank(drawer);
        id = aval.issue(drawee, beneficiary, instrumentAmount, DOC_HASH, block.number + 1000);
        vm.prank(drawee);
        aval.fund{value: instrumentAmount}(id);
    }

    function _presentedTx(uint256 id) internal pure returns (bytes memory) {
        bytes32[] memory topics = new bytes32[](3);
        topics[0] = keccak256("DocumentPresented(uint256,bytes32,address)");
        topics[1] = bytes32(id);
        topics[2] = DOC_HASH;
        return EvmV1Fixtures.successfulTxWithLog(address(0xA11CE), topics, abi.encode(address(0xCAFE)));
    }

    function testDepositAndWithdraw() public {
        vm.prank(lender);
        vault.deposit{value: 5 ether}();

        assertEq(vault.lenderPrincipal(lender), 5 ether);
        assertEq(vault.availableLiquidity(), 5 ether);

        vm.prank(lender);
        vault.withdraw(2 ether);

        assertEq(vault.lenderPrincipal(lender), 3 ether);
        assertEq(lender.balance, 10 ether - 5 ether + 2 ether);
    }

    function testBorrowAgainstInstrument_disbursesEightyPercent() public {
        vm.prank(lender);
        vault.deposit{value: 5 ether}();

        uint256 id = _issueAndFund();

        vm.prank(beneficiary);
        aval.setPayoutRedirect(id, address(vault));

        uint256 beforeBalance = beneficiary.balance;
        vm.prank(beneficiary);
        vault.borrowAgainstInstrument(id);

        // 80% loan-to-value on a 1 ether instrument
        assertEq(beneficiary.balance, beforeBalance + 0.8 ether);

        AvalCollateralVault.Loan memory loan = vault.getLoan(id);
        assertEq(uint8(loan.status), uint8(AvalCollateralVault.LoanStatus.Active));
        assertEq(loan.principal, 0.8 ether);
        assertEq(loan.repaymentDue, 0.8 ether + 0.04 ether); // + 5% origination fee
    }

    function testBorrowAgainstInstrument_revertsWithoutRedirect() public {
        vm.prank(lender);
        vault.deposit{value: 5 ether}();

        uint256 id = _issueAndFund();

        vm.prank(beneficiary);
        vm.expectRevert("Redirect the instrument's payout to this vault first");
        vault.borrowAgainstInstrument(id);
    }

    function testHonorRepaysLoanThenForwardsRemainderToBorrower() public {
        vm.prank(lender);
        vault.deposit{value: 5 ether}();

        uint256 id = _issueAndFund();

        vm.prank(beneficiary);
        aval.setPayoutRedirect(id, address(vault));
        vm.prank(beneficiary);
        vault.borrowAgainstInstrument(id);

        uint256 beneficiaryBalanceAfterLoan = beneficiary.balance;

        // Attestcoin proves the document presentation; instrument pays out to the vault, which
        // repays itself (principal + 5% fee) and forwards the rest straight to the beneficiary.
        aval.exposeHonor(_presentedTx(id));

        AvalCollateralVault.Loan memory loan = vault.getLoan(id);
        assertEq(uint8(loan.status), uint8(AvalCollateralVault.LoanStatus.Repaid));

        uint256 expectedRemainder = instrumentAmount - loan.repaymentDue; // 1 ether - 0.84 ether
        assertEq(beneficiary.balance, beneficiaryBalanceAfterLoan + expectedRemainder);
        assertEq(vault.protocolFees(), 0.04 ether);
    }

    function testLenderCanWithdrawPrincipalAfterLoanIsRepaid() public {
        vm.prank(lender);
        vault.deposit{value: 5 ether}();

        uint256 id = _issueAndFund();
        vm.prank(beneficiary);
        aval.setPayoutRedirect(id, address(vault));
        vm.prank(beneficiary);
        vault.borrowAgainstInstrument(id);

        aval.exposeHonor(_presentedTx(id));

        // Pool balance is back to >= the 5 ether lenders are owed (principal + fee returned).
        vm.prank(lender);
        vault.withdraw(5 ether);
        assertEq(vault.lenderPrincipal(lender), 0);
    }

    function testMarkLoanDefaulted_afterInstrumentExpires() public {
        vm.prank(lender);
        vault.deposit{value: 5 ether}();

        vm.prank(drawer);
        uint256 id = aval.issue(drawee, beneficiary, instrumentAmount, DOC_HASH, block.number + 5);
        vm.prank(drawee);
        aval.fund{value: instrumentAmount}(id);

        vm.prank(beneficiary);
        aval.setPayoutRedirect(id, address(vault));
        vm.prank(beneficiary);
        vault.borrowAgainstInstrument(id);

        vm.roll(block.number + 6);
        aval.markExpired(id);

        vault.markLoanDefaulted(id);

        AvalCollateralVault.Loan memory loan = vault.getLoan(id);
        assertEq(uint8(loan.status), uint8(AvalCollateralVault.LoanStatus.Defaulted));
    }
}
