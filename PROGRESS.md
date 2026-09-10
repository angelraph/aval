# Progress Log

## 2026-09-10 (Day 1)

- Researched the real Attestcoin Protocol integration pattern from Gluwa's own examples (github.com/gluwa/attestcoin-protocol-examples), instead of guessing at precompile interfaces. Confirmed the ASCBase / EvmV1Decoder / usc-sdk proof flow used in their loan example, and built Aval on top of the same audited pattern.
- Decided on the product: Aval, a documentary credit escrow on Creditcoin, released automatically when Attestcoin proves a document presentation event on Sepolia.
- Wrote the contracts: AvalInstrument (the escrow, extends ASCBase), AvalPresentment (the trusted source-chain contract), AvalCollateralVault (lets a beneficiary borrow against a funded instrument, repaid automatically out of the payout).
- Installed Foundry, wrote 23 tests covering the full lifecycle, proof validation, replay protection, expiry, and the lending flow. All passing.
- Wrote deployment and demo scripts (issue, fund, present, verify-proof, status) in TypeScript, using @gluwa/usc-sdk for the real proof flow. Typechecks clean.
- Generated a deployer wallet for testnet deployment: 0x52E867EA4d68b62793D99Dd3E3D085A6169F0d6b. Not funded yet, that's the blocker before we can deploy and run the real end-to-end proof.
- Scaffolded the frontend (Next.js, Tailwind), wrote the layout and landing page, confirmed it builds and is mobile responsive.
- Wrote the README.

### Later the same day

- Wallet funded on both networks. Deployed for real:
  - AvalInstrument: `0x2017c0D852b949a5835D99f86CDb6FA9c0eCf141` (Creditcoin CC3 testnet)
  - AvalCollateralVault: `0xBf9A5Bc472c27475F5b5276780a8D74EEfAB235A` (Creditcoin CC3 testnet)
  - AvalPresentment: `0x2017c0D852b949a5835D99f86CDb6FA9c0eCf141` (Sepolia)
- Ran the full flow live, for real, not simulated: issued an instrument, funded it, presented a document on Sepolia, and let the Attestcoin Protocol prove it. It worked. The proof verified on-chain and the escrow released automatically. Instrument #1 is sitting on Creditcoin CC3 testnet right now with status "Honored". This was the biggest technical risk in the whole project and it's cleared.
- Built out the frontend: wallet connect and network switching, a Desk that reads instruments straight off the chain, an Issue form, an instrument detail page with fund/present/verify actions and a live proof relay (with on-chain history), and a lending page for the vault. Checked all of it on both desktop and mobile widths.

### Next up

- Get a second wallet (or two) involved so the demo shows a real drawer/drawee/beneficiary split instead of one wallet playing every role.
- Polish the presentment/verify flow UX (it currently makes the beneficiary sit through a several-minute wait for attestation, worth a better loading state).
- Start on the docs: technical write-up, pitch deck outline, demo video script.
