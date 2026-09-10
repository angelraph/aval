import { ethers } from 'ethers';
import { loadEnv, requireEnv } from './lib/env';
import { loadArtifact } from './lib/artifacts';

loadEnv();

const STATUS_NAMES = ['Issued', 'Funded', 'Honored', 'Expired'];

/** Prints an instrument's current on-chain state. Usage: tsx script/status.ts <instrumentId> */
async function main() {
  const rpcUrl = requireEnv('CREDITCOIN_RPC_URL');
  const instrumentAddress = requireEnv('AVAL_INSTRUMENT_ADDRESS');

  const id = process.argv[2];
  if (!id) {
    throw new Error('Usage: tsx script/status.ts <instrumentId>');
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const { abi } = loadArtifact('AvalInstrument');
  const instrument = new ethers.Contract(instrumentAddress, abi, provider);

  const inst = await instrument.getInstrument(id);
  const currentBlock = await provider.getBlockNumber();

  console.log(`Instrument ${id}`);
  console.log(`  status:       ${STATUS_NAMES[Number(inst.status)]}`);
  console.log(`  drawer:       ${inst.drawer}`);
  console.log(`  drawee:       ${inst.drawee}`);
  console.log(`  beneficiary:  ${inst.beneficiary}`);
  console.log(`  amount:       ${ethers.formatEther(inst.amount)} CTC`);
  console.log(`  requiredDoc:  ${inst.requiredDocumentHash}`);
  console.log(`  expiryBlock:  ${inst.expiryBlock} (current: ${currentBlock})`);
  console.log(`  payoutRedirect: ${inst.payoutRedirect === ethers.ZeroAddress ? 'none' : inst.payoutRedirect}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
