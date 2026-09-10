# Progress Log

## 2026-09-10 (Day 1)

- Researched the real Attestcoin Protocol integration pattern from Gluwa's own examples (github.com/gluwa/attestcoin-protocol-examples), instead of guessing at precompile interfaces. Confirmed the ASCBase / EvmV1Decoder / usc-sdk proof flow used in their loan example, and are building Aval on top of the same audited pattern.
- Decided on the product: Aval, a documentary credit escrow on Creditcoin, released automatically when Attestcoin proves a document presentation event on Sepolia.
- Scaffolded the repo: `contracts/` (Foundry + npm deps for @gluwa/asc-contracts and @gluwa/usc-sdk), `web/` (Next.js frontend, not started yet), `docs/`.
- Installed Foundry (forge, cast, anvil) locally.
