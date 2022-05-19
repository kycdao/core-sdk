import { ConnectConfig } from 'near-api-js';

export const Blockchains = ['Ethereum', 'Near'];

export const BlockchainNetworks = ['NearTestnet', 'NearMainnet', 'PolygonMumbai'];

export const VerificationProviders = ['ParallelMarkets', 'Persona', 'VerifyInvestor'];

export const VerificationTypes = ['KYB', 'KYC'];

export const WalletProviders = ['Near', 'MetaMask', 'WalletConnect'];

export const NEAR_TESTNET_CONFIG: ConnectConfig = {
  networkId: 'testnet',
  nodeUrl: 'https://rpc.testnet.near.org',
  walletUrl: 'https://wallet.testnet.near.org',
  helperUrl: 'https://helper.testnet.near.org',
  headers: {},
};
