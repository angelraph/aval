// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {AvalInstrument} from "../src/AvalInstrument.sol";
import {AvalInstrumentHarness} from "./harness/AvalInstrumentHarness.sol";
import {EvmV1Fixtures} from "./helpers/EvmV1Fixtures.sol";

contract AvalInstrumentTest is Test {
    AvalInstrumentHarness internal aval;

    address internal owner = address(this);
    address internal drawer = address(0xD1A0);
    address internal drawee = address(0xD1A1);
    address internal beneficiary = address(0xB0B0);
    address internal registeredSource = address(0xA11CE);
    address internal spoofedSource = address(0xBAD);

    bytes32 internal constant DOC_HASH = keccak256("bill-of-lading:shipment-42");
    bytes32 internal constant WRONG_DOC_HASH = keccak256("some-other-document");

    uint256 internal instrumentAmount = 1 ether;

    function setUp() public {
        aval = new AvalInstrumentHarness();
        aval.registerSourcePresentmentContract(registeredSource);
        vm.deal(drawee, 10 ether);
    }

    function _issue(uint256 expiryBlock) internal returns (uint256 id) {
        vm.prank(drawer);
        id = aval.issue(drawee, beneficiary, instrumentAmount, DOC_HASH, expiryBlock);
    }

    function _fund(uint256 id) internal {
        vm.prank(drawee);
        aval.fund{value: instrumentAmount}(id);
    }

    function _presentedTx(address emitter, uint256 id, bytes32 docHash) internal pure returns (bytes memory) {
        bytes32[] memory topics = new bytes32[](3);
        topics[0] = keccak256("DocumentPresented(uint256,bytes32,address)");
        topics[1] = bytes32(id);
        topics[2] = docHash;
        return EvmV1Fixtures.successfulTxWithLog(emitter, topics, abi.encode(address(0xCAFE)));
    }

    // --- issue / fund -------------------------------------------------

    function testIssue_setsFieldsAndStatus() public {
        uint256 id = _issue(block.number + 100);
        AvalInstrument.Instrument memory inst = aval.getInstrument(id);

        assertEq(inst.drawer, drawer);
        assertEq(inst.drawee, drawee);
        assertEq(inst.beneficiary, beneficiary);
        assertEq(inst.amount, instrumentAmount);
        assertEq(inst.requiredDocumentHash, DOC_HASH);
        assertEq(uint8(inst.status), uint8(AvalInstrument.Status.Issued));
    }

    function testFund_movesToFundedAndLocksEscrow() public {
        uint256 id = _issue(block.number + 100);
        _fund(id);

        AvalInstrument.Instrument memory inst = aval.getInstrument(id);
        assertEq(uint8(inst.status), uint8(AvalInstrument.Status.Funded));
        assertEq(address(aval).balance, instrumentAmount);
    }

    function testFund_revertsIfNotDrawee() public {
        uint256 id = _issue(block.number + 100);
        vm.deal(address(this), 1 ether);
        vm.expectRevert("Only the drawee can fund this instrument");
        aval.fund{value: instrumentAmount}(id);
    }

    function testFund_revertsIfWrongAmount() public {
        uint256 id = _issue(block.number + 100);
        vm.prank(drawee);
        vm.expectRevert("Funding amount must match the instrument amount exactly");
        aval.fund{value: instrumentAmount - 1}(id);
    }

    function testFund_revertsIfAlreadyFunded() public {
        uint256 id = _issue(block.number + 100);
        _fund(id);
        vm.prank(drawee);
        vm.deal(drawee, 1 ether);
        vm.expectRevert("Instrument is not awaiting funding");
        aval.fund{value: instrumentAmount}(id);
    }

    // --- honoring (the Attestcoin-triggered path) ----------------------

    function testHonor_happyPath_paysBeneficiaryOnMatchingProof() public {
        uint256 id = _issue(block.number + 100);
        _fund(id);

        uint256 beforeBalance = beneficiary.balance;
        aval.exposeHonor(_presentedTx(registeredSource, id, DOC_HASH));

        AvalInstrument.Instrument memory inst = aval.getInstrument(id);
        assertEq(uint8(inst.status), uint8(AvalInstrument.Status.Honored));
        assertEq(beneficiary.balance, beforeBalance + instrumentAmount);
        assertEq(address(aval).balance, 0);
    }

    function testHonor_revertsOnDocumentHashMismatch() public {
        uint256 id = _issue(block.number + 100);
        _fund(id);

        vm.expectRevert("Presented document does not match instrument terms");
        aval.exposeHonor(_presentedTx(registeredSource, id, WRONG_DOC_HASH));
    }

    function testHonor_revertsOnUnregisteredSourceContract() public {
        uint256 id = _issue(block.number + 100);
        _fund(id);

        vm.expectRevert("Event not emitted by the registered presentment contract");
        aval.exposeHonor(_presentedTx(spoofedSource, id, DOC_HASH));
    }

    function testHonor_revertsIfInstrumentNotFunded() public {
        uint256 id = _issue(block.number + 100);

        vm.expectRevert("Instrument is not funded");
        aval.exposeHonor(_presentedTx(registeredSource, id, DOC_HASH));
    }

    function testHonor_revertsIfInstrumentExpired() public {
        uint256 id = _issue(block.number + 5);
        _fund(id);

        vm.roll(block.number + 6);

        vm.expectRevert("Instrument has expired");
        aval.exposeHonor(_presentedTx(registeredSource, id, DOC_HASH));
    }

    function testHonor_revertsOnTransactionThatFailedOnSourceChain() public {
        uint256 id = _issue(block.number + 100);
        _fund(id);

        bytes32[] memory topics = new bytes32[](3);
        topics[0] = keccak256("DocumentPresented(uint256,bytes32,address)");
        topics[1] = bytes32(id);
        topics[2] = DOC_HASH;
        bytes memory failedTx = EvmV1Fixtures.failedTxWithLog(registeredSource, topics, abi.encode(address(0xCAFE)));

        vm.expectRevert("Transaction did not succeed");
        aval.exposeHonor(failedTx);
    }

    function testHonor_cannotBeReplayedForTheSameInstrument() public {
        uint256 id = _issue(block.number + 100);
        _fund(id);

        aval.exposeHonor(_presentedTx(registeredSource, id, DOC_HASH));

        vm.expectRevert("Instrument is not funded");
        aval.exposeHonor(_presentedTx(registeredSource, id, DOC_HASH));
    }

    // --- expiry / refunds ----------------------------------------------

    function testMarkExpired_refundsDraweeIfFunded() public {
        uint256 id = _issue(block.number + 5);
        _fund(id);

        vm.roll(block.number + 6);

        uint256 beforeBalance = drawee.balance;
        aval.markExpired(id);

        AvalInstrument.Instrument memory inst = aval.getInstrument(id);
        assertEq(uint8(inst.status), uint8(AvalInstrument.Status.Expired));
        assertEq(drawee.balance, beforeBalance + instrumentAmount);
    }

    function testMarkExpired_noRefundIfNeverFunded() public {
        uint256 id = _issue(block.number + 5);
        vm.roll(block.number + 6);

        aval.markExpired(id);

        AvalInstrument.Instrument memory inst = aval.getInstrument(id);
        assertEq(uint8(inst.status), uint8(AvalInstrument.Status.Expired));
    }

    function testMarkExpired_revertsBeforeExpiry() public {
        uint256 id = _issue(block.number + 100);
        vm.expectRevert("Instrument has not expired yet");
        aval.markExpired(id);
    }

    // --- payout redirect -------------------------------------------------

    function testSetPayoutRedirect_onlyBeneficiaryWhileFunded() public {
        uint256 id = _issue(block.number + 100);
        _fund(id);

        vm.prank(beneficiary);
        aval.setPayoutRedirect(id, address(0xFACE));

        AvalInstrument.Instrument memory inst = aval.getInstrument(id);
        assertEq(inst.payoutRedirect, address(0xFACE));
    }

    function testSetPayoutRedirect_revertsIfNotBeneficiary() public {
        uint256 id = _issue(block.number + 100);
        _fund(id);

        vm.expectRevert("Only the beneficiary can redirect payout");
        aval.setPayoutRedirect(id, address(0xFACE));
    }
}
