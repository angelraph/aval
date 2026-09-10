import { ethers } from 'ethers';
import { loadEnv, requireEnv } from './lib/env';
import { loadArtifact } from './lib/artifacts';

loadEnv();

async function main() {
  const rpcUrl = requireEnv('CREDITCOIN_RPC_URL');
  const privateKey = requireEnv('CREDITCOIN_WALLET_PRIVATE_KEY');
  const instrumentAddress = requireEnv('AVAL_INSTRUMENT_ADDRESS');
  const presentmentAddress = requireEnv('AVAL_PRESENTMENT_ADDRESS');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const { abi } = loadArtifact('AvalInstrument');
  const instrument = new ethers.Contract(instrumentAddress, abi, wallet);

  console.log(`Registering ${presentmentAddress} as the trusted source presentment contract...`);
  const tx = await instrument.registerSourcePresentmentContract(presentmentAddress);
  const receipt = await tx.wait();
  console.log(`Done. Tx hash: ${receipt.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
