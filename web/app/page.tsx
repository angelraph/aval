import Link from "next/link";

const steps = [
  {
    title: "Issue",
    body: "The exporter issues an instrument: an amount, the importer who owes it, the beneficiary who gets paid, and the hash of the document that has to show up before payment is released.",
  },
  {
    title: "Fund",
    body: "The importer locks the amount in escrow, on-chain, on Creditcoin. Nobody holds it but the contract.",
  },
  {
    title: "Present",
    body: "Once the goods ship, the beneficiary presents that document on the source chain. That's a real, public transaction.",
  },
  {
    title: "Honor",
    body: "The Attestcoin Protocol proves the presentation happened. Aval checks the document hash matches and releases the escrow. No bank call, no manual review.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
      <section className="max-w-2xl">
        <p className="text-sm font-medium text-accent">Documentary credit, rebuilt on-chain</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Payment held in escrow. Released the moment proof arrives.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
          Trade finance has run on paper documents and correspondent banks for a century. Aval
          replaces the manual check with a proof: Creditcoin&apos;s Attestcoin Protocol verifies
          that a shipment document was presented on another chain, and the escrow releases itself.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/desk" className="btn-primary">
            View the desk
          </Link>
          <Link href="/issue" className="btn-secondary">
            Issue an instrument
          </Link>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">How it works</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className="rounded-lg border border-border bg-panel p-5"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                  {i + 1}
                </span>
                <h3 className="font-medium text-ink">{step.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14 rounded-lg border border-border bg-panel p-6 sm:p-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Get paid before the goods even arrive
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          A funded instrument is a confirmed, escrowed receivable. Instead of waiting out the full
          presentment window, a beneficiary can borrow up to 80% of it from Aval&apos;s lending
          pool. The loan repays itself, straight out of the instrument&apos;s own payout, the
          instant the presentation is proven. There&apos;s no separate repayment step, because the
          money is never in the borrower&apos;s hands until the loan is already settled.
        </p>
      </section>

      <section className="mt-14 text-sm text-muted">
        <p>
          Live on Creditcoin CC3 testnet and Sepolia. Open the desk to see real instruments moving
          through escrow, or issue one yourself.
        </p>
      </section>
    </div>
  );
}
