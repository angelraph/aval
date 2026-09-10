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

export function getBrowserProvider(): BrowserProvider {
  if (!hasInjectedWallet()) {
    throw new Error("No wallet found. Install MetaMask or another injected wallet to continue.");
  }
  return new BrowserProvider(window.ethereum);
}

export async function connectWallet(): Promise<string> {
  const provider = getBrowserProvider();
  const accounts = await provider.send("eth_requestAccounts", []);
  return accounts[0];
}

type NetworkConfig = typeof CREDITCOIN_TESTNET | typeof SEPOLIA;

/** Switches the wallet to the given network, adding it first if the wallet doesn't know it yet. */
export async function switchNetwork(network: NetworkConfig): Promise<void> {
  if (!hasInjectedWallet()) {
    throw new Error("No wallet found.");
  }
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: network.chainIdHex }],
    });
  } catch (error: any) {
    // 4902 = the chain hasn't been added to the wallet yet
    if (error?.code === 4902) {
      await window.ethereum.request({
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
