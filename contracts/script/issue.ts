import { ethers } from 'ethers';
import { loadEnv, requireEnv } from './lib/env';
import { loadArtifact } from './lib/artifacts';

loadEnv();

/**
 * Issues a new instrument. Usage:
 *   tsx script/issue.ts <drawee> <beneficiary> <amountEth> <documentText> <expiryBlocksFromNow> [token]
 * Any of the address args can be omitted to default to the deployer wallet, useful for a quick
 * self-test where the same wallet plays drawer, drawee and beneficiary. [token] is optional: omit
 * it (or pass "native") for native CTC, or pass "test" to use AVAL_TEST_TOKEN_ADDRESS from .env,
 * or pass a token address directly. Amount is always in the token's own units either way, read as
 * ether-style decimal (18 decimals) for native CTC, or as a plain integer of the token's smallest
 * unit for an ERC20 (e.g. AvalTestToken uses 6 decimals, so 1_000_000 is 1.00).
 */
async function main() {
  const rpcUrl = requireEnv('CREDITCOIN_RPC_URL');
  const privateKey = requireEnv('CREDITCOIN_WALLET_PRIVATE_KEY');
  const instrumentAddress = requireEnv('AVAL_INSTRUMENT_ADDRESS');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const [draweeArg, beneficiaryArg, amountArg, documentTextArg, expiryArg, tokenArg] = process.argv.slice(2);
  const drawee = draweeArg || wallet.address;
  const beneficiary = beneficiaryArg || wallet.address;
  const documentText = documentTextArg || 'shipment-42:cocoa:25t:lagos-to-rotterdam';
  const expiryBlocksFromNow = Number(expiryArg || '50000');

  let token = ethers.ZeroAddress;
  let amount: bigint;
  if (!tokenArg || tokenArg === 'native') {
    amount = ethers.parseEther(amountArg || '0.01');
  } else {
    token = tokenArg === 'test' ? requireEnv('AVAL_TEST_TOKEN_ADDRESS') : tokenArg;
    amount = BigInt(amountArg || '1000000');
  }

  const documentHash = ethers.keccak256(ethers.toUtf8Bytes(documentText));
  const currentBlock = await provider.getBlockNumber();
  const expiryBlock = currentBlock + expiryBlocksFromNow;

  const { abi } = loadArtifact('AvalInstrument');
  const instrument = new ethers.Contract(instrumentAddress, abi, wallet);

  console.log('Issuing instrument:');
  console.log(`  drawee:      ${drawee}`);
  console.log(`  beneficiary: ${beneficiary}`);
  console.log(`  token:       ${token === ethers.ZeroAddress ? 'native CTC' : token}`);
  console.log(`  amount:      ${amount}`);
  console.log(`  document:    "${documentText}"`);
  console.log(`  docHash:     ${documentHash}`);
  console.log(`  expiry:      block ${expiryBlock} (current: ${currentBlock})`);

  const tx = await instrument.issue(drawee, beneficiary, token, amount, documentHash, expiryBlock);
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
