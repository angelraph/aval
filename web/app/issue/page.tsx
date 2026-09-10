"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Contract, ZeroAddress, keccak256, parseEther, parseUnits, toUtf8Bytes } from "ethers";
import { useWallet } from "@/lib/WalletContext";
import { switchNetwork, CREDITCOIN_TESTNET } from "@/lib/wallet";
import {
  AVAL_INSTRUMENT_ADDRESS,
  AVAL_TEST_TOKEN_ADDRESS,
  AVAL_TEST_TOKEN_SYMBOL,
  AVAL_TEST_TOKEN_DECIMALS,
  AvalInstrumentABI,
} from "@/lib/contracts";
import { getCreditcoinReadProvider } from "@/lib/readProvider";
import { ConnectButton } from "@/components/ConnectButton";

export default function IssuePage() {
  const { address, connect, getSigner } = useWallet();
  const router = useRouter();

  const [drawee, setDrawee] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [settleInToken, setSettleInToken] = useState(false);
  const [amount, setAmount] = useState("0.1");
  const [documentText, setDocumentText] = useState("");
  const [expiryBlocks, setExpiryBlocks] = useState("50000");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const documentHash = documentText ? keccak256(toUtf8Bytes(documentText)) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!AVAL_INSTRUMENT_ADDRESS) {
      setError("AvalInstrument is not deployed yet.");
      return;
    }

    setSubmitting(true);
    try {
      if (!address) await connect();
      await switchNetwork(CREDITCOIN_TESTNET);
      const signer = await getSigner();

      const readProvider = getCreditcoinReadProvider();
      const currentBlock = await readProvider.getBlockNumber();
      const expiryBlock = currentBlock + Number(expiryBlocks);

      const token = settleInToken ? AVAL_TEST_TOKEN_ADDRESS : ZeroAddress;
      const parsedAmount = settleInToken ? parseUnits(amount, AVAL_TEST_TOKEN_DECIMALS) : parseEther(amount);

      const instrument = new Contract(AVAL_INSTRUMENT_ADDRESS, AvalInstrumentABI, signer);
      const tx = await instrument.issue(
        drawee,
        beneficiary,
        token,
        parsedAmount,
        keccak256(toUtf8Bytes(documentText)),
        expiryBlock
      );
      const receipt = await tx.wait();

      const issuedEvent = receipt.logs
        .map((log: any) => {
          try {
            return instrument.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsed: any) => parsed?.name === "InstrumentIssued");

      const id = issuedEvent?.args?.id?.toString();
      if (id) {
        router.push(`/instrument/${id}`);
      } else {
        router.push("/desk");
      }
    } catch (err: any) {
      setError(err.shortMessage ?? err.message ?? String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-10 sm:px-8 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Issue an instrument</h1>
      <p className="mt-2 text-sm text-muted">
        You&apos;re the drawer. Set the terms, and the drawee funds it next.
      </p>

      {!address && (
        <div className="mt-6 rounded-lg border border-border bg-panel p-4">
          <p className="text-sm text-muted">Connect your wallet to issue an instrument.</p>
          <div className="mt-3">
            <ConnectButton />
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
        <Field label="Drawee (funds the escrow)">
          <input
            required
            value={drawee}
            onChange={(e) => setDrawee(e.target.value)}
            placeholder="0x..."
            className="input"
          />
        </Field>

        <Field label="Beneficiary (gets paid)">
          <input
            required
            value={beneficiary}
            onChange={(e) => setBeneficiary(e.target.value)}
            placeholder="0x..."
            className="input"
          />
        </Field>

        <Field label="Settle in">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSettleInToken(false)}
              className={!settleInToken ? "btn-secondary border-accent" : "btn-secondary"}
            >
              Native CTC
            </button>
            <button
              type="button"
              onClick={() => setSettleInToken(true)}
              disabled={!AVAL_TEST_TOKEN_ADDRESS}
              className={settleInToken ? "btn-secondary border-accent" : "btn-secondary"}
              title={!AVAL_TEST_TOKEN_ADDRESS ? "AvalTestToken is not deployed yet" : undefined}
            >
              {AVAL_TEST_TOKEN_SYMBOL} (test stablecoin)
            </button>
          </div>
        </Field>

        <Field label={`Amount (${settleInToken ? AVAL_TEST_TOKEN_SYMBOL : "CTC"})`}>
          <input
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            step="0.001"
            min="0"
            className="input"
          />
        </Field>

        <Field label="Document (e.g. shipment details, or a bill of lading reference)">
          <textarea
            required
            value={documentText}
            onChange={(e) => setDocumentText(e.target.value)}
            rows={3}
            placeholder="shipment-42: 25t cocoa, Lagos to Rotterdam, vessel MV Aurora"
            className="input"
          />
          {documentHash && (
            <p className="mt-1.5 break-all font-mono text-xs text-muted">hash: {documentHash}</p>
          )}
        </Field>

        <Field label="Expires in (blocks from now)">
          <input
            required
            value={expiryBlocks}
            onChange={(e) => setExpiryBlocks(e.target.value)}
            type="number"
            min="1"
            className="input"
          />
        </Field>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? "Issuing..." : "Issue instrument"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
