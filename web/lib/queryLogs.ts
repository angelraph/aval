import { Contract, EventLog } from "ethers";

const CHUNK_SIZE = 2000;

/**
 * Public RPC nodes tend to reject eth_getLogs calls that span too wide a block range in one
 * shot. This walks the range in fixed-size windows instead of asking for everything at once.
 */
export async function queryFilterChunked(
  contract: Contract,
  filter: any,
  fromBlock: number,
  toBlock: number
): Promise<EventLog[]> {
  const results: EventLog[] = [];

  for (let start = fromBlock; start <= toBlock; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE - 1, toBlock);
    const events = await contract.queryFilter(filter, start, end);
    for (const event of events) {
      if (event instanceof EventLog) {
        results.push(event);
      }
    }
  }

  return results;
}
