import { ethers } from 'ethers';
import { loadEnv, requireEnv } from './lib/env';
import { loadArtifact } from './lib/artifacts';
import { updateEnvValue } from './lib/updateEnv';

loadEnv();

async function main() {
  const rpcUrl = requireEnv('CREDITCOIN_RPC_URL');
  const privateKey = requireEnv('CREDITCOIN_WALLET_PRIVATE_KEY');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log(`Deploying AvalInstrument and AvalCollateralVault to Creditcoin CC3 testnet from ${wallet.address}...`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer CC3 testnet CTC balance: ${ethers.formatEther(balance)}`);
  if (balance === 0n) {
    throw new Error(
      `Deployer ${wallet.address} has no testnet CTC. Fund it from the Creditcoin testnet faucet before deploying.`
    );
  }

  const instrumentArtifact = loadArtifact('AvalInstrument');
  const instrumentFactory = new ethers.ContractFactory(instrumentArtifact.abi, instrumentArtifact.bytecode, wallet);
  const instrument = await instrumentFactory.deploy();
  await instrument.waitForDeployment();
  const instrumentAddress = await instrument.getAddress();
  console.log(`AvalInstrument deployed to: ${instrumentAddress}`);
  updateEnvValue('AVAL_INSTRUMENT_ADDRESS', instrumentAddress);

  const vaultArtifact = loadArtifact('AvalCollateralVault');
  const vaultFactory = new ethers.ContractFactory(vaultArtifact.abi, vaultArtifact.bytecode, wallet);
  const vault = await vaultFactory.deploy(instrumentAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log(`AvalCollateralVault deployed to: ${vaultAddress}`);
  updateEnvValue('AVAL_COLLATERAL_VAULT_ADDRESS', vaultAddress);

  console.log('\nNext step: run "npm run register:source" once AVAL_PRESENTMENT_ADDRESS is set (deploy-sepolia.ts).');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
