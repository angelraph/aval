# How to test Aval, step by step

This walks through every feature in the app, one small step at a time. No blockchain experience
assumed.

## Before you start

You need:

1. MetaMask (or any wallet browser extension) installed.
2. Two test accounts imported into it, so you can play two different people. See the main
   README or ask for the private keys if you don't have them yet.
3. Both accounts already have testnet money on them (fake CTC and fake ETH, worth nothing, just
   for paying transaction fees), so you don't need to visit a faucet.

Open **https://aval-three-phi.vercel.app**

## Step 1: Look around without connecting anything

Click **Desk** in the top menu. You'll see a list of "instruments" (that's the word this app
uses for one trade deal). Each one shows a status:

- **Issued** means it was created but nobody's put money in yet.
- **Funded** means the money is locked and waiting.
- **Honored** means it paid out successfully.
- **Expired** means time ran out.

Click on any instrument in the list. You'll see its full details and a history log at the
bottom, real transactions, real amounts, nothing fake.

## Step 2: Connect a wallet

Click **Connect wallet** in the top right and pick your first account (call it **Wallet A**). If
MetaMask asks to switch networks or add a new one, click yes, the app needs you on either
Sepolia or Creditcoin CC3 testnet depending on what you're doing, and it'll ask at the right
moment.

## Step 3: Issue an instrument (you're the seller)

Click **Issue** in the menu. Fill in the form like this:

- **Drawee**: paste your second account's address (Wallet B). This is the "buyer" who has to
  pay.
- **Beneficiary**: also paste Wallet B's address. This is who gets paid at the end. For a first
  test, making the buyer and the receiver the same account is fine, keeps things simple.
- **Settle in**: pick "Native CTC" for your first try.
- **Amount**: something small, like 0.01.
- **Document**: type any short description, e.g. "test shipment one". This becomes a secret
  fingerprint the app checks later, so remember exactly what you typed.
- **Expires in**: leave the default.

Click **Issue instrument**. MetaMask will pop up asking you to confirm a transaction, click
confirm. Wait a few seconds. You'll land on the instrument's own page, with a fresh ID number.

## Step 4: Fund it (switch to being the buyer)

Still on that instrument's page, switch MetaMask to **Wallet B** (click the account icon in
MetaMask, pick the other one). Refresh the page. Now you'll see a **Fund this instrument**
button, because the app recognizes Wallet B as the drawee. Click it, confirm in MetaMask. The
instrument's status changes to **Funded**, and that money is now genuinely locked in the
contract, not sitting in anyone's wallet.

## Step 5: Present the document (still as the buyer/receiver)

Now you'll see a **Present the document** box. Type the exact same document text you used in
step 3. Click **Present on Sepolia**. MetaMask will ask you to switch networks first (to
Sepolia), confirm that, then confirm the transaction itself. This is a real transaction on a
different blockchain, proving "this document showed up."

## Step 6: Let Attestcoin prove it happened

A new box appears: **Verify & release**. Click it. Now you wait. This step is real and it is
slow on purpose, usually 5 to 10 minutes, because it's waiting for the Attestcoin Protocol to
confirm, on Creditcoin, that your Sepolia transaction really happened. You'll see a little
progress tracker with steps lighting up one at a time. You can leave the tab open or come back
later, it keeps checking on its own.

When it finishes, the instrument's status flips to **Honored**, and the money moves
automatically to the beneficiary. Nobody clicked a "pay now" button, the contract did it itself
once it had proof.

## Step 7: Try it with the test stablecoin instead

Repeat steps 3 to 6, but this time in step 3 pick **aTUSD (test stablecoin)** under "Settle in"
instead of native CTC. The only difference you'll notice: funding now asks for two confirmations
in MetaMask instead of one (first "approve," then "fund"), that's normal for any ERC20 token,
the contract needs permission to move it before it can pull the funds in.

## Step 8: Try borrowing against a funded instrument

Issue and fund a new native CTC instrument (steps 3 and 4), but don't present the document yet.
On that instrument's page, as the beneficiary (Wallet B), you'll see **Borrow against this
instrument**. Click it. This pledges the instrument and immediately gives you 80% of its value
as a loan, in one click, two confirmations. Now go back and finish steps 5 and 6 (present and
verify) on that same instrument. When it's honored, watch: the loan repays itself and only the
leftover 20% (minus a small fee) lands in the beneficiary's wallet. Nobody repaid anything by
hand.

## Step 9: Try the lending side

Click **Lend** in the menu. This is the other side of step 8, someone has to put money into the
pool for borrowers to draw from. Connect either wallet, type an amount, click **Deposit**. You
can also click **Withdraw** to take money back out, as long as it isn't currently out on loan to
someone else.

## Step 10: Let it expire on purpose (optional)

Issue an instrument with a very short expiry (a small number of blocks instead of the default),
fund it, then just wait without presenting anything. Once the expiry passes, anyone can click
**Mark expired and refund** on that instrument's page, and the drawee gets their money back
automatically.

## Step 11: Check it on your phone

Open the same link on your phone, or shrink your browser window down small. Everything should
still be readable and usable, nothing should overflow off the side of the screen.

## What "normal" looks like at each step

- Confirming a transaction always pops up MetaMask. If nothing pops up, check you're on the
  right network, the app usually asks to switch for you.
- Step 6 (verify) is the only genuinely slow step. Everything else should confirm within a few
  seconds.
- If a document you type in step 5 doesn't exactly match what you typed in step 3, the
  transaction in step 6 will fail with a clear error instead of silently doing the wrong thing.
  That's intentional, try again with the exact text.
