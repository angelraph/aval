# Aval

Aval is a documentary credit built on Creditcoin. A buyer's payment sits in escrow until proof
that goods actually shipped arrives from another chain, verified without a bank, a custodial
oracle, or a bridge operator in the loop.

Built for BUIDL CTC 2026 Fall (Creditcoin x Credit Labs), RWA track.

## The problem

A documentary credit (a letter of credit, in older language) is how most of the world's trade
gets paid for. An importer's bank promises to pay an exporter once the exporter proves, on paper,
that goods were shipped. It works, but it is slow: banks on both sides manually check paper
documents against the credit terms, and the process routinely takes days to weeks and costs real
money in bank fees. It also depends entirely on trusting both banks to do their job honestly.

## What Aval does instead

1. A drawer (the exporter) issues an instrument on Creditcoin: an amount, a drawee (the
   importer), a beneficiary to be paid, and the hash of the document that has to be presented.
2. The drawee funds the instrument. The amount is locked in the contract, not held by a bank.
3. When the goods ship, the beneficiary presents that document on a source chain (Sepolia in
   this build, any EVM chain the Attestcoin Protocol supports in principle).
4. The Attestcoin Protocol proves that presentation happened, and Aval's contract on Creditcoin
   verifies that proof directly against the real block prover precompile, checks the document
   hash matches, and releases the funds. No party decides this by hand.

If the document never gets presented before the deadline, the drawee gets the escrow back
automatically.

## Instrument financing

A beneficiary does not have to wait out the full presentment window to get paid. Once an
instrument is funded, they can borrow up to 80% of its value from AvalCollateralVault, a small
lending pool. The loan is repaid automatically, out of the instrument's own payout, the moment
Attestcoin proves the document presentation. There is no separate repayment step and no way for
the borrower to skip it, because the money never passes through their hands until the loan is
already settled.

## How the trust actually works

Aval does not build its own cross-chain verification. It uses Creditcoin's Attestcoin Protocol
(`@gluwa/asc-contracts` and `@gluwa/usc-sdk`), the same base contracts and off-chain proof
pipeline used in Gluwa's own reference examples. `AvalInstrument` extends `ASCBase`, which checks
every submitted proof against the real block prover precompile before any of Aval's own logic
runs. Aval decides what a valid document presentation means for its own instruments; it does not
decide what counts as a valid inclusion proof. That part stays exactly as audited.

## Repository layout

```
contracts/   Solidity contracts, Foundry tests, and the TypeScript deployment/demo scripts
web/         Frontend
docs/        Technical write-up, pitch deck outline, demo video script
```

## Contracts

- `AvalInstrument.sol`, deployed on Creditcoin. Issues, funds, and honors instruments. Verifies
  Attestcoin proofs itself through `ASCBase.execute()`.
- `AvalPresentment.sol`, deployed on the source chain. The one contract Aval trusts for document
  presentation events.
- `AvalCollateralVault.sol`, deployed on Creditcoin. The instrument financing pool described
  above.

Run the test suite:

```bash
cd contracts
npm install
npm run build
npm test
```

## Running the full flow on testnet

See `contracts/.env.example` for the environment variables you need (a funded wallet on both
Sepolia and Creditcoin CC3 testnet, RPC URLs, and the Attestcoin proof builder URL).

```bash
cd contracts
npm run deploy:sepolia       # deploys AvalPresentment
npm run deploy:creditcoin    # deploys AvalInstrument and AvalCollateralVault
npm run register:source      # tells AvalInstrument which source contract to trust

npm run issue                # issues a demo instrument
npm run fund <instrumentId>
npm run present <instrumentId> "<document text>"
npm run verify-proof <instrumentId> <sepoliaTxHash>   # the Attestcoin step
npm run status <instrumentId>
```

## Status

Day 1 (2026-09-10): contracts written and tested (23 tests passing), deployment scripts ready.
Deploying to testnet next, once the deployer wallet is funded. Frontend has not started yet. See
`PROGRESS.md` for the day-by-day log.

## License

MIT
