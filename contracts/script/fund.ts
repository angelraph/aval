import { ethers } from 'ethers';
import { loadEnv, requireEnv, pickSigningKey, stripRoleFlag } from './lib/env';
import { loadArtifact } from './lib/artifacts';

loadEnv();

/**
 * Funds an instrument. Usage: tsx script/fund.ts <instrumentId> [--as counterparty]
 * Add "--as counterparty" to sign with COUNTERPARTY_PRIVATE_KEY instead of the default wallet.
 */
async function main() {
  const rpcUrl = requireEnv('CREDITCOIN_RPC_URL');
  const privateKey = pickSigningKey(process.argv);
  const instrumentAddress = requireEnv('AVAL_INSTRUMENT_ADDRESS');

  const [id] = stripRoleFlag(process.argv.slice(2));
  if (!id) {
    throw new Error('Usage: tsx script/fund.ts <instrumentId> [--as counterparty]');
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const { abi } = loadArtifact('AvalInstrument');
  const instrument = new ethers.Contract(instrumentAddress, abi, wallet);

  const inst = await instrument.getInstrument(id);
  const isNative = inst.token === ethers.ZeroAddress;

  if (isNative) {
    console.log(`Funding instrument ${id} with ${ethers.formatEther(inst.amount)} CTC...`);
    const tx = await instrument.fund(id, { value: inst.amount });
    const receipt = await tx.wait();
    console.log(`Funded. Tx hash: ${receipt.hash}`);
  } else {
    console.log(`Funding instrument ${id} with ${inst.amount} of token ${inst.token}...`);
    const erc20Abi = [
      'function approve(address spender, uint256 amount) returns (bool)',
      'function allowance(address owner, address spender) view returns (uint256)',
    ];
    const token = new ethers.Contract(inst.token, erc20Abi, wallet);

    const allowance = await token.allowance(wallet.address, instrumentAddress);
    if (allowance < inst.amount) {
      console.log('Approving AvalInstrument to pull the token...');
      const approveTx = await token.approve(instrumentAddress, inst.amount);
      await approveTx.wait();
    }

    const tx = await instrument.fund(id);
    const receipt = await tx.wait();
    console.log(`Funded. Tx hash: ${receipt.hash}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
