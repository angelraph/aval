import { ethers } from 'ethers';
import { loadEnv, requireEnv } from './lib/env';
import { loadArtifact } from './lib/artifacts';

loadEnv();

/**
 * Issues a new instrument. Usage:
 *   tsx script/issue.ts <drawee> <beneficiary> <amountEth> <documentText> <expiryBlocksFromNow>
 * Any of the address args can be omitted to default to the deployer wallet, useful for a quick
 * self-test where the same wallet plays drawer, drawee and beneficiary.
 */
async function main() {
  const rpcUrl = requireEnv('CREDITCOIN_RPC_URL');
  const privateKey = requireEnv('CREDITCOIN_WALLET_PRIVATE_KEY');
  const instrumentAddress = requireEnv('AVAL_INSTRUMENT_ADDRESS');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const [draweeArg, beneficiaryArg, amountArg, documentTextArg, expiryArg] = process.argv.slice(2);
  const drawee = draweeArg || wallet.address;
  const beneficiary = beneficiaryArg || wallet.address;
  const amountEth = amountArg || '0.01';
  const documentText = documentTextArg || 'shipment-42:cocoa:25t:lagos-to-rotterdam';
  const expiryBlocksFromNow = Number(expiryArg || '50000');

  const documentHash = ethers.keccak256(ethers.toUtf8Bytes(documentText));
  const currentBlock = await provider.getBlockNumber();
  const expiryBlock = currentBlock + expiryBlocksFromNow;

  const { abi } = loadArtifact('AvalInstrument');
  const instrument = new ethers.Contract(instrumentAddress, abi, wallet);

  console.log('Issuing instrument:');
  console.log(`  drawee:     ${drawee}`);
  console.log(`  beneficiary: ${beneficiary}`);
  console.log(`  amount:     ${amountEth} CTC`);
  console.log(`  document:   "${documentText}"`);
  console.log(`  docHash:    ${documentHash}`);
  console.log(`  expiry:     block ${expiryBlock} (current: ${currentBlock})`);

  const tx = await instrument.issue(drawee, beneficiary, ethers.parseEther(amountEth), documentHash, expiryBlock);
  const receipt = await tx.wait();

  const issuedEvent = receipt.logs
    .map((log: any) => {
      try {
        return instrument.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed: any) => parsed?.name === 'InstrumentIssued');

  const id = issuedEvent?.args?.id;
  console.log(`\nInstrument issued with ID: ${id}. Tx hash: ${receipt.hash}`);
  console.log(`Keep the document text safe, it is needed again at presentment time: "${documentText}"`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
