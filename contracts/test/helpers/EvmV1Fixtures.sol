// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";

/// @dev Builds fake "encodedTransaction" blobs shaped exactly like the ones the real block
/// prover precompile returns, so unit tests can drive AvalInstrument's internal log-processing
/// logic without needing a live Attestcoin inclusion proof. See EvmV1Decoder for the encoding:
/// abi.encode(uint8 txType, bytes[] chunks), with the receipt in the last chunk.
library EvmV1Fixtures {
    /// @notice Builds an encoded, successful, type-0 transaction whose receipt contains exactly
    /// one log with the given emitter, topics and data.
    function successfulTxWithLog(
        address emitter,
        bytes32[] memory topics,
        bytes memory data
    ) internal pure returns (bytes memory encodedTransaction) {
        EvmV1Decoder.LogEntryTuple[] memory logs = new EvmV1Decoder.LogEntryTuple[](1);
        logs[0] = EvmV1Decoder.LogEntryTuple({address_: emitter, topics: topics, data: data});

        bytes memory receiptChunk = abi.encode(uint8(1), uint64(21000), logs, bytes(""));

        bytes[] memory chunks = new bytes[](3);
        chunks[0] = bytes("");
        chunks[1] = bytes("");
        chunks[2] = receiptChunk;

        encodedTransaction = abi.encode(uint8(0), chunks);
    }

    /// @notice Same as above but the receipt reports a failed (reverted) transaction.
    function failedTxWithLog(
        address emitter,
        bytes32[] memory topics,
        bytes memory data
    ) internal pure returns (bytes memory encodedTransaction) {
        EvmV1Decoder.LogEntryTuple[] memory logs = new EvmV1Decoder.LogEntryTuple[](1);
        logs[0] = EvmV1Decoder.LogEntryTuple({address_: emitter, topics: topics, data: data});

        bytes memory receiptChunk = abi.encode(uint8(0), uint64(21000), logs, bytes(""));

        bytes[] memory chunks = new bytes[](3);
        chunks[0] = bytes("");
        chunks[1] = bytes("");
        chunks[2] = receiptChunk;

        encodedTransaction = abi.encode(uint8(0), chunks);
    }
}
