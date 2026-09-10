# Demo video script

Target length: 2 to 3 minutes. Screen recording, live testnet, not slides.

**0:00 to 0:20, cold open**
Show the homepage. Say it straight: "This is Aval. It's a documentary credit, the thing that
moves most of world trade, rebuilt so a bank doesn't have to manually check paperwork. Payment
sits in escrow, and it releases itself the moment proof of shipment shows up on another chain."

**0:20 to 0:45, issue and fund**
Switch to the desk, show it's empty or has a prior instrument. Go to Issue, fill it in on camera:
a drawee address, a beneficiary address, an amount, a document description ("18t coffee, Mombasa
to Hamburg"). Submit it, real wallet popup, real transaction. Cut to the drawee wallet funding it.
Say what just happened: real money, locked in a contract on Creditcoin, not held by anyone.

**0:45 to 1:15, present**
Switch wallets to the beneficiary. Type the same document text. Present it, on Sepolia, live.
Point at the resulting Sepolia transaction hash. Say: "That's it, that's the proof of shipment.
It's a public transaction on another chain. Nothing about Aval controls it."

**1:15 to 2:00, the Attestcoin step**
Click "Verify & release." Show the status panel: waiting for mining, waiting for attestation.
Say what's happening while it runs, in plain terms: "Attestcoin has to see this transaction land
in a block, and then prove that block on Creditcoin. That normally takes a few minutes, so I'll
speed this part up." Cut/fast-forward to it finishing. Show the status flip to Honored, and the
beneficiary's balance change. Show the transaction hash of the actual `execute()` call, the one
that verified the proof against the real block prover precompile.

**2:00 to 2:30, the financing angle**
Quick cut to a second, already-funded instrument. Show "Borrow against this instrument." Borrow
it. Point out: "This loan repays itself, straight out of the payout, the moment the instrument is
honored. There's no separate repayment step, because the money never touches the borrower's hands
until the loan already settled."

**2:30 to end, close**
Back to the desk, showing multiple real instruments in different states. "Everything here is
live, on Creditcoin CC3 testnet and Sepolia. Not a demo network, not mocked data." End on the
GitHub URL and the repo's README.

Notes for recording: use two real browser wallet profiles (or two windows) so the drawer/drawee/
beneficiary switch is visible and honest, not narrated over one wallet. Keep the attestation wait
either genuinely sped up in editing (label it as such) or cut to a second take recorded after it
finished, don't fake the wait.
