"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { BrowserProvider, JsonRpcSigner } from "ethers";
import { connectWallet, getBrowserProvider, hasInjectedWallet, switchNetwork as switchNetworkRaw } from "./wallet";
import { subscribeToWallets, EIP6963ProviderDetail } from "./eip6963";
import { CREDITCOIN_TESTNET, SEPOLIA } from "./contracts";

const LAST_WALLET_KEY = "aval:lastWalletRdns";

type NetworkConfig = typeof CREDITCOIN_TESTNET | typeof SEPOLIA;

interface WalletState {
  address: string | null;
  chainId: string | null;
  connecting: boolean;
  wallets: EIP6963ProviderDetail[];
  activeWalletName: string | null;
  connect: (wallet?: EIP6963ProviderDetail) => Promise<void>;
  getSigner: () => Promise<JsonRpcSigner>;
  switchNetwork: (network: NetworkConfig) => Promise<void>;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [wallets, setWallets] = useState<EIP6963ProviderDetail[]>([]);
  const [activeWalletName, setActiveWalletName] = useState<string | null>(null);

  // The raw EIP-1193 provider currently in use, kept in a ref so it survives without triggering
  // re-renders, and so getSigner/switchNetwork always act on whichever wallet the user picked.
  const activeProvider = useRef<any>(null);

  useEffect(() => {
    return subscribeToWallets(setWallets);
  }, []);

  const connect = useCallback(async (wallet?: EIP6963ProviderDetail) => {
    setConnecting(true);
    try {
      const raw = wallet?.provider ?? activeProvider.current ?? (hasInjectedWallet() ? window.ethereum : null);
      if (!raw) {
        throw new Error("No wallet found. Install a wallet extension to continue.");
      }

      const account = await connectWallet(raw);
      activeProvider.current = raw;
      setAddress(account);
      setActiveWalletName(wallet?.info.name ?? "Wallet");

      if (wallet) {
        localStorage.setItem(LAST_WALLET_KEY, wallet.info.rdns);
      }

      const provider = getBrowserProvider(raw);
      const network = await provider.getNetwork();
      setChainId("0x" + network.chainId.toString(16));
    } finally {
      setConnecting(false);
    }
  }, []);

  const getSigner = useCallback(async () => {
    const raw = activeProvider.current ?? (hasInjectedWallet() ? window.ethereum : null);
    if (!raw) throw new Error("No wallet connected.");
    const provider = getBrowserProvider(raw);
    return provider.getSigner();
  }, []);

  const switchNetwork = useCallback(async (network: NetworkConfig) => {
    const raw = activeProvider.current ?? (hasInjectedWallet() ? window.ethereum : null);
    await switchNetworkRaw(network, raw);
  }, []);

  // Try to silently pick back up a previously connected wallet on reload, without prompting.
  useEffect(() => {
    if (wallets.length === 0) return;

    (async () => {
      const lastRdns = localStorage.getItem(LAST_WALLET_KEY);
      const remembered = lastRdns ? wallets.find((w) => w.info.rdns === lastRdns) : null;
      const candidate = remembered ?? (wallets.length === 1 ? wallets[0] : null);
      if (!candidate) return;

      try {
        const provider = new BrowserProvider(candidate.provider);
        const accounts = await provider.listAccounts();
        if (accounts[0]) {
          activeProvider.current = candidate.provider;
          setAddress(accounts[0].address);
          setActiveWalletName(candidate.info.name);
          const network = await provider.getNetwork();
          setChainId("0x" + network.chainId.toString(16));
        }
      } catch {
        // Not connected yet, that's fine, the user just hasn't approved this wallet.
      }
    })();
  }, [wallets]);

  useEffect(() => {
    const raw = activeProvider.current;
    if (!raw?.on) return;

    const handleAccountsChanged = (accounts: string[]) => {
      setAddress(accounts[0] ?? null);
    };
    const handleChainChanged = (newChainId: string) => {
      setChainId(newChainId);
    };

    raw.on("accountsChanged", handleAccountsChanged);
    raw.on("chainChanged", handleChainChanged);

    return () => {
      raw.removeListener?.("accountsChanged", handleAccountsChanged);
      raw.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [address]);

  return (
    <WalletContext.Provider
      value={{ address, chainId, connecting, wallets, activeWalletName, connect, getSigner, switchNetwork }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside a WalletProvider");
  return ctx;
}
