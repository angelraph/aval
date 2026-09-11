# Demo video script (read-aloud version)

This is written so you can read it straight into the microphone while you click through the
app. Every **SAY** block is exactly what to say out loud, word for word if you want. Everything
in brackets is a stage direction, not something you say.

Total reading time: about 2 minutes. The video will run a bit longer because of the wait in
Scene 6, more on that below.

## Before you hit record

- Have two MetaMask accounts ready (Wallet A and Wallet B), both already imported.
- Have the app open at https://aval-three-phi.vercel.app on the Home page.
- Decide now: are you going to sit through the real multi-minute wait in Scene 6, or record it
  separately and edit it in later, sped up? Either is fine. Details are in Scene 6 below.

---

## Scene 1: Home page

[You're on the home page. Don't click anything yet.]

**SAY:**
> "Hi, this is Aval, built on Creditcoin.
>
> For a hundred years, banks have handled trade payments by hand. A buyer's bank promises to
> pay a seller once someone manually checks a paper document.
>
> Aval does that with code instead. The money sits locked in a smart contract, and it releases
> itself the moment real proof shows up that the goods actually shipped. No bank. No manual
> check."

## Scene 2: The Desk

[Click "Desk" in the top menu.]

**SAY:**
> "This is the Desk. Every deal here is called an instrument. You can see its amount, and
> whether it's still waiting, funded, or already paid out."

## Scene 3: Issue an instrument

[Connect Wallet A. Click "Issue" in the top menu.]

**SAY:**
> "Let's create one. I'm the seller here. I'll say who owes me the money, how much, and what
> document has to show up before I get paid."

[Fill in the form:
- Drawee: paste Wallet B's address
- Beneficiary: paste Wallet B's address
- Amount: 0.01
- Document: type something simple, like "18 tons of coffee, Mombasa to Hamburg"
Click "Issue instrument" and confirm in MetaMask.]

**SAY:**
> "I'll issue it now."

[Wait for the page to land on the new instrument.]

## Scene 4: Fund it

[Switch MetaMask to Wallet B. Refresh the page.]

**SAY:**
> "Now I'm the buyer. I switch to my other wallet, and I see a Fund button."

[Click "Fund", confirm in MetaMask.]

**SAY:**
> "I click it, and my money goes straight into the contract. Nobody is holding it. Not Aval, not
> a bank. Just code."

## Scene 5: Present the document

[Still as Wallet B. Type the exact same document text from Scene 3 into the box.]

**SAY:**
> "Now let's say the coffee actually shipped. As the buyer, I present proof of that, I type the
> same words again, and send it. This happens on a different blockchain, called Sepolia, just to
> prove something real happened somewhere else."

[Click "Present on Sepolia", confirm in MetaMask.]

## Scene 6: Verify and get paid

[Click "Verify & release".]

**SAY:**
> "Now the important part. I click Verify and release. This asks Creditcoin's Attestcoin
> Protocol to check that what just happened on Sepolia is real. It usually takes several minutes,
> so I'm going to speed this bit up."

**[Here's the actual choice for this scene:]**
- **Option A (simplest):** Stop recording. Come back in 5 to 10 minutes once the status says
  "Honored." Start recording again and say the line below. Cut the two clips together later, or
  just upload them as one video with a jump cut, that's completely normal for a demo video.
- **Option B:** Keep recording the whole wait, then speed up that section 8x to 10x in your
  video editor afterward so it only takes a few seconds to watch.

[Once the status shows "Honored":]

**SAY:**
> "And there it is. Proven, and paid, automatically. I didn't click anything else after Verify.
> The contract did the rest by itself the second it had proof."

## Scene 7: Instrument financing (optional, only if time allows)

[On a different, already-funded instrument, as the beneficiary, click "Borrow".]

**SAY:**
> "One more thing. If I don't want to wait at all, I can borrow eighty percent of the money right
> now from Aval's own lending pool. That loan pays itself back automatically the second the real
> payment lands, out of the payout itself."

## Scene 8: Closing

[Back on the Desk page, showing a few instruments.]

**SAY:**
> "Everything you just watched is real. Real testnet transactions, on Creditcoin and on Sepolia,
> not a mockup. Thanks for watching. This is Aval."

---

## A few tips for reading it well

- Read each SAY block once through silently first, then record it. Don't worry about matching
  it word for word, saying it in your own natural voice is better than sounding stiff.
- Pause for a breath between scenes. Little gaps are easy to trim out later.
- If you mess up a line, just stop, take a breath, and say it again. Keep the good take, cut the
  rest.
- It's fine to record scenes in more than one take and stitch them together. Nobody expects one
  perfect unbroken recording.
