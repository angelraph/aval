"use client";

import { use, useCallback, useEffect, useState } from "react";
import { Contract, formatEther, keccak256, toUtf8Bytes, ZeroAddress } from "ethers";
import { useWallet } from "@/lib/WalletContext";
import { switchNetwork, CREDITCOIN_TESTNET, SEPOLIA, shortenAddress } from "@/lib/wallet";
import {
  AVAL_INSTRUMENT_ADDRESS,
  AVAL_PRESENTMENT_ADDRESS,
  AVAL_COLLATERAL_VAULT_ADDRESS,
  AVAL_INSTRUMENT_DEPLOY_BLOCK,
  AvalInstrumentABI,
  AvalPresentmentABI,
  AvalCollateralVaultABI,
  InstrumentStatus,
} from "@/lib/contracts";
import { getCreditcoinReadProvider } from "@/lib/readProvider";
import { queryFilterChunked } from "@/lib/queryLogs";
import { StatusBadge } from "@/components/StatusBadge";
import { ConnectButton } from "@/components/ConnectButton";

interface InstrumentData {
  drawer: string;
  drawee: string;
  beneficiary: string;
  amount: bigint;
  requiredDocumentHash: string;
  expiryBlock: bigint;
  status: number;
  payoutRedirect: string;
}

interface HistoryEntry {
  label: string;
  detail: string;
  txHash: string;
}

export default function InstrumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { address, connect, getSigner } = useWallet();

  const [inst, setInst] = useState<InstrumentData | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentBlock, setCurrentBlock] = useState<bigint>(0n);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [documentText, setDocumentText] = useState("");
  const [presentedTxHash, setPresentedTxHash] = useState<string | null>(null);
  const [relayJobId, setRelayJobId] = useState<string | null>(null);
  const [relayJob, setRelayJob] = useState<any>(null);

  const refresh = useCallback(async () => {
    if (!AVAL_INSTRUMENT_ADDRESS) return;
    const provider = getCreditcoinReadProvider();
    const contract = new Contract(AVAL_INSTRUMENT_ADDRESS, AvalInstrumentABI, provider);

    const [data, block] = await Promise.all([contract.getInstrument(id), provider.getBlockNumber()]);
    setInst(data);
    setCurrentBlock(BigInt(block));

    const fromBlock = AVAL_INSTRUMENT_DEPLOY_BLOCK || 0;
    const [issuedLogs, fundedLogs, honoredLogs, expiredLogs] = await Promise.all([
      queryFilterChunked(contract, contract.filters.InstrumentIssued(id), fromBlock, block),
      queryFilterChunked(contract, contract.filters.InstrumentFunded(id), fromBlock, block),
      queryFilterChunked(contract, contract.filters.InstrumentHonored(id), fromBlock, block),
      queryFilterChunked(contract, contract.filters.InstrumentExpired(id), fromBlock, block),
    ]);

    const entries: HistoryEntry[] = [];
    for (const log of issuedLogs) {
      entries.push({ label: "Issued", detail: "Instrument created", txHash: log.transactionHash });
    }
    for (const log of fundedLogs) {
      const parsed = contract.interface.parseLog(log);
      entries.push({
        label: "Funded",
        detail: `${formatEther(parsed!.args.amount)} CTC locked in escrow`,
        txHash: log.transactionHash,
      });
    }
    for (const log of honoredLogs) {
      const parsed = contract.interface.parseLog(log);
      entries.push({
        label: "Honored",
        detail: `Paid ${formatEther(parsed!.args.amount)} CTC to ${shortenAddress(parsed!.args.paidTo)}, document hash ${parsed!.args.documentHash}`,
        txHash: log.transactionHash,
      });
    }
    for (const log of expiredLogs) {
      entries.push({ label: "Expired", detail: "Instrument expired", txHash: log.transactionHash });
    }
    setHistory(entries);
  }, [id]);

  useEffect(() => {
    refresh().catch((err) => setError(err.message ?? String(err)));
    const interval = setInterval(() => refresh().catch(() => {}), 10_000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (!relayJobId) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/verify-proof/${relayJobId}`);
      const data = await res.json();
      setRelayJob(data);
      if (data.status === "done" || data.status === "error") {
        clearInterval(interval);
        refresh().catch(() => {});
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [relayJobId, refresh]);

  async function handleFund() {
    if (!inst) return;
    setError(null);
    setBusy("fund");
    try {
      if (!address) await connect();
      await switchNetwork(CREDITCOIN_TESTNET);
      const signer = await getSigner();
      const contract = new Contract(AVAL_INSTRUMENT_ADDRESS, AvalInstrumentABI, signer);
      const tx = await contract.fund(id, { value: inst.amount });
      await tx.wait();
      await refresh();
    } catch (err: any) {
      setError(err.shortMessage ?? err.message ?? String(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleMarkExpired() {
    setError(null);
    setBusy("expire");
    try {
      await switchNetwork(CREDITCOIN_TESTNET);
      const signer = await getSigner();
      const contract = new Contract(AVAL_INSTRUMENT_ADDRESS, AvalInstrumentABI, signer);
      const tx = await contract.markExpired(id);
      await tx.wait();
      await refresh();
    } catch (err: any) {
      setError(err.shortMessage ?? err.message ?? String(err));
    } finally {
      setBusy(null);
    }
  }

  async function handlePresent() {
    setError(null);
    setBusy("present");
    try {
      if (!address) await connect();
      await switchNetwork(SEPOLIA);
      const signer = await getSigner();
      const contract = new Contract(AVAL_PRESENTMENT_ADDRESS, AvalPresentmentABI, signer);
      const hash = keccak256(toUtf8Bytes(documentText));
      const tx = await contract.presentDocument(id, hash);
      const receipt = await tx.wait();
      setPresentedTxHash(receipt.hash);
    } catch (err: any) {
      setError(err.shortMessage ?? err.message ?? String(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleVerify() {
    if (!presentedTxHash) return;
    setError(null);
    setBusy("verify");
    try {
      const res = await fetch("/api/verify-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instrumentId: id, sourceTxHash: presentedTxHash }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start verification");
      setRelayJobId(data.jobId);
      setRelayJob({ status: "waiting-for-mining", log: [] });
    } catch (err: any) {
      setError(err.message ?? String(err));
    } finally {
      setBusy(null);
    }
  }

  async function handlePledgeAndBorrow() {
    setError(null);
    setBusy("borrow");
    try {
      await switchNetwork(CREDITCOIN_TESTNET);
      const signer = await getSigner();
      const instrumentContract = new Contract(AVAL_INSTRUMENT_ADDRESS, AvalInstrumentABI, signer);
      const pledgeTx = await instrumentContract.setPayoutRedirect(id, AVAL_COLLATERAL_VAULT_ADDRESS);
      await pledgeTx.wait();

      const vaultContract = new Contract(AVAL_COLLATERAL_VAULT_ADDRESS, AvalCollateralVaultABI, signer);
      const borrowTx = await vaultContract.borrowAgainstInstrument(id);
      await borrowTx.wait();
      await refresh();
    } catch (err: any) {
      setError(err.shortMessage ?? err.message ?? String(err));
    } finally {
      setBusy(null);
    }
  }

  if (!AVAL_INSTRUMENT_ADDRESS) {
    return <div className="mx-auto max-w-2xl px-5 py-14 text-sm text-muted">AvalInstrument is not deployed yet.</div>;
  }

  if (!inst) {
    return <div className="mx-auto max-w-2xl px-5 py-14 text-sm text-muted">Loading instrument #{id}...</div>;
  }

  const status = InstrumentStatus[inst.status];
  const isDrawee = address?.toLowerCase() === inst.drawee.toLowerCase();
  const isBeneficiary = address?.toLowerCase() === inst.beneficiary.toLowerCase();
  const isExpired = currentBlock > inst.expiryBlock;
  const isPledged = inst.payoutRedirect !== ZeroAddress;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Instrument #{id}</h1>
        <StatusBadge status={status} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 rounded-lg border border-border bg-panel p-5 text-sm sm:grid-cols-2">
        <Detail label="Drawer" value={shortenAddress(inst.drawer)} />
        <Detail label="Drawee" value={shortenAddress(inst.drawee)} />
        <Detail label="Beneficiary" value={shortenAddress(inst.beneficiary)} />
        <Detail label="Amount" value={`${formatEther(inst.amount)} CTC`} />
        <Detail label="Expiry block" value={`${inst.expiryBlock} ${isExpired ? "(passed)" : ""}`} />
        <Detail label="Payout redirect" value={isPledged ? shortenAddress(inst.payoutRedirect) : "none"} />
        <div className="sm:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Required document hash</span>
          <p className="mt-1 break-all font-mono text-xs text-ink">{inst.requiredDocumentHash}</p>
        </div>
      </div>

      {!address && (
        <div className="mt-6 rounded-lg border border-border bg-panel p-4">
          <p className="text-sm text-muted">Connect the drawee or beneficiary wallet to act on this instrument.</p>
          <div className="mt-3">
            <ConnectButton />
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      {isDrawee && status === "Issued" && !isExpired && (
        <Action title="Fund this instrument">
          <button onClick={handleFund} disabled={busy === "fund"} className="btn-primary">
            {busy === "fund" ? "Funding..." : `Fund ${formatEther(inst.amount)} CTC`}
          </button>
        </Action>
      )}

      {isBeneficiary && status === "Funded" && !isExpired && !presentedTxHash && (
        <Action title="Present the document">
          <p className="text-sm text-muted">
            Enter the exact document text agreed at issuance. Its hash has to match the one stored on-chain.
          </p>
          <textarea
            value={documentText}
            onChange={(e) => setDocumentText(e.target.value)}
            rows={3}
            className="input mt-3"
            placeholder="shipment-42: 25t cocoa, Lagos to Rotterdam, vessel MV Aurora"
          />
          <button
            onClick={handlePresent}
            disabled={busy === "present" || !documentText}
            className="btn-primary mt-3"
          >
            {busy === "present" ? "Presenting on Sepolia..." : "Present on Sepolia"}
          </button>
        </Action>
      )}

      {presentedTxHash && !relayJob && (
        <Action title="Prove it on Creditcoin">
          <p className="text-sm text-muted">
            Presented on Sepolia:{" "}
            <span className="font-mono text-xs">{presentedTxHash}</span>. Now ask the Attestcoin
            Protocol to prove it and release the escrow.
          </p>
          <button onClick={handleVerify} disabled={busy === "verify"} className="btn-primary mt-3">
            {busy === "verify" ? "Starting..." : "Verify & release"}
          </button>
        </Action>
      )}

      {relayJob && (
        <Action title="Attestcoin proof status">
          <RelaySteps status={relayJob.status} />
          {relayJob.status === "error" && (
            <p className="mt-3 text-sm text-red-500">{relayJob.error ?? "Something went wrong."}</p>
          )}
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-muted">Show details</summary>
            <div className="mt-2 max-h-48 overflow-y-auto rounded-md bg-background p-3 font-mono text-xs text-muted">
              {relayJob.log?.map((line: string, i: number) => <div key={i}>{line}</div>)}
              {relayJob.log?.length === 0 && <div>Starting...</div>}
            </div>
          </details>
          {relayJob.status === "waiting-for-attestation" && (
            <p className="mt-3 text-xs text-muted">
              Attestcoin has to see this transaction&apos;s block and prove it on Creditcoin. That
              takes several minutes on testnet. This keeps polling on its own, the page is safe to
              leave open or come back to later.
            </p>
          )}
        </Action>
      )}

      {isBeneficiary && status === "Funded" && !isPledged && !isExpired && (
        <Action title="Borrow against this instrument">
          <p className="text-sm text-muted">
            Borrow 80% of the instrument now from AvalCollateralVault. The loan repays itself out of
            the payout the moment the instrument is honored.
          </p>
          <button onClick={handlePledgeAndBorrow} disabled={busy === "borrow"} className="btn-secondary mt-3">
            {busy === "borrow" ? "Borrowing..." : `Borrow ${formatEther((inst.amount * 80n) / 100n)} CTC`}
          </button>
        </Action>
      )}

      {(status === "Issued" || status === "Funded") && isExpired && (
        <Action title="This instrument has expired">
          <button onClick={handleMarkExpired} disabled={busy === "expire"} className="btn-secondary">
            {busy === "expire" ? "Marking expired..." : "Mark expired and refund"}
          </button>
        </Action>
      )}

      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">History</h2>
          <div className="mt-3 flex flex-col gap-2">
            {history.map((entry, i) => (
              <div key={i} className="rounded-md border border-border bg-panel p-3 text-sm">
                <span className="font-medium text-ink">{entry.label}</span>
                <span className="ml-2 text-muted">{entry.detail}</span>
                <p className="mt-1 break-all font-mono text-xs text-muted">{entry.txHash}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      <p className="mt-1 text-ink">{value}</p>
    </div>
  );
}

function Action({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-lg border border-border bg-panel p-5">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

const RELAY_STEPS = [
  { key: "waiting-for-mining", label: "Mined on Sepolia" },
  { key: "waiting-for-attestation", label: "Attested by Attestcoin" },
  { key: "generating-proof", label: "Proof generated" },
  { key: "submitting", label: "Verified on Creditcoin" },
  { key: "done", label: "Honored" },
] as const;

function RelaySteps({ status }: { status: string }) {
  const currentIndex = status === "error" ? -1 : RELAY_STEPS.findIndex((s) => s.key === status);

  return (
    <div className="flex flex-col gap-2">
      {RELAY_STEPS.map((step, i) => {
        const isDone = status === "done" ? true : i < currentIndex;
        const isCurrent = i === currentIndex && status !== "done";
        return (
          <div key={step.key} className="flex items-center gap-3 text-sm">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                isDone
                  ? "bg-emerald-500"
                  : isCurrent
                    ? "animate-pulse bg-accent"
                    : "bg-border"
              }`}
            />
            <span className={isDone || isCurrent ? "text-ink" : "text-muted"}>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}
