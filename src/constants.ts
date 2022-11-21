import { ConnectConfig } from 'near-api-js';
import { BlockchainNetwork, BlockchainNetworkInfo } from './types';

/**
 * Collection of supported blockchains.
 *
 * @enum
 */
export const Blockchains = {
  Ethereum: 'Ethereum',
  Near: 'Near',
  Solana: 'Solana',
} as const;

/**
 * Collection of supported EVM blockchain networks.
 *
 * @enum
 */
export const EvmBlockchainNetworks = {
  EthereumGoerli: 'EthereumGoerli',
  EthereumMainnet: 'EthereumMainnet',
  PolygonMainnet: 'PolygonMainnet',
  PolygonMumbai: 'PolygonMumbai',
} as const;

/**
 * Collection of supported NEAR blockchain networks.
 *
 * @enum
 */
export const NearBlockchainNetworks = {
  NearMainnet: 'NearMainnet',
  NearTestnet: 'NearTestnet',
} as const;

/**
 * Collection of supported Solana blockchain networks.
 *
 * @enum
 */
export const SolanaBlockchainNetworks = {
  SolanaDevnet: 'SolanaDevnet',
  SolanaMainnet: 'SolanaMainnet',
  SolanaTestnet: 'SolanaTestnet',
} as const;

/**
 * Collection of supported blockchain networks.
 *
 * @enum
 */
export const BlockchainNetworks = {
  ...EvmBlockchainNetworks,
  ...NearBlockchainNetworks,
  ...SolanaBlockchainNetworks,
} as const;

/**
 * @internal
 */
export const BlockchainNetworkDetails: Record<BlockchainNetwork, BlockchainNetworkInfo> = {
  EthereumGoerli: {
    blockchain: Blockchains.Ethereum,
    rpcUrl: 'https://rpc.ankr.com/eth_goerli',
    chainId: '0x5',
    isMainnet: false,
  },
  EthereumMainnet: {
    blockchain: Blockchains.Ethereum,
    rpcUrl: 'https://rpc.ankr.com/eth',
    chainId: '0x1',
    isMainnet: true,
  },
  NearMainnet: {
    blockchain: Blockchains.Near,
    rpcUrl: 'https://rpc.mainnet.near.org',
    isMainnet: true,
  },
  NearTestnet: {
    blockchain: Blockchains.Near,
    rpcUrl: 'https://rpc.testnet.near.org',
    isMainnet: false,
  },
  PolygonMainnet: {
    blockchain: Blockchains.Ethereum,
    rpcUrl: 'https://polygon-rpc.com',
    chainId: '0x89',
    isMainnet: true,
  },
  PolygonMumbai: {
    blockchain: Blockchains.Ethereum,
    rpcUrl: 'https://matic-mumbai.chainstacklabs.com',
    chainId: '0x13881',
    isMainnet: false,
  },
  SolanaDevnet: {
    blockchain: Blockchains.Solana,
    rpcUrl: 'https://api.devnet.solana.com',
    isMainnet: false,
  },
  SolanaMainnet: {
    blockchain: Blockchains.Solana,
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    isMainnet: true,
  },
  SolanaTestnet: {
    blockchain: Blockchains.Solana,
    rpcUrl: 'https://api.testnet.solana.com',
    isMainnet: false,
  },
};

/**
 * @deprecated since version 0.1.3
 *
 * Collection of available environment types for initializing the SDK.
 *
 * @enum
 */
export const KycDaoEnvironments = {
  /**
   * Demo mode is intended to be more conveninet for demonstrating (and also developing) the integration with kycDAO.\
   * Compared to the `test` mode it removes some verification and minting restrictions so the same wallet/user can be used multiple times to start/finish the flows.
   */
  demo: 'demo',
  /**
   * Test mode is intended to behave the same way as `production` but using test/sandbox servers and services of third party providers.
   */
  test: 'test',
} as const;

/**
  @enum
*/
export const VerificationProviders = {
  ParallelMarkets: 'ParallelMarkets',
  Persona: 'Persona',
  VerifyInvestor: 'VerifyInvestor',
} as const;

/**
  @enum
*/
export const VerificationStasuses = {
  Created: 'Created',
  Failed: 'Failed',
  InReview: 'InReview',
  Verified: 'Verified',
  NotVerified: 'NotVerified',
} as const;

/**
 * Collection of supported verification low types.
 *
 * @enum
 */
export const VerificationTypes = {
  AccreditedInvestor: 'AccreditedInvestor',
  KYC: 'KYC',
} as const;

/**
  @enum
*/
export const WalletProviders = {
  Near: 'Near',
  MetaMask: 'MetaMask',
  WalletConnect: 'WalletConnect',
} as const;

export const KYCDAO_PUBLIC_API_PATH = 'api/public/';

export const NEAR_TESTNET_CONFIG: ConnectConfig = {
  networkId: 'testnet',
  nodeUrl: 'https://rpc.testnet.near.org',
  walletUrl: 'https://wallet.testnet.near.org',
  helperUrl: 'https://helper.testnet.near.org',
  headers: {},
};

export const NEAR_MAINNET_CONFIG: ConnectConfig = {
  networkId: 'mainnet',
  nodeUrl: 'https://rpc.mainnet.near.org',
  walletUrl: 'https://wallet.mainnet.near.org',
  helperUrl: 'https://helper.mainnet.near.org',
  headers: {},
};

export const NEAR_TESTNET_ARCHIVAL = 'https://archival-rpc.testnet.near.org';

export const NEAR_MAINNET_ARCHIVAL = 'https://archival-rpc.mainnet.near.org';
