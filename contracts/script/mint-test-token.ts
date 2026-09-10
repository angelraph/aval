import { ethers } from 'ethers';
import { loadEnv, requireEnv, pickSigningKey } from './lib/env';
import { loadArtifact } from './lib/artifacts';

loadEnv();

/** Mints AvalTestToken to an address. Usage: tsx script/mint-test-token.ts <to> <amount> */
async function main() {
  const rpcUrl = requireEnv('CREDITCOIN_RPC_URL');
  const privateKey = pickSigningKey(process.argv);
  const tokenAddress = requireEnv('AVAL_TEST_TOKEN_ADDRESS');

  const [to, amount] = process.argv.slice(2);
  if (!to || !amount) {
    throw new Error('Usage: tsx script/mint-test-token.ts <to> <amount>');
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const { abi } = loadArtifact('AvalTestToken');
  const token = new ethers.Contract(tokenAddress, abi, wallet);

  const tx = await token.mint(to, amount);
  const receipt = await tx.wait();
  console.log(`Minted ${amount} aTUSD to ${to}. Tx hash: ${receipt.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
