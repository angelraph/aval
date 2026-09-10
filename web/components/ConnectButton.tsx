"use client";

import { useState } from "react";
import { useWallet } from "@/lib/WalletContext";
import { shortenAddress, hasInjectedWallet } from "@/lib/wallet";

export function ConnectButton() {
  const { address, connecting, wallets, activeWalletName, connect } = useWallet();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (address) {
    return (
      <span className="rounded-md border border-border bg-panel px-3 py-1.5 text-sm text-ink">
        {activeWalletName ? `${activeWalletName}: ` : ""}
        {shortenAddress(address)}
      </span>
    );
  }

  function handleClick() {
    if (wallets.length > 1) {
      setPickerOpen((open) => !open);
      return;
    }
    if (wallets.length === 0 && !hasInjectedWallet()) {
      window.open("https://metamask.io/download/", "_blank");
      return;
    }
    connect(wallets[0]).catch((err) => console.error(err));
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={connecting}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
      >
        {connecting ? "Connecting..." : "Connect wallet"}
      </button>

      {pickerOpen && wallets.length > 1 && (
        <div className="absolute right-0 top-full z-10 mt-2 w-56 rounded-md border border-border bg-panel p-1.5 shadow-lg">
          {wallets.map((wallet) => (
            <button
              key={wallet.info.uuid}
              onClick={() => {
                setPickerOpen(false);
                connect(wallet).catch((err) => console.error(err));
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-ink hover:bg-background"
            >
              {wallet.info.icon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={wallet.info.icon} alt="" className="h-5 w-5 shrink-0 rounded" />
              )}
              {wallet.info.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
