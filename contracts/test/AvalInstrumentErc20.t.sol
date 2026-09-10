// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {AvalInstrument} from "../src/AvalInstrument.sol";
import {AvalInstrumentHarness} from "./harness/AvalInstrumentHarness.sol";
import {AvalTestToken} from "../src/AvalTestToken.sol";
import {EvmV1Fixtures} from "./helpers/EvmV1Fixtures.sol";

/// @notice Same instrument lifecycle as AvalInstrument.t.sol, but settled in an ERC20 instead of
/// native CTC, to exercise the token path separately from the native one.
contract AvalInstrumentErc20Test is Test {
    AvalInstrumentHarness internal aval;
    AvalTestToken internal token;

    address internal drawer = address(0xD1A0);
    address internal drawee = address(0xD1A1);
    address internal beneficiary = address(0xB0B0);
    address internal registeredSource = address(0xA11CE);

    bytes32 internal constant DOC_HASH = keccak256("invoice:INV-1042");
    uint256 internal instrumentAmount = 1_000_000; // 1.00 aTUSD, 6 decimals

    function setUp() public {
        aval = new AvalInstrumentHarness();
        aval.registerSourcePresentmentContract(registeredSource);

        token = new AvalTestToken();
        token.mint(drawee, instrumentAmount);
    }

    function _issue(uint256 expiryBlock) internal returns (uint256 id) {
        vm.prank(drawer);
        id = aval.issue(drawee, beneficiary, address(token), instrumentAmount, DOC_HASH, expiryBlock);
    }

    function _presentedTx(uint256 id) internal pure returns (bytes memory) {
        bytes32[] memory topics = new bytes32[](3);
        topics[0] = keccak256("DocumentPresented(uint256,bytes32,address)");
        topics[1] = bytes32(id);
        topics[2] = DOC_HASH;
        return EvmV1Fixtures.successfulTxWithLog(address(0xA11CE), topics, abi.encode(address(0xCAFE)));
    }

    function testFund_pullsErc20FromDrawee() public {
        uint256 id = _issue(block.number + 100);

        vm.startPrank(drawee);
        token.approve(address(aval), instrumentAmount);
        aval.fund(id);
        vm.stopPrank();

        assertEq(token.balanceOf(address(aval)), instrumentAmount);
        assertEq(token.balanceOf(drawee), 0);
    }

    function testFund_revertsWithoutApproval() public {
        uint256 id = _issue(block.number + 100);

        vm.prank(drawee);
        vm.expectRevert();
        aval.fund(id);
    }

    function testFund_revertsIfNativeValueSentForErc20Instrument() public {
        uint256 id = _issue(block.number + 100);
        vm.deal(drawee, 1 ether);

        vm.startPrank(drawee);
        token.approve(address(aval), instrumentAmount);
        vm.expectRevert("Do not send native value for an ERC20 instrument");
        aval.fund{value: 1}(id);
        vm.stopPrank();
    }

    function testHonor_paysErc20ToBeneficiary() public {
        uint256 id = _issue(block.number + 100);
        vm.startPrank(drawee);
        token.approve(address(aval), instrumentAmount);
        aval.fund(id);
        vm.stopPrank();

        aval.exposeHonor(_presentedTx(id));

        assertEq(token.balanceOf(beneficiary), instrumentAmount);
        assertEq(token.balanceOf(address(aval)), 0);
        AvalInstrument.Instrument memory inst = aval.getInstrument(id);
        assertEq(uint8(inst.status), uint8(AvalInstrument.Status.Honored));
    }

    function testMarkExpired_refundsErc20ToDrawee() public {
        uint256 id = _issue(block.number + 5);
        vm.startPrank(drawee);
        token.approve(address(aval), instrumentAmount);
        aval.fund(id);
        vm.stopPrank();

        vm.roll(block.number + 6);
        aval.markExpired(id);

        assertEq(token.balanceOf(drawee), instrumentAmount);
        assertEq(token.balanceOf(address(aval)), 0);
    }

    function testSetPayoutRedirect_revertsForErc20Instrument() public {
        uint256 id = _issue(block.number + 100);
        vm.startPrank(drawee);
        token.approve(address(aval), instrumentAmount);
        aval.fund(id);
        vm.stopPrank();

        vm.prank(beneficiary);
        vm.expectRevert("Payout redirect is only supported for native CTC instruments");
        aval.setPayoutRedirect(id, address(0xFACE));
    }
}
