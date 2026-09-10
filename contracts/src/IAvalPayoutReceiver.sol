// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Implemented by anything that wants to receive an instrument's payout on its
/// beneficiary's behalf, e.g. AvalCollateralVault when an instrument has been pledged for a loan.
interface IAvalPayoutReceiver {
    function onInstrumentHonored(uint256 instrumentId) external payable;
}
