"use client";

import { BrowserProvider } from "ethers";
import { CREDITCOIN_TESTNET, SEPOLIA } from "./contracts";

declare global {
  interface Window {
    ethereum?: any;
  }
}

export function hasInjectedWallet(): boolean {
  return typeof window !== "undefined" && !!window.ethereum;
}

/**
 * Wraps a raw EIP-1193 provider (from an EIP-6963 wallet announcement, typically) in an ethers
 * BrowserProvider. Falls back to window.ethereum for wallets that only support the older,
 * single-provider convention.
 */
export function getBrowserProvider(rawProvider?: any): BrowserProvider {
  const raw = rawProvider ?? window.ethereum;
  if (!raw) {
    throw new Error("No wallet found. Install MetaMask or another wallet extension to continue.");
  }
  return new BrowserProvider(raw);
}

export async function connectWallet(rawProvider?: any): Promise<string> {
  const provider = getBrowserProvider(rawProvider);
  const accounts = await provider.send("eth_requestAccounts", []);
  return accounts[0];
}

type NetworkConfig = typeof CREDITCOIN_TESTNET | typeof SEPOLIA;

/** Switches the wallet to the given network, adding it first if the wallet doesn't know it yet. */
export async function switchNetwork(network: NetworkConfig, rawProvider?: any): Promise<void> {
  const raw = rawProvider ?? window.ethereum;
  if (!raw) {
    throw new Error("No wallet found.");
  }
  try {
    await raw.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: network.chainIdHex }],
    });
  } catch (error: any) {
    // 4902 = the chain hasn't been added to the wallet yet
    if (error?.code === 4902) {
      await raw.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: network.chainIdHex,
            chainName: network.chainName,
            rpcUrls: [network.rpcUrl],
            nativeCurrency: network.nativeCurrency,
            blockExplorerUrls: [network.blockExplorerUrl],
          },
        ],
      });
    } else {
      throw error;
    }
  }
}

export function shortenAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export { CREDITCOIN_TESTNET, SEPOLIA };
