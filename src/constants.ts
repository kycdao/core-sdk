import { ConnectConfig } from 'near-api-js';
import { ClientOptions } from 'persona';

export const Blockchains = ['Ethereum', 'Near'];

export const BlockchainNetworks = ['NearTestnet', 'NearMainnet', 'PolygonMumbai'];

export const KycDaoEnvironments = ['demo', 'test'];

export const VerificationProviders = ['ParallelMarkets', 'Persona', 'VerifyInvestor'];

export const VerificationStasuses = ['Created', 'Failed', 'InReview', 'Verified', 'NotVerified'];

export const VerificationTypes = ['KYB', 'KYC'];

export const WalletProviders = ['Near', 'MetaMask', 'WalletConnect'];

export const NEAR_TESTNET_CONFIG: ConnectConfig = {
  networkId: 'testnet',
  nodeUrl: 'https://rpc.testnet.near.org',
  walletUrl: 'https://wallet.testnet.near.org',
  helperUrl: 'https://helper.testnet.near.org',
  headers: {},
};

export const PERSONA_SANDBOX_OPTIONS: ClientOptions = {
  environment: 'sandbox',
  templateId: 'itmpl_JD2di4nkGV3cZMYPhh98atkC',
};
