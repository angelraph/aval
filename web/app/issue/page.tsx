"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Contract, ZeroAddress, keccak256, parseEther, parseUnits, toUtf8Bytes } from "ethers";
import { useWallet } from "@/lib/WalletContext";
import { CREDITCOIN_TESTNET } from "@/lib/wallet";
import {
  AVAL_INSTRUMENT_ADDRESS,
  AVAL_TEST_TOKEN_ADDRESS,
  AVAL_TEST_TOKEN_SYMBOL,
  AVAL_TEST_TOKEN_DECIMALS,
  AvalInstrumentABI,
  AvalTestTokenABI,
} from "@/lib/contracts";
import { getCreditcoinReadProvider } from "@/lib/readProvider";
import { ConnectButton } from "@/components/ConnectButton";

export default function IssuePage() {
  const { address, connect, getSigner, switchNetwork } = useWallet();
  const router = useRouter();

  const [drawee, setDrawee] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [settleInToken, setSettleInToken] = useState(false);
  const [amount, setAmount] = useState("0.1");
  const [documentText, setDocumentText] = useState("");
  const [expiryBlocks, setExpiryBlocks] = useState("50000");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mintTo, setMintTo] = useState("");
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintDone, setMintDone] = useState<string | null>(null);

  useEffect(() => {
    if (address && !mintTo) setMintTo(address);
  }, [address, mintTo]);

  async function handleMint() {
    setMintError(null);
    setMintDone(null);
    setMinting(true);
    try {
      if (!address) await connect();
      await switchNetwork(CREDITCOIN_TESTNET);
      const signer = await getSigner();
      const token = new Contract(AVAL_TEST_TOKEN_ADDRESS, AvalTestTokenABI, signer);
      const tx = await token.mint(mintTo, parseUnits("1000", AVAL_TEST_TOKEN_DECIMALS));
      await tx.wait();
      setMintDone(`Minted 1,000 ${AVAL_TEST_TOKEN_SYMBOL} to that address.`);
    } catch (err: any) {
      setMintError(err.shortMessage ?? err.message ?? String(err));
    } finally {
      setMinting(false);
    }
  }

  const documentHash = documentText ? keccak256(toUtf8Bytes(documentText)) : null;

  // Attesting a presentment realistically takes several minutes on testnet. An expiry shorter
  // than that isn't wrong, exactly, it's just guaranteed to lapse before the proof can land,
  // which is worth flagging rather than silently letting someone issue an instrument that
  // can never be honored.
  const SAFE_MIN_EXPIRY_BLOCKS = 2000;
  const expiryTooShort = Number(expiryBlocks) > 0 && Number(expiryBlocks) < SAFE_MIN_EXPIRY_BLOCKS;

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
      <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Issue an instrument</h1>
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

        {settleInToken && AVAL_TEST_TOKEN_ADDRESS && (
          <div className="rounded-lg border border-border bg-panel p-4">
            <p className="text-sm font-medium text-ink">Need test {AVAL_TEST_TOKEN_SYMBOL}?</p>
            <p className="mt-1 text-xs text-muted">
              Mint some for free, to any address. Whoever funds this instrument (the drawee) needs
              enough {AVAL_TEST_TOKEN_SYMBOL} in their wallet to fund it.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={mintTo}
                onChange={(e) => setMintTo(e.target.value)}
                placeholder="0x... (defaults to your connected wallet)"
                className="input"
              />
              <button
                type="button"
                onClick={handleMint}
                disabled={minting || !mintTo}
                className="btn-secondary shrink-0"
              >
                {minting ? "Minting..." : `Mint 1,000 ${AVAL_TEST_TOKEN_SYMBOL}`}
              </button>
            </div>
            {mintDone && <p className="mt-2 text-xs text-emerald-600">{mintDone}</p>}
            {mintError && <p className="mt-2 text-xs text-red-500">{mintError}</p>}
          </div>
        )}

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
          {expiryTooShort && (
            <p className="mt-1.5 text-xs text-amber-600">
              Presenting and proving a document usually takes several minutes on testnet. An
              expiry this short will likely lapse before that finishes, use it only if you mean to
              test expiry itself.
            </p>
          )}
        </Field>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button type="submit" disabled={submitting} className="btn-primary">
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
