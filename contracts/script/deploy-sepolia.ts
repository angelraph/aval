import { ethers } from 'ethers';
import { loadEnv, requireEnv } from './lib/env';
import { loadArtifact } from './lib/artifacts';
import { updateEnvValue } from './lib/updateEnv';

loadEnv();

async function main() {
  const rpcUrl = requireEnv('SOURCE_CHAIN_RPC_URL');
  const privateKey = requireEnv('CREDITCOIN_WALLET_PRIVATE_KEY');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log(`Deploying AvalPresentment to Sepolia from ${wallet.address}...`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer Sepolia ETH balance: ${ethers.formatEther(balance)}`);
  if (balance === 0n) {
    throw new Error(
      `Deployer ${wallet.address} has no Sepolia ETH. Fund it from a Sepolia faucet before deploying.`
    );
  }

  const { abi, bytecode } = loadArtifact('AvalPresentment');
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`AvalPresentment deployed to: ${address}`);

  updateEnvValue('AVAL_PRESENTMENT_ADDRESS', address);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
