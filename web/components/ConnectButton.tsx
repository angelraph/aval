"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@/lib/WalletContext";
import { shortenAddress, hasInjectedWallet } from "@/lib/wallet";

export function ConnectButton() {
  const { address, connecting, wallets, activeWalletName, connect, disconnect } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  if (address) {
    return (
      <div className="relative" ref={containerRef}>
        <button
          onClick={() => setMenuOpen((open) => !open)}
          className="flex items-center gap-2 rounded-full border border-border bg-panel px-3 py-1.5 text-sm text-ink hover:border-accent"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
          {activeWalletName ? `${activeWalletName} ` : ""}
          {shortenAddress(address)}
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-10 mt-2 w-52 rounded-md border border-border bg-panel p-1.5 shadow-lg">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(address).catch(() => {});
                setMenuOpen(false);
              }}
              className="flex w-full items-center rounded-md px-2.5 py-2 text-left text-sm text-ink hover:bg-background"
            >
              Copy address
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                disconnect();
              }}
              className="flex w-full items-center rounded-md px-2.5 py-2 text-left text-sm text-red-500 hover:bg-background"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  function handleClick() {
    if (wallets.length > 1) {
      setMenuOpen((open) => !open);
      return;
    }
    if (wallets.length === 0 && !hasInjectedWallet()) {
      window.open("https://metamask.io/download/", "_blank");
      return;
    }
    connect(wallets[0]).catch((err) => console.error(err));
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={handleClick}
        disabled={connecting}
        className="rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
      >
        {connecting ? "Connecting..." : "Connect wallet"}
      </button>

      {menuOpen && wallets.length > 1 && (
        <div className="absolute right-0 top-full z-10 mt-2 w-56 rounded-md border border-border bg-panel p-1.5 shadow-lg">
          {wallets.map((wallet) => (
            <button
              key={wallet.info.uuid}
              onClick={() => {
                setMenuOpen(false);
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
