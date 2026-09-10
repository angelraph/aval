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

### Next up

- Fund the deployer wallet on Sepolia and Creditcoin CC3 testnet, then deploy and run the full flow live.
- Build the Desk, Issue, Fund, and Present/Verify pages in the frontend, wired to the deployed contracts.
