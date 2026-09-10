import { JsonRpcProvider } from "ethers";
import { CREDITCOIN_TESTNET, SEPOLIA } from "./contracts";

let creditcoinProvider: JsonRpcProvider | null = null;
let sepoliaProvider: JsonRpcProvider | null = null;

/** A read-only provider for Creditcoin CC3 testnet, usable without a connected wallet. */
export function getCreditcoinReadProvider(): JsonRpcProvider {
  if (!creditcoinProvider) {
    creditcoinProvider = new JsonRpcProvider(CREDITCOIN_TESTNET.rpcUrl);
  }
  return creditcoinProvider;
}

/** A read-only provider for Sepolia, usable without a connected wallet. */
export function getSepoliaReadProvider(): JsonRpcProvider {
  if (!sepoliaProvider) {
    sepoliaProvider = new JsonRpcProvider(SEPOLIA.rpcUrl);
  }
  return sepoliaProvider;
}
