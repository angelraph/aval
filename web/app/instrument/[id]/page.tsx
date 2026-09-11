"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { Contract, formatEther, keccak256, toUtf8Bytes, ZeroAddress } from "ethers";
import { useWallet } from "@/lib/WalletContext";
import { CREDITCOIN_TESTNET, SEPOLIA, shortenAddress } from "@/lib/wallet";
import {
  AVAL_INSTRUMENT_ADDRESS,
  AVAL_PRESENTMENT_ADDRESS,
  AVAL_COLLATERAL_VAULT_ADDRESS,
  AVAL_INSTRUMENT_DEPLOY_BLOCK,
  AvalInstrumentABI,
  AvalPresentmentABI,
  AvalCollateralVaultABI,
  AvalTestTokenABI,
  InstrumentStatus,
} from "@/lib/contracts";
import { getCreditcoinReadProvider } from "@/lib/readProvider";
import { queryFilterChunked } from "@/lib/queryLogs";
import type { RelayState } from "@/lib/proofRelay";
import { formatInstrumentAmount, isNativeToken } from "@/lib/tokenFormat";
import { StatusBadge } from "@/components/StatusBadge";
import { ConnectButton } from "@/components/ConnectButton";

interface InstrumentData {
  drawer: string;
  drawee: string;
  beneficiary: string;
  token: string;
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
  const { address, connect, getSigner, switchNetwork } = useWallet();

  const [inst, setInst] = useState<InstrumentData | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentBlock, setCurrentBlock] = useState<bigint>(0n);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [documentText, setDocumentText] = useState("");
  const [presentedTxHash, setPresentedTxHash] = useState<string | null>(null);
  const [relayState, setRelayState] = useState<RelayState | null>(null);
  const [relayLog, setRelayLog] = useState<string[]>([]);
  const relayInFlight = useRef(false);
  const persistKey = `aval:relay:${id}`;

  // Everything about the verify step lives in the browser, not on the server, so a reload or a
  // closed tab shouldn't throw away several minutes of progress. Restore it once on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(persistKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setPresentedTxHash(parsed.presentedTxHash ?? null);
        setRelayState(parsed.relayState ?? null);
        setRelayLog(parsed.relayLog ?? []);
      }
    } catch {
      // Ignore a corrupt or inaccessible localStorage entry, just start fresh.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      if (presentedTxHash) {
        localStorage.setItem(persistKey, JSON.stringify({ presentedTxHash, relayState, relayLog }));
      } else {
        localStorage.removeItem(persistKey);
      }
    } catch {
      // Not essential, worst case a reload just loses the in-progress state.
    }
  }, [persistKey, presentedTxHash, relayState, relayLog]);

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
        detail: `${formatInstrumentAmount(parsed!.args.amount, data.token)} locked in escrow`,
        txHash: log.transactionHash,
      });
    }
    for (const log of honoredLogs) {
      const parsed = contract.interface.parseLog(log);
      entries.push({
        label: "Honored",
        detail: `Paid ${formatInstrumentAmount(parsed!.args.amount, data.token)} to ${shortenAddress(parsed!.args.paidTo)}, document hash ${parsed!.args.documentHash}`,
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
    if (!relayState || relayState.phase === "done" || relayState.phase === "error") return;

    const interval = setInterval(async () => {
      if (relayInFlight.current) return; // never overlap two steps
      relayInFlight.current = true;
      try {
        const res = await fetch("/api/verify-proof", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instrumentId: id, sourceTxHash: presentedTxHash, state: relayState }),
        });
        const data = await res.json();
        if (!res.ok) {
          setRelayState({ phase: "error", error: data.error ?? "Request failed" });
          return;
        }
        setRelayLog((prev) => [...prev, ...data.log]);
        setRelayState(data.state);
        if (data.state.phase === "done") refresh().catch(() => {});
      } catch (err: any) {
        // A single failed request (network blip, cold start) isn't fatal, the interval just
        // tries again with the same state on the next tick.
        setRelayLog((prev) => [...prev, `Request failed, retrying: ${err.message ?? err}`]);
      } finally {
        relayInFlight.current = false;
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [relayState, presentedTxHash, id, refresh]);

  async function handleFund() {
    if (!inst) return;
    setError(null);
    setBusy("fund");
    try {
      if (!address) await connect();
      await switchNetwork(CREDITCOIN_TESTNET);
      const signer = await getSigner();
      const contract = new Contract(AVAL_INSTRUMENT_ADDRESS, AvalInstrumentABI, signer);

      if (isNativeToken(inst.token)) {
        const tx = await contract.fund(id, { value: inst.amount });
        await tx.wait();
      } else {
        const token = new Contract(inst.token, AvalTestTokenABI, signer);
        const allowance: bigint = await token.allowance(address, AVAL_INSTRUMENT_ADDRESS);
        if (allowance < inst.amount) {
          const approveTx = await token.approve(AVAL_INSTRUMENT_ADDRESS, inst.amount);
          await approveTx.wait();
        }
        const tx = await contract.fund(id);
        await tx.wait();
      }
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

    const hash = keccak256(toUtf8Bytes(documentText));
    if (inst && hash !== inst.requiredDocumentHash) {
      setError(
        "That doesn't match the document this instrument was issued with. Check for typos, even a " +
          "single character off gives a different hash and this will fail after the wait, not before it."
      );
      return;
    }

    setBusy("present");
    try {
      if (!address) await connect();
      await switchNetwork(SEPOLIA);
      const signer = await getSigner();
      const contract = new Contract(AVAL_PRESENTMENT_ADDRESS, AvalPresentmentABI, signer);
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
    setRelayLog([]);
    try {
      const initialState: RelayState = { phase: "waiting-for-mining" };
      const res = await fetch("/api/verify-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instrumentId: id, sourceTxHash: presentedTxHash, state: initialState }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start verification");
      setRelayLog(data.log ?? []);
      setRelayState(data.state);
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
        <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Instrument #{id}</h1>
        <StatusBadge status={status} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 rounded-lg border border-border bg-panel p-5 text-sm sm:grid-cols-2">
        <Detail label="Drawer" value={shortenAddress(inst.drawer)} />
        <Detail label="Drawee" value={shortenAddress(inst.drawee)} />
        <Detail label="Beneficiary" value={shortenAddress(inst.beneficiary)} />
        <Detail label="Amount" value={formatInstrumentAmount(inst.amount, inst.token)} />
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
            {busy === "fund" ? "Funding..." : `Fund ${formatInstrumentAmount(inst.amount, inst.token)}`}
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
          {documentText && keccak256(toUtf8Bytes(documentText)) !== inst.requiredDocumentHash && (
            <p className="mt-1.5 text-xs text-amber-600">
              This doesn&apos;t match yet, check it against exactly what was typed at issuance.
            </p>
          )}
          <button
            onClick={handlePresent}
            disabled={busy === "present" || !documentText}
            className="btn-primary mt-3"
          >
            {busy === "present" ? "Presenting on Sepolia..." : "Present on Sepolia"}
          </button>
        </Action>
      )}

      {presentedTxHash && !relayState && (
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

      {relayState && (
        <Action title="Attestcoin proof status">
          <RelaySteps status={relayState.phase} />
          {relayState.phase === "error" && (
            <>
              <p className="mt-3 text-sm text-red-500">{relayState.error ?? "Something went wrong."}</p>
              <button onClick={handleVerify} disabled={busy === "verify"} className="btn-secondary mt-3">
                {busy === "verify" ? "Retrying..." : "Try again"}
              </button>
            </>
          )}
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-muted">Show details</summary>
            <div className="mt-2 max-h-48 overflow-y-auto rounded-md bg-background p-3 font-mono text-xs text-muted">
              {relayLog.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
              {relayLog.length === 0 && <div>Starting...</div>}
            </div>
          </details>
          {relayState.phase === "waiting-for-attestation" && (
            <p className="mt-3 text-xs text-muted">
              Attestcoin has to see this transaction&apos;s block and prove it on Creditcoin. That
              takes several minutes on testnet. This keeps polling on its own, and it's safe to
              close the tab and come back, it'll pick back up from here.
            </p>
          )}
        </Action>
      )}

      {isBeneficiary && status === "Funded" && !isPledged && !isExpired && isNativeToken(inst.token) && (
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

      {isBeneficiary && status === "Funded" && !isExpired && !isNativeToken(inst.token) && (
        <Action title="Borrow against this instrument">
          <p className="text-sm text-muted">
            Not available for this instrument. AvalCollateralVault only lends against native CTC
            instruments right now, this one is settled in an ERC20, so there&apos;s no borrow
            option here.
          </p>
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
