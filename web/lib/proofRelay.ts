import { ethers } from "ethers";
import { proofProvider, chainInfo } from "@gluwa/usc-sdk";
import AvalInstrumentAbi from "./abi/AvalInstrument.json";
import { queryFilterChunked } from "./queryLogs";
import { AVAL_INSTRUMENT_DEPLOY_BLOCK } from "./contracts";

export type RelayPhase =
  | "waiting-for-mining"
  | "waiting-for-attestation"
  | "generating-proof"
  | "submitting"
  | "done"
  | "error";

/**
 * Everything needed to resume the relay from where the last step left off. Passed back and
 * forth between the client and the API route as plain JSON, nothing is kept in server memory
 * between calls. That matters on Vercel: a serverless function does not reliably survive, or
 * share memory, across separate invocations, and this flow can take many minutes end to end,
 * far longer than any single invocation should run for.
 */
export interface RelayState {
  phase: RelayPhase;
  blockNumber?: number;
  proof?: unknown;
  txHash?: string;
  error?: string;
}

export interface RelayStepResult {
  state: RelayState;
  log: string[];
}

/**
 * Runs exactly one small, bounded unit of work toward getting an instrument honored, then
 * returns immediately. Never blocks waiting on external services beyond a single request. The
 * caller (the API route, driven by the browser) is expected to call this again a few seconds
 * later with the returned state until phase is "done" or "error".
 */
export async function runRelayStep(
  instrumentId: string,
  sourceTxHash: string,
  state: RelayState
): Promise<RelayStepResult> {
  const log: string[] = [];

  try {
    // Checked before every single step, not just the final one. Attestation realistically takes
    // several minutes, long enough for an instrument to cross its own expiry block while we're
    // still waiting, even though its on-chain status field stays "Funded" until someone actually
    // calls markExpired(). Catching that here, against the real block number, means a doomed
    // instrument fails fast with a clear reason instead of grinding through several more minutes
    // of polling only to hit a bare "transaction execution reverted" at the very end.
    const shortCircuit = await checkInstrumentStillActionable(instrumentId);
    if (shortCircuit) {
      log.push(shortCircuit.log);
      return { state: shortCircuit.state, log };
    }

    switch (state.phase) {
      case "waiting-for-mining":
        return await stepWaitForMining(sourceTxHash, log);
      case "waiting-for-attestation":
        return await stepWaitForAttestation(state, log);
      case "generating-proof":
        return await stepGenerateProof(sourceTxHash, state, log);
      case "submitting":
        return await stepSubmit(instrumentId, state, log);
      default:
        return { state, log };
    }
  } catch (err: any) {
    const message = err.shortMessage ?? err.message ?? String(err);
    log.push(`Error: ${message}`);
    return { state: { ...state, phase: "error", error: message }, log };
  }
}

const STATUS_FUNDED = 1;
const STATUS_HONORED = 2;
const STATUS_EXPIRED = 3;

/**
 * Reads the instrument's real state directly, rather than trusting whatever phase we think
 * we're in. Returns a result to short-circuit to (already honored, or expired) if the flow
 * shouldn't continue, or null if it's fine to proceed with the current step.
 */
async function checkInstrumentStillActionable(
  instrumentId: string
): Promise<{ state: RelayState; log: string } | null> {
  const instrumentAddress = process.env.NEXT_PUBLIC_AVAL_INSTRUMENT_ADDRESS!;
  const creditcoinProvider = new ethers.JsonRpcProvider(process.env.CREDITCOIN_RPC_URL!);
  const instrument = new ethers.Contract(instrumentAddress, AvalInstrumentAbi, creditcoinProvider);

  const [current, currentBlock] = await Promise.all([
    instrument.getInstrument(instrumentId),
    creditcoinProvider.getBlockNumber(),
  ]);

  if (Number(current.status) === STATUS_HONORED) {
    const txHash = await readHonoredTxHash(instrumentAddress, instrumentId, creditcoinProvider);
    return {
      state: { phase: "done", txHash: txHash ?? undefined },
      log: "Already honored. Treating as done.",
    };
  }

  const expiryBlock = Number(current.expiryBlock);
  const isExpiredByBlock = currentBlock > expiryBlock;
  if (Number(current.status) === STATUS_EXPIRED || (Number(current.status) === STATUS_FUNDED && isExpiredByBlock)) {
    return {
      state: {
        phase: "error",
        error: `This instrument's presentment window expired before the proof could be submitted (expired at Creditcoin block ${expiryBlock}, now at block ${currentBlock}). The escrow can be reclaimed with "Mark expired and refund"; a new instrument with more time will need to be issued to try again.`,
      },
      log: `Expired at block ${expiryBlock}, current block is ${currentBlock}.`,
    };
  }

  return null;
}

async function stepWaitForMining(sourceTxHash: string, log: string[]): Promise<RelayStepResult> {
  const provider = new ethers.JsonRpcProvider(process.env.SOURCE_CHAIN_RPC_URL!);
  const receipt = await provider.getTransactionReceipt(sourceTxHash);

  if (!receipt || receipt.blockNumber == null) {
    log.push("Waiting for the presentment to be mined on Sepolia...");
    return { state: { phase: "waiting-for-mining" }, log };
  }

  log.push(`Mined in Sepolia block ${receipt.blockNumber}.`);
  return { state: { phase: "waiting-for-attestation", blockNumber: receipt.blockNumber }, log };
}

async function stepWaitForAttestation(state: RelayState, log: string[]): Promise<RelayStepResult> {
  const chainKey = Number(process.env.SOURCE_CHAIN_KEY!);
  const creditcoinProvider = new ethers.JsonRpcProvider(process.env.CREDITCOIN_RPC_URL!);
  const info = new chainInfo.PrecompileChainInfoProvider(creditcoinProvider);

  // RPC-backed, reads the same precompile AvalInstrument itself trusts, and has its own
  // exponential-backoff retry inside the SDK. This is what actually decides whether we can
  // move on, the proof builder's own cache (checked next) can lag a little behind it.
  const attested = await info.getLatestAttestedHeightAndHash(chainKey);

  if (!attested.exists || attested.height < state.blockNumber!) {
    log.push(
      `Not attested yet (latest attested height: ${attested.exists ? attested.height : "none"}, need ${state.blockNumber}).`
    );
    return { state, log };
  }

  log.push(`Block ${state.blockNumber} is attested on Creditcoin.`);
  return { state: { phase: "generating-proof", blockNumber: state.blockNumber }, log };
}

async function stepGenerateProof(
  sourceTxHash: string,
  state: RelayState,
  log: string[]
): Promise<RelayStepResult> {
  const chainKey = Number(process.env.SOURCE_CHAIN_KEY!);
  const proofBuilder = new proofProvider.service.ProofBuilder(chainKey, process.env.PROOF_BUILDER_URL!, 30_000);

  const result = await proofBuilder.getProof(sourceTxHash);

  if (!result.success || !result.data) {
    // The block can be attested on-chain slightly before the proof builder's own cache has
    // indexed it, and its API can be slow or briefly unreachable under load. Either way this
    // isn't fatal, the next call from the client just tries again.
    log.push(`Proof not ready yet (${result.error ?? "not cached"}). Will retry.`);
    return { state, log };
  }

  log.push("Proof generated.");
  return { state: { phase: "submitting", blockNumber: state.blockNumber, proof: result.data }, log };
}

async function stepSubmit(instrumentId: string, state: RelayState, log: string[]): Promise<RelayStepResult> {
  const instrumentAddress = process.env.NEXT_PUBLIC_AVAL_INSTRUMENT_ADDRESS!;
  const creditcoinProvider = new ethers.JsonRpcProvider(process.env.CREDITCOIN_RPC_URL!);
  const wallet = new ethers.Wallet(process.env.CREDITCOIN_RELAYER_PRIVATE_KEY!, creditcoinProvider);
  const instrument = new ethers.Contract(instrumentAddress, AvalInstrumentAbi, wallet);

  const proofData = state.proof as {
    chainKey: number;
    headerNumber: number;
    txBytes: string;
    merkleProof: { root: string; siblings: unknown[] };
    continuityProof: { lowerEndpointDigest: string; roots: string[] };
  };

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

  try {
    log.push("Submitting the proof to AvalInstrument.execute()...");
    const tx = await (instrument as any).execute(...params, { gasLimit });
    const receipt = await tx.wait();
    log.push(`Done. Tx hash: ${receipt.hash}`);
    return { state: { phase: "done", txHash: receipt.hash }, log };
  } catch (err: any) {
    // Someone else could have submitted the same valid proof in the moment between our status
    // check above and this call, execute() is permissionless. Re-check rather than trust the
    // revert reason string, RPC nodes don't all surface it the same way.
    const after = await instrument.getInstrument(instrumentId).catch(() => null);
    if (after && Number(after.status) === STATUS_HONORED) {
      log.push("Already honored (someone else's submission landed first). Treating as done.");
      const txHash = await readHonoredTxHash(instrumentAddress, instrumentId, creditcoinProvider);
      return { state: { phase: "done", txHash: txHash ?? undefined }, log };
    }
    throw err;
  }
}

async function readHonoredTxHash(
  instrumentAddress: string,
  instrumentId: string,
  provider: ethers.JsonRpcProvider
): Promise<string | null> {
  try {
    const instrument = new ethers.Contract(instrumentAddress, AvalInstrumentAbi, provider);
    const latest = await provider.getBlockNumber();
    const logs = await queryFilterChunked(
      instrument,
      instrument.filters.InstrumentHonored(instrumentId),
      AVAL_INSTRUMENT_DEPLOY_BLOCK || 0,
      latest
    );
    const last = logs[logs.length - 1];
    return last?.transactionHash ?? null;
  } catch {
    return null;
  }
}
