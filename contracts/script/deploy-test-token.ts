import { ethers } from 'ethers';
import { loadEnv, requireEnv } from './lib/env';
import { loadArtifact } from './lib/artifacts';
import { updateEnvValue } from './lib/updateEnv';

loadEnv();

/** Deploys AvalTestToken to Creditcoin CC3 testnet, for demoing an ERC20-settled instrument. */
async function main() {
  const rpcUrl = requireEnv('CREDITCOIN_RPC_URL');
  const privateKey = requireEnv('CREDITCOIN_WALLET_PRIVATE_KEY');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const { abi, bytecode } = loadArtifact('AvalTestToken');
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const token = await factory.deploy();
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log(`AvalTestToken deployed to: ${address}`);
  updateEnvValue('AVAL_TEST_TOKEN_ADDRESS', address);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
