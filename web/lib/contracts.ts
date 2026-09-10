import AvalInstrumentAbi from './abi/AvalInstrument.json';
import AvalPresentmentAbi from './abi/AvalPresentment.json';
import AvalCollateralVaultAbi from './abi/AvalCollateralVault.json';

// Filled in once the contracts are deployed to testnet. Kept here, in one place, instead of
// scattered through the pages that need them.
export const AVAL_INSTRUMENT_ADDRESS = process.env.NEXT_PUBLIC_AVAL_INSTRUMENT_ADDRESS ?? '';
export const AVAL_PRESENTMENT_ADDRESS = process.env.NEXT_PUBLIC_AVAL_PRESENTMENT_ADDRESS ?? '';
export const AVAL_COLLATERAL_VAULT_ADDRESS = process.env.NEXT_PUBLIC_AVAL_COLLATERAL_VAULT_ADDRESS ?? '';

export const CREDITCOIN_TESTNET = {
  chainIdHex: '0x18e8f', // 102543
  chainName: 'Creditcoin CC3 Testnet',
  rpcUrl: 'https://rpc.cc3-testnet.creditcoin.network',
  nativeCurrency: { name: 'Testnet CTC', symbol: 'tCTC', decimals: 18 },
  blockExplorerUrl: 'https://creditcoin3-testnet.blockscout.com',
};

export const SEPOLIA = {
  chainIdHex: '0xaa36a7', // 11155111
  chainName: 'Sepolia',
  rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
  nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
  blockExplorerUrl: 'https://sepolia.etherscan.io',
};

export const AvalInstrumentABI = AvalInstrumentAbi;
export const AvalPresentmentABI = AvalPresentmentAbi;
export const AvalCollateralVaultABI = AvalCollateralVaultAbi;

export const InstrumentStatus = ['Issued', 'Funded', 'Honored', 'Expired'] as const;
