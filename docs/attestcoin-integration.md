# How Aval uses the Attestcoin Protocol

This is the technical detail behind the one-paragraph version in the README: exactly what Aval
calls, why, and what it does and doesn't trust.

## The shape of the problem

Aval needs to know, trustlessly, that a specific event happened on a chain other than
Creditcoin: a beneficiary presenting a document on Sepolia. It cannot take anyone's word for
that, including its own beneficiary's. That's exactly what the Attestcoin Protocol is for:
proving a transaction on a source chain was included and letting a contract on Creditcoin verify
that proof against the chain's real block prover, without an oracle operator in the loop.

## The three pieces

**AvalPresentment (Sepolia).** A single, tiny contract:

```solidity
event DocumentPresented(uint256 indexed instrumentId, bytes32 indexed documentHash, address presenter);

function presentDocument(uint256 instrumentId, bytes32 documentHash) external {
    emit DocumentPresented(instrumentId, documentHash, msg.sender);
}
```

Anyone can call it. That's deliberate. The presenter's identity doesn't matter, only whether the
`documentHash` they submit matches the one the instrument was issued with. This is the same
principle a real documentary credit runs on: the bank checks the paper against the terms, not who
physically carried it in.

**AvalInstrument (Creditcoin).** Extends `ASCBase` from `@gluwa/asc-contracts`, Gluwa's own base
contract for this exact pattern. `ASCBase.execute()` does the actual proof verification:

```solidity
function execute(
    uint8 action,
    uint64 chainKey,
    uint64 blockHeight,
    bytes calldata encodedTransaction,
    bytes32 merkleRoot,
    INativeQueryVerifier.MerkleProofEntry[] calldata siblings,
    bytes32 lowerEndpointDigest,
    bytes32[] calldata continuityRoots
) external returns (bool success)
```

It computes a `queryId` from the proof (so the same proof can't be submitted twice), calls the
real Native Query Verifier precompile at `0xFD2` to check the inclusion and continuity proof, and
only then calls into Aval's own `_processAndEmitEvent`. Aval never touches proof verification
directly. It only decides what to do once a proof has already been confirmed valid, by decoding
the transaction's logs with `EvmV1Decoder` (also from `@gluwa/asc-contracts`), and checking:

- the log came from `sourcePresentmentContract`, the one AvalPresentment address Aval trusts
  (set once, by the deployer, via `registerSourcePresentmentContract`)
- the log is actually a `DocumentPresented` event (checked against the real signature)
- the instrument it names is currently `Funded` and not expired
- the document hash in the log matches the hash the instrument was issued with

Only if every one of those holds does Aval release the escrowed funds.

**The off-chain step.** Between "presented on Sepolia" and "verified on Creditcoin" there's a
proof to fetch. Aval uses `@gluwa/usc-sdk` for this, the same SDK and flow Gluwa's own examples
use:

```ts
const proofBuilder = new proofProvider.service.ProofBuilder(chainKey, proofBuilderUrl);
await proofBuilder.waitUntilHeightAttested(chainKey, blockNumber, pollMs, timeoutMs);
const proof = await proofBuilder.getProof(txHash);
```

`waitUntilHeightAttested` waits for the Sepolia block containing the presentment to actually be
attested on Creditcoin, which in practice takes several minutes. `getProof` then fetches the
inclusion and continuity proof for that specific transaction. The frontend runs this as a
background job (`web/lib/proofRelay.ts`) so a beneficiary doesn't have to keep a script open; the
CLI version is `contracts/script/verify-proof.ts`, useful for testing the mechanism directly.

Submitting the proof (calling `execute()`) is permissionless. It doesn't have to be the
beneficiary who pays the Creditcoin gas for it, which is why Aval's frontend relays it from its
own wallet instead of asking the beneficiary to hold Creditcoin testnet gas at all. Nothing about
that relaying is privileged: anyone could submit the same valid proof and get the same result,
Aval's relayer just saves the beneficiary a step.

## What's real here and what's Aval's own logic

Everything about verifying that a Sepolia transaction actually happened, was actually included in
the block it claims, and that block is actually attested on Creditcoin: that's the Attestcoin
Protocol, exercised through its own audited base contract and SDK, unmodified. Aval adds exactly
one thing on top: deciding that a `DocumentPresented` event from the registered source contract,
naming a funded instrument, with a matching document hash, means "pay out." That's the whole
surface area of trust Aval is responsible for.

## Settlement asset

None of this depends on what actually moves when an instrument is honored. `AvalInstrument`
escrows either native CTC or an ERC20, decided per instrument at issuance, and the honor path
pays out in whichever it was funded in. The Attestcoin verification is identical either way. The
collateral vault is native CTC only for now, since it's notified of a payout with a value-carrying
call, which only makes sense for CTC, an ERC20-aware version of the vault is a natural next step.

## Contracts

| Contract | Network | Address |
|---|---|---|
| AvalInstrument | Creditcoin CC3 testnet | `0xFbe8A52580E0155dB0154eaeFc6D66c91565F5DE` |
| AvalCollateralVault | Creditcoin CC3 testnet | `0x1584A2252694E957e8B569d6F55A1C856aEa4a94` |
| AvalPresentment | Sepolia | `0x2017c0D852b949a5835D99f86CDb6FA9c0eCf141` |
| AvalTestToken (aTUSD) | Creditcoin CC3 testnet | `0xff726e92187002ef2615b80FbE67c79b9DF6a2ec` |

Source: `contracts/src/AvalInstrument.sol`, `contracts/src/AvalPresentment.sol`,
`contracts/src/AvalCollateralVault.sol`. Tests: `contracts/test/`.
