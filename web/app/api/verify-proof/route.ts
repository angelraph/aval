import { NextRequest, NextResponse } from "next/server";
import { runRelayStep, RelayState } from "@/lib/proofRelay";

/**
 * Stateless by design: every call does one small, bounded step (check if mined, check if
 * attested, try to fetch the proof, or submit it) and returns immediately with the state to
 * pass back on the next call. The browser drives the polling. Nothing is kept in memory
 * between requests, which matters on serverless, a single invocation here never needs to
 * outlive more than a few seconds, no matter how long the overall process takes.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { instrumentId, sourceTxHash } = body;
  const state: RelayState = body.state ?? { phase: "waiting-for-mining" };

  if (!instrumentId || !sourceTxHash) {
    return NextResponse.json({ error: "instrumentId and sourceTxHash are required" }, { status: 400 });
  }

  const result = await runRelayStep(instrumentId, sourceTxHash, state);
  return NextResponse.json(result);
}
