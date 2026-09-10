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
