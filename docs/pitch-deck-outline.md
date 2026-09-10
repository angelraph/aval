# Pitch deck outline

For a short (2 to 3 minute) live or recorded pitch. One idea per slide.

**1. Title**
Aval. Documentary credit on Creditcoin. BUIDL CTC 2026 Fall, RWA track.

**2. The problem**
World trade runs on documentary credits: a bank promises to pay once paper proves goods shipped.
It's slow (days to weeks), costs real fees on both sides, and depends on trusting two banks to
check the paper honestly. Put a number on it if you can find a sourced one for the deck, global
trade finance volume is measured in trillions of dollars a year.

**3. The idea**
Replace the bank's manual paper check with a proof. An importer's payment sits in escrow on
Creditcoin. It releases automatically the instant the Attestcoin Protocol proves the exporter
presented the right document on another chain. No bank, no oracle operator, no bridge.

**4. How it actually works (the four-step diagram from the homepage)**
Issue, fund, present, honor. Keep this slide almost entirely visual, it's the whole product in
one picture.

**5. Why this is a real Attestcoin integration, not a token wrapper**
Built on Gluwa's own `ASCBase` and `EvmV1Decoder`, the same base contracts their audited loan
example uses. Every payout traces back to a real inclusion and continuity proof verified against
the live block prover precompile on Creditcoin CC3 testnet, not a mock. Show the live
`InstrumentHonored` transaction hash on-chain.

**6. Instrument financing**
A funded instrument is a confirmed receivable. A beneficiary can borrow 80% of it immediately
from AvalCollateralVault instead of waiting out the presentment window. The loan repays itself
out of the payout the moment the instrument is honored, there's no separate repayment step. This
is where RWA meets DeFi without stretching either.

**7. What's live right now**
Contracts deployed and verified on Creditcoin CC3 testnet and Sepolia. Full lifecycle run for
real, twice, with two separate wallets playing drawer/relayer and drawee/beneficiary. Frontend
live: desk, issue, fund, present, verify, lend.

**8. Why us / what's next**
Team, and the roadmap: more source chains, ERC20 settlement instead of just native CTC, a real
receivables market instead of a single-pool demo lender.

**9. Ask**
What CEIP fast-track access would let this become.
