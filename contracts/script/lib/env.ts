import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const ENV_PATH = path.resolve(__dirname, '../../.env');

export function loadEnv(): void {
  if (fs.existsSync(ENV_PATH)) {
    dotenv.config({ path: ENV_PATH });
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Check your contracts/.env file.`);
  }
  return value;
}

/**
 * Picks which wallet a script signs with. Pass `--as counterparty` on the command line to act
 * as the drawee/beneficiary (COUNTERPARTY_PRIVATE_KEY) instead of the default drawer/relayer
 * wallet (CREDITCOIN_WALLET_PRIVATE_KEY), so the demo isn't just one wallet talking to itself.
 */
export function pickSigningKey(argv: string[]): string {
  const asIndex = argv.indexOf('--as');
  const role = asIndex >= 0 ? argv[asIndex + 1] : 'drawer';

  if (role === 'counterparty') {
    return requireEnv('COUNTERPARTY_PRIVATE_KEY');
  }
  return requireEnv('CREDITCOIN_WALLET_PRIVATE_KEY');
}

/** Strips a trailing `--as <role>` pair out of argv, returning the remaining positional args. */
export function stripRoleFlag(argv: string[]): string[] {
  const asIndex = argv.indexOf('--as');
  if (asIndex < 0) return argv;
  return [...argv.slice(0, asIndex), ...argv.slice(asIndex + 2)];
}
