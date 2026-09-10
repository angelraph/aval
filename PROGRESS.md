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

### Later still

- Created the GitHub repo (public, github.com/angelraph/aval) and pushed everything.
- Generated a second wallet (the counterparty) and funded it directly from the first, no faucet needed the second time. Added `--as counterparty` to the fund and present scripts so the demo runs as two real, separate wallets: one issuing and relaying proofs, the other funding and presenting as drawee/beneficiary.
- Ran the full flow again with instrument #2, two wallets this time (0x52E8... as drawer/relayer, 0x56d6... as drawee/beneficiary). Same result: honored automatically once Attestcoin proved the Sepolia presentation, paid out to the counterparty wallet, not back to the deployer. Tx: 0x518117ffa8c80cfceac22a574f0dadc8b7a6a3cef2c43762797f03ef7cd877a6.
- Also created the GitHub repo (public, https://github.com/angelraph/aval) and pushed everything, and gave the proof-relay status panel in the frontend a real step tracker instead of a raw status string.
- Wrote the three required docs: `docs/attestcoin-integration.md` (the technical write-up), `docs/pitch-deck-outline.md`, `docs/demo-video-script.md`.

### Next up

- Polish the presentment/verify flow UX (it currently makes the beneficiary sit through a several-minute wait for attestation, worth a better loading state).
- Record the actual demo video.
- Consider ERC20/stablecoin settlement instead of only native CTC, time permitting.
