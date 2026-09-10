"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Contract, formatEther } from "ethers";
import { AVAL_INSTRUMENT_ADDRESS, AvalInstrumentABI, InstrumentStatus } from "@/lib/contracts";
import { getCreditcoinReadProvider } from "@/lib/readProvider";
import { StatusBadge } from "@/components/StatusBadge";
import { shortenAddress } from "@/lib/wallet";

interface InstrumentRow {
  id: number;
  drawer: string;
  drawee: string;
  beneficiary: string;
  amount: string;
  status: string;
  expiryBlock: bigint;
}

export default function DeskPage() {
  const [rows, setRows] = useState<InstrumentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!AVAL_INSTRUMENT_ADDRESS) {
        setError("AvalInstrument is not deployed yet.");
        return;
      }
      try {
        const provider = getCreditcoinReadProvider();
        const instrument = new Contract(AVAL_INSTRUMENT_ADDRESS, AvalInstrumentABI, provider);
        const nextId: bigint = await instrument.nextInstrumentId();

        const ids = Array.from({ length: Number(nextId) - 1 }, (_, i) => i + 1);
        const results = await Promise.all(
          ids.map(async (id) => {
            const inst = await instrument.getInstrument(id);
            return {
              id,
              drawer: inst.drawer,
              drawee: inst.drawee,
              beneficiary: inst.beneficiary,
              amount: formatEther(inst.amount),
              status: InstrumentStatus[Number(inst.status)],
              expiryBlock: inst.expiryBlock,
            };
          })
        );

        if (!cancelled) setRows(results.reverse());
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? String(err));
      }
    }

    load();
    const interval = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Desk</h1>
        <Link
          href="/issue"
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          Issue instrument
        </Link>
      </div>

      {error && <p className="mt-6 text-sm text-red-500">{error}</p>}

      {!error && rows === null && <p className="mt-6 text-sm text-muted">Loading instruments...</p>}

      {rows !== null && rows.length === 0 && (
        <p className="mt-6 text-sm text-muted">No instruments issued yet. Be the first.</p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {rows?.map((row) => (
          <Link
            key={row.id}
            href={`/instrument/${row.id}`}
            className="flex flex-col gap-3 rounded-lg border border-border bg-panel p-4 transition hover:border-accent sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-muted">#{row.id}</span>
                <StatusBadge status={row.status} />
              </div>
              <p className="mt-1 text-sm text-ink">
                {shortenAddress(row.drawee)} pays {shortenAddress(row.beneficiary)}
              </p>
            </div>
            <div className="text-left text-sm text-muted sm:text-right">
              <p className="font-medium text-ink">{row.amount} CTC</p>
              <p>expires at block {row.expiryBlock.toString()}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
