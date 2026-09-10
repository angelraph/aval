import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { startVerifyProofJob } from "@/lib/proofRelay";

export async function POST(req: NextRequest) {
  const { instrumentId, sourceTxHash } = await req.json();

  if (!instrumentId || !sourceTxHash) {
    return NextResponse.json({ error: "instrumentId and sourceTxHash are required" }, { status: 400 });
  }

  const jobId = randomUUID();
  startVerifyProofJob(jobId, instrumentId, sourceTxHash);

  return NextResponse.json({ jobId });
}
