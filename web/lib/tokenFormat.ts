import { ZeroAddress, formatEther, formatUnits } from "ethers";
import { AVAL_TEST_TOKEN_SYMBOL, AVAL_TEST_TOKEN_DECIMALS } from "./contracts";

/**
 * Formats an instrument amount for display, given its token address. The zero address means
 * native CTC (18 decimals). Anything else is treated as AvalTestToken (6 decimals), the only
 * ERC20 this demo issues instruments in. A production version would read decimals()/symbol()
 * from the token itself instead of assuming one.
 */
export function formatInstrumentAmount(amount: bigint, token: string): string {
  if (token === ZeroAddress) {
    return `${formatEther(amount)} CTC`;
  }
  return `${formatUnits(amount, AVAL_TEST_TOKEN_DECIMALS)} ${AVAL_TEST_TOKEN_SYMBOL}`;
}

export function isNativeToken(token: string): boolean {
  return token === ZeroAddress;
}
