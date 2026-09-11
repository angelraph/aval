import { ethers } from 'ethers';
import { proofProvider, chainInfo } from '@gluwa/usc-sdk';
import { loadEnv, requireEnv } from './lib/env';
import { loadArtifact } from './lib/artifacts';
import { formatInstrumentAmount } from './lib/formatAmount';

loadEnv();

/**
 * The core Attestcoin Protocol step: waits for a Sepolia transaction to be attested on
 * Creditcoin, fetches its inclusion proof, and submits that proof to AvalInstrument, which
 * verifies it against the real block prover precompile and honors the instrument if the
 * presented document matches. Usage:
 *   tsx script/verify-proof.ts <instrumentId> <sepoliaTxHash>
 */
async function main() {
  const sourceChainRpcUrl = requireEnv('SOURCE_CHAIN_RPC_URL');
  const creditcoinRpcUrl = requireEnv('CREDITCOIN_RPC_URL');
  const privateKey = requireEnv('CREDITCOIN_WALLET_PRIVATE_KEY');
  const proofBuilderUrl = requireEnv('PROOF_BUILDER_URL');
  const instrumentAddress = requireEnv('AVAL_INSTRUMENT_ADDRESS');
  const chainKey = Number(requireEnv('SOURCE_CHAIN_KEY'));

  const [instrumentId, txHash] = process.argv.slice(2);
  if (!instrumentId || !txHash) {
    throw new Error('Usage: tsx script/verify-proof.ts <instrumentId> <sepoliaTxHash>');
  }

  const sourceProvider = new ethers.JsonRpcProvider(sourceChainRpcUrl);
  const creditcoinProvider = new ethers.JsonRpcProvider(creditcoinRpcUrl);
  const wallet = new ethers.Wallet(privateKey, creditcoinProvider);

  console.log(`Waiting for ${txHash} to be mined on the source chain...`);
  const txReceipt = await sourceProvider.waitForTransaction(txHash, 1, 120_000);
  if (!txReceipt || txReceipt.blockNumber == null) {
    throw new Error(`Transaction ${txHash} is not mined on the source chain yet.`);
  }
  const blockNumber = txReceipt.blockNumber;
  console.log(`Found in block ${blockNumber}.`);

  // Note: we deliberately don't use ProofBuilder.waitUntilHeightAttested here. It polls the
  // prover's HTTP API directly with no retry around the request itself (a default 10s axios
  // timeout), so a single slow response kills the whole multi-minute wait. The chain-info
  // precompile check below reads the same attestation directly over RPC and has its own
  // exponential-backoff retry built in, so we use that to decide when to move on, and only hit
  // the prover's HTTP API afterwards, with our own retry, to fetch the actual proof bytes.
  const proofBuilder = new proofProvider.service.ProofBuilder(chainKey, proofBuilderUrl, 30_000);
  const info = new chainInfo.PrecompileChainInfoProvider(creditcoinProvider);

  const latestAttested = await info.getLatestAttestedHeightAndHash(chainKey);
  console.log(`Latest attested height for chain key ${chainKey}: ${latestAttested.exists ? latestAttested.height : 'none'}`);

  console.log(`Waiting for block ${blockNumber} to be attested on Creditcoin (this can take several minutes)...`);
  await info.waitUntilHeightAttested(chainKey, blockNumber, 15_000, 1_200_000, 5_000);
  console.log('Block attested. Generating proof...');

  const proofDeadline = Date.now() + 5 * 60_000;
  let proofResult = await proofBuilder.getProof(txHash);
  while (!proofResult.success || !proofResult.data) {
    if (Date.now() > proofDeadline) {
      throw new Error(`Proof generation failed after retrying: ${proofResult.error}`);
    }
    console.log(`Proof not ready yet (${proofResult.error ?? 'not cached'}), retrying in 10s...`);
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    proofResult = await proofBuilder.getProof(txHash);
  }
  console.log('Proof generated.');

  const { abi } = loadArtifact('AvalInstrument');
  const instrument = new ethers.Contract(instrumentAddress, abi, wallet);

  const action = 0; // AvalAction.Presented
  const proofData = proofResult.data;
  const params = [
    action,
    proofData.chainKey,
    proofData.headerNumber,
    proofData.txBytes,
    proofData.merkleProof.root,
    proofData.merkleProof.siblings,
    proofData.continuityProof.lowerEndpointDigest,
    proofData.continuityProof.roots,
  ] as const;

  console.log('Submitting proof to AvalInstrument.execute()...');

  let gasLimit: bigint;
  try {
    const data = instrument.interface.encodeFunctionData('execute', params as any);
    const estimated = await creditcoinProvider.estimateGas({ to: instrumentAddress, data, from: wallet.address });
    gasLimit = (estimated * 135n) / 100n;
  } catch (error: any) {
    console.warn(`Gas estimation failed (${error.shortMessage ?? error.message}), using a conservative fallback.`);
    const continuityBlocks = BigInt(proofData.continuityProof.roots?.length ?? 1);
    gasLimit = 21000n + continuityBlocks * 5000n + 600000n;
  }

  const tx = await (instrument as any).execute(...params, { gasLimit });
  const receipt = await tx.wait();

  console.log(`\nProof verified on-chain. Tx hash: ${receipt.hash}`);

  const honoredEvent = receipt.logs
    .map((log: any) => {
      try {
        return instrument.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed: any) => parsed?.name === 'InstrumentHonored');

  if (honoredEvent) {
    const inst = await instrument.getInstrument(instrumentId);
    console.log(
      `Instrument ${honoredEvent.args.id} honored. Paid ${formatInstrumentAmount(honoredEvent.args.amount, inst.token)} to ${honoredEvent.args.paidTo}.`
    );
  } else {
    console.log('No InstrumentHonored event found in the receipt, check the instrument status directly.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
