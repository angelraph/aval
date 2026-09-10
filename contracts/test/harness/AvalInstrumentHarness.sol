// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AvalInstrument} from "../../src/AvalInstrument.sol";
import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";

/// @dev Test harness exposing AvalInstrument's internal log processing and honor logic so tests
/// can exercise them without needing a real Attestcoin inclusion proof, which only exists on a
/// live network. The full execute() path (proof verification via the block prover precompile) is
/// exercised separately against Creditcoin CC3 testnet, not here.
contract AvalInstrumentHarness is AvalInstrument {
    function exposeProcessPresentedLog(EvmV1Decoder.LogEntry[] memory logs)
        external
        view
        returns (uint256 id, bytes32 documentHash)
    {
        return _processPresentedLog(logs);
    }

    function exposeHonor(bytes memory encodedTransaction) external {
        _honor(encodedTransaction);
    }
}
