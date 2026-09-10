import { ethers } from 'ethers';
import { loadEnv, requireEnv } from './lib/env';
import { loadArtifact } from './lib/artifacts';

loadEnv();

/**
 * Presents a document on Sepolia for a given instrument. Usage:
 *   tsx script/present.ts <instrumentId> <documentText>
 * This is the real, on-chain action that the Attestcoin Protocol will later prove happened.
 */
async function main() {
  const rpcUrl = requireEnv('SOURCE_CHAIN_RPC_URL');
  const privateKey = requireEnv('CREDITCOIN_WALLET_PRIVATE_KEY');
  const presentmentAddress = requireEnv('AVAL_PRESENTMENT_ADDRESS');

  const [id, documentText] = process.argv.slice(2);
  if (!id || !documentText) {
    throw new Error('Usage: tsx script/present.ts <instrumentId> <documentText>');
  }

  const documentHash = ethers.keccak256(ethers.toUtf8Bytes(documentText));

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const { abi } = loadArtifact('AvalPresentment');
  const presentment = new ethers.Contract(presentmentAddress, abi, wallet);

  console.log(`Presenting document "${documentText}" (hash ${documentHash}) for instrument ${id} on Sepolia...`);
  const tx = await presentment.presentDocument(id, documentHash);
  const receipt = await tx.wait();
  console.log(`Presented. Sepolia tx hash: ${receipt.hash}`);
  console.log('\nNext step: run "npm run verify-proof -- <instrumentId> <thisTxHash>" to prove it on Creditcoin.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
