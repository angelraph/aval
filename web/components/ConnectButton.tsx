"use client";

import { useWallet } from "@/lib/WalletContext";
import { shortenAddress, hasInjectedWallet } from "@/lib/wallet";

export function ConnectButton() {
  const { address, connecting, connect } = useWallet();

  if (address) {
    return (
      <span className="rounded-md border border-border bg-panel px-3 py-1.5 text-sm text-ink">
        {shortenAddress(address)}
      </span>
    );
  }

  return (
    <button
      onClick={() => {
        if (!hasInjectedWallet()) {
          window.open("https://metamask.io/download/", "_blank");
          return;
        }
        connect().catch((err) => console.error(err));
      }}
      disabled={connecting}
      className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
    >
      {connecting ? "Connecting..." : "Connect wallet"}
    </button>
  );
}
