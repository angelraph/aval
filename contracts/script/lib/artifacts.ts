import fs from 'fs';
import path from 'path';

const OUT_DIR = path.resolve(__dirname, '../../out');

export interface Artifact {
  abi: any[];
  bytecode: string;
}

/**
 * Loads a Foundry build artifact for the given contract name (must match the .sol file name).
 * Run `npm run build` first if this throws a "not found" error.
 */
export function loadArtifact(contractName: string): Artifact {
  const artifactPath = path.join(OUT_DIR, `${contractName}.sol`, `${contractName}.json`);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found at ${artifactPath}. Run "npm run build" first.`);
  }
  const raw = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
  return { abi: raw.abi, bytecode: raw.bytecode.object };
}
