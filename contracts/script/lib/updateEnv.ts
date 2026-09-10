import fs from 'fs';
import path from 'path';

const ENV_PATH = path.resolve(__dirname, '../../.env');

/**
 * Sets KEY="value" in the .env file, replacing the line if it already exists (even if empty)
 * or appending it otherwise. Used by the deploy scripts to save contract addresses automatically
 * so you don't have to copy/paste them by hand.
 */
export function updateEnvValue(key: string, value: string): void {
  const line = `${key}="${value}"`;
  let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf-8') : '';
  const pattern = new RegExp(`^${key}=.*$`, 'm');

  if (pattern.test(content)) {
    content = content.replace(pattern, line);
  } else {
    content = content.trimEnd() + `\n${line}\n`;
  }

  fs.writeFileSync(ENV_PATH, content);
  console.log(`Saved ${key}=${value} to .env`);
}
