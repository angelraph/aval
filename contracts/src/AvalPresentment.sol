// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title AvalPresentment
/// @notice Deployed on the source chain (Sepolia). This is where a beneficiary presents the
/// document that proves a trade condition was met. Aval on Creditcoin only trusts events
/// emitted by one registered instance of this contract; see AvalInstrument.registerSourcePresentmentContract.
/// @dev Anyone can call presentDocument. The identity of the caller does not matter, only
/// whether the document hash they present matches the hash the instrument was issued with.
/// This mirrors how a real documentary credit works: the bank checks the paper documents
/// against the credit terms, not who physically hands them over.
contract AvalPresentment {
    event DocumentPresented(uint256 indexed instrumentId, bytes32 indexed documentHash, address presenter);

    /// @notice Present a document for a given instrument. Emits an event that gets proven back
    /// to Creditcoin through the Attestcoin Protocol.
    /// @param instrumentId The Aval instrument this document is being presented against.
    /// @param documentHash The keccak256 hash of the document/shipment data being presented.
    function presentDocument(uint256 instrumentId, bytes32 documentHash) external {
        emit DocumentPresented(instrumentId, documentHash, msg.sender);
    }
}
