import { ethers } from 'ethers';

const ZERO = ethers.ZeroAddress;

/**
 * Formats an instrument amount for a console log, given its token address. The zero address
 * means native CTC (18 decimals). Anything else is treated as AvalTestToken (6 decimals), the
 * only ERC20 these scripts ever issue instruments in.
 */
export function formatInstrumentAmount(amount: bigint, token: string): string {
  if (token === ZERO) {
    return `${ethers.formatEther(amount)} CTC`;
  }
  return `${ethers.formatUnits(amount, 6)} aTUSD`;
}
