"use client";

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { BrowserProvider, JsonRpcSigner } from "ethers";
import { connectWallet, getBrowserProvider, hasInjectedWallet } from "./wallet";

interface WalletState {
  address: string | null;
  chainId: string | null;
  connecting: boolean;
  connect: () => Promise<void>;
  getSigner: () => Promise<JsonRpcSigner>;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const account = await connectWallet();
      setAddress(account);
      const provider = getBrowserProvider();
      const network = await provider.getNetwork();
      setChainId("0x" + network.chainId.toString(16));
    } finally {
      setConnecting(false);
    }
  }, []);

  const getSigner = useCallback(async () => {
    const provider = getBrowserProvider();
    return provider.getSigner();
  }, []);

  useEffect(() => {
    if (!hasInjectedWallet()) return;

    const handleAccountsChanged = (accounts: string[]) => {
      setAddress(accounts[0] ?? null);
    };
    const handleChainChanged = (newChainId: string) => {
      setChainId(newChainId);
    };

    window.ethereum.on?.("accountsChanged", handleAccountsChanged);
    window.ethereum.on?.("chainChanged", handleChainChanged);

    // Pick up an already-connected account without prompting.
    (async () => {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.listAccounts();
      if (accounts[0]) {
        setAddress(accounts[0].address);
        const network = await provider.getNetwork();
        setChainId("0x" + network.chainId.toString(16));
      }
    })();

    return () => {
      window.ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  return (
    <WalletContext.Provider value={{ address, chainId, connecting, connect, getSigner }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside a WalletProvider");
  return ctx;
}
