"use client";

import { useCallback, useEffect, useState } from "react";
import { Contract, formatEther, parseEther } from "ethers";
import { useWallet } from "@/lib/WalletContext";
import { switchNetwork, CREDITCOIN_TESTNET } from "@/lib/wallet";
import { AVAL_COLLATERAL_VAULT_ADDRESS, AvalCollateralVaultABI } from "@/lib/contracts";
import { getCreditcoinReadProvider } from "@/lib/readProvider";
import { ConnectButton } from "@/components/ConnectButton";

export default function VaultPage() {
  const { address, connect, getSigner } = useWallet();

  const [availableLiquidity, setAvailableLiquidity] = useState<bigint | null>(null);
  const [totalLenderPrincipal, setTotalLenderPrincipal] = useState<bigint | null>(null);
  const [myPrincipal, setMyPrincipal] = useState<bigint | null>(null);
  const [amount, setAmount] = useState("0.05");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!AVAL_COLLATERAL_VAULT_ADDRESS) return;
    const provider = getCreditcoinReadProvider();
    const vault = new Contract(AVAL_COLLATERAL_VAULT_ADDRESS, AvalCollateralVaultABI, provider);

    const [liquidity, total] = await Promise.all([vault.availableLiquidity(), vault.totalLenderPrincipal()]);
    setAvailableLiquidity(liquidity);
    setTotalLenderPrincipal(total);

    if (address) {
      setMyPrincipal(await vault.lenderPrincipal(address));
    }
  }, [address]);

  useEffect(() => {
    refresh().catch((err) => setError(err.message ?? String(err)));
    const interval = setInterval(() => refresh().catch(() => {}), 15_000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function handleDeposit() {
    setError(null);
    setBusy("deposit");
    try {
      if (!address) await connect();
      await switchNetwork(CREDITCOIN_TESTNET);
      const signer = await getSigner();
      const vault = new Contract(AVAL_COLLATERAL_VAULT_ADDRESS, AvalCollateralVaultABI, signer);
      const tx = await vault.deposit({ value: parseEther(amount) });
      await tx.wait();
      await refresh();
    } catch (err: any) {
      setError(err.shortMessage ?? err.message ?? String(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleWithdraw() {
    setError(null);
    setBusy("withdraw");
    try {
      await switchNetwork(CREDITCOIN_TESTNET);
      const signer = await getSigner();
      const vault = new Contract(AVAL_COLLATERAL_VAULT_ADDRESS, AvalCollateralVaultABI, signer);
      const tx = await vault.withdraw(parseEther(amount));
      await tx.wait();
      await refresh();
    } catch (err: any) {
      setError(err.shortMessage ?? err.message ?? String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-10 sm:px-8 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Lending pool</h1>
      <p className="mt-2 text-sm text-muted">
        Lend into AvalCollateralVault. Beneficiaries borrow up to 80% of a funded instrument here,
        and loans repay themselves automatically when Attestcoin proves the presentation.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 rounded-lg border border-border bg-panel p-5 text-sm">
        <div>
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Available to lend</span>
          <p className="mt-1 text-lg font-medium text-ink">
            {availableLiquidity !== null ? `${formatEther(availableLiquidity)} CTC` : "..."}
          </p>
        </div>
        <div>
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Total deposited</span>
          <p className="mt-1 text-lg font-medium text-ink">
            {totalLenderPrincipal !== null ? `${formatEther(totalLenderPrincipal)} CTC` : "..."}
          </p>
        </div>
        {address && (
          <div className="col-span-2 border-t border-border pt-4">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Your deposit</span>
            <p className="mt-1 text-lg font-medium text-ink">
              {myPrincipal !== null ? `${formatEther(myPrincipal)} CTC` : "..."}
            </p>
          </div>
        )}
      </div>

      {!address && (
        <div className="mt-6 rounded-lg border border-border bg-panel p-4">
          <p className="text-sm text-muted">Connect a wallet to lend or withdraw.</p>
          <div className="mt-3">
            <ConnectButton />
          </div>
        </div>
      )}

      <div className="mt-6 rounded-lg border border-border bg-panel p-5">
        <label className="block text-sm font-medium text-ink">Amount (CTC)</label>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
          step="0.001"
          min="0"
          className="input mt-1.5"
        />
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        <div className="mt-4 flex gap-3">
          <button onClick={handleDeposit} disabled={busy === "deposit"} className="btn-primary">
            {busy === "deposit" ? "Depositing..." : "Deposit"}
          </button>
          <button onClick={handleWithdraw} disabled={busy === "withdraw"} className="btn-secondary">
            {busy === "withdraw" ? "Withdrawing..." : "Withdraw"}
          </button>
        </div>
      </div>
    </div>
  );
}
