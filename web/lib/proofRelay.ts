import { ethers } from "ethers";
import { proofProvider, chainInfo } from "@gluwa/usc-sdk";
import AvalInstrumentAbi from "./abi/AvalInstrument.json";

export interface RelayJob {
  status: "waiting-for-mining" | "waiting-for-attestation" | "generating-proof" | "submitting" | "done" | "error";
  log: string[];
  txHash: string | null;
  error: string | null;
}

const jobs = new Map<string, RelayJob>();

function appendLog(job: RelayJob, line: string) {
  job.log.push(line);
  // eslint-disable-next-line no-console
  console.log(`[relay ${job.status}] ${line}`);
}

export function getJob(jobId: string): RelayJob | undefined {
  return jobs.get(jobId);
}

/**
 * Runs the same flow as contracts/script/verify-proof.ts: waits for the presentment tx to be
 * mined, waits for its block to be attested on Creditcoin, fetches the inclusion proof, and
 * submits it to AvalInstrument.execute(). Runs in the background; poll getJob(jobId) for status.
 */
export function startVerifyProofJob(jobId: string, instrumentId: string, sourceTxHash: string): RelayJob {
  const job: RelayJob = { status: "waiting-for-mining", log: [], txHash: null, error: null };
  jobs.set(jobId, job);

  runJob(job, instrumentId, sourceTxHash).catch((err) => {
    job.status = "error";
    job.error = err.shortMessage ?? err.message ?? String(err);
    appendLog(job, `Failed: ${job.error}`);
  });

  return job;
}

async function runJob(job: RelayJob, instrumentId: string, sourceTxHash: string) {
  const sourceChainRpcUrl = process.env.SOURCE_CHAIN_RPC_URL!;
  const creditcoinRpcUrl = process.env.CREDITCOIN_RPC_URL!;
  const privateKey = process.env.CREDITCOIN_RELAYER_PRIVATE_KEY!;
  const proofBuilderUrl = process.env.PROOF_BUILDER_URL!;
  const instrumentAddress = process.env.NEXT_PUBLIC_AVAL_INSTRUMENT_ADDRESS!;
  const chainKey = Number(process.env.SOURCE_CHAIN_KEY!);

  const sourceProvider = new ethers.JsonRpcProvider(sourceChainRpcUrl);
  const creditcoinProvider = new ethers.JsonRpcProvider(creditcoinRpcUrl);
  const wallet = new ethers.Wallet(privateKey, creditcoinProvider);

  appendLog(job, `Waiting for ${sourceTxHash} to be mined on the source chain...`);
  const txReceipt = await sourceProvider.waitForTransaction(sourceTxHash, 1, 120_000);
  if (!txReceipt || txReceipt.blockNumber == null) {
    throw new Error("Transaction is not mined on the source chain yet.");
  }
  const blockNumber = txReceipt.blockNumber;
  appendLog(job, `Found in block ${blockNumber}.`);

  job.status = "waiting-for-attestation";
  const proofBuilder = new proofProvider.service.ProofBuilder(chainKey, proofBuilderUrl);
  const info = new chainInfo.PrecompileChainInfoProvider(creditcoinProvider);

  const latestAttested = await info.getLatestAttestedHeightAndHash(chainKey);
  appendLog(job, `Latest attested height for chain key ${chainKey}: ${latestAttested.height}`);
  appendLog(job, `Waiting for block ${blockNumber} to be attested on Creditcoin. This is usually a few minutes.`);

  await proofBuilder.waitUntilHeightAttested(chainKey, blockNumber, 15_000, 1_200_000);
  appendLog(job, "Block attested.");

  job.status = "generating-proof";
  const proofResult = await proofBuilder.getProof(sourceTxHash);
  if (!proofResult.success || !proofResult.data) {
    throw new Error(`Proof generation failed: ${proofResult.error}`);
  }
  appendLog(job, "Proof generated.");

  job.status = "submitting";
  const instrument = new ethers.Contract(instrumentAddress, AvalInstrumentAbi, wallet);
  const proofData = proofResult.data;
  const params = [
    0, // AvalAction.Presented
    proofData.chainKey,
    proofData.headerNumber,
    proofData.txBytes,
    proofData.merkleProof.root,
    proofData.merkleProof.siblings,
    proofData.continuityProof.lowerEndpointDigest,
    proofData.continuityProof.roots,
  ] as const;

  let gasLimit: bigint;
  try {
    const data = instrument.interface.encodeFunctionData("execute", params as any);
    const estimated = await creditcoinProvider.estimateGas({ to: instrumentAddress, data, from: wallet.address });
    gasLimit = (estimated * 135n) / 100n;
  } catch {
    const continuityBlocks = BigInt(proofData.continuityProof.roots?.length ?? 1);
    gasLimit = 21000n + continuityBlocks * 5000n + 600000n;
  }

  appendLog(job, "Submitting proof to AvalInstrument.execute()...");
  const tx = await (instrument as any).execute(...params, { gasLimit });
  const receipt = await tx.wait();

  job.status = "done";
  job.txHash = receipt.hash;
  appendLog(job, `Done. Tx hash: ${receipt.hash}`);
}
