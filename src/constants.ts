import { ConnectConfig } from 'near-api-js';
import { EvmBlockchainNetwork } from './types';

/**
 * Collection of supported blockchains.
 *
 * @enum
 * @type {{ readonly Ethereum: "Ethereum"; readonly Near: "Near"; }}
 */
export const Blockchains = {
  Ethereum: 'Ethereum',
  Near: 'Near',
} as const;

/**
 * Collection of supported blockchain networks.
 *
 * @internal
 * @enum
 * @type {{ readonly EthereumMainnet: "EthereumMainnet"; readonly EthereumRinkeby: "EthereumRinkeby"; readonly PolygonMainnet: "PolygonMainnet"; readonly PolygonMumbai: "PolygonMumbai"; }}
 */
export const EvmBlockchainNetworks = {
  EthereumMainnet: 'EthereumMainnet',
  EthereumRinkeby: 'EthereumRinkeby',
  PolygonMainnet: 'PolygonMainnet',
  PolygonMumbai: 'PolygonMumbai',
} as const;

/**
 * @internal
 */
export const EvmBlockchainNetworkChainIdMapping: {
  network: EvmBlockchainNetwork;
  chainId: string;
}[] = [
  { network: 'EthereumMainnet', chainId: '0x1' },
  { network: 'EthereumRinkeby', chainId: '0x4' },
  { network: 'PolygonMainnet', chainId: '0x89' },
  { network: 'PolygonMumbai', chainId: '0x13881' },
];

/**
 * Collection of supported NEAR blockchain networks.
 *
 * @internal
 * @enum
 * @type {{ readonly NearTestnet: "NearTestnet"; readonly NearMainnet: "NearMainnet"; }}
 */
export const NearBlockchainNetworks = {
  NearTestnet: 'NearTestnet',
  NearMainnet: 'NearMainnet',
} as const;

/**
 * Collection of supported blockchain networks.
 *
 * @enum
 * @type {{ readonly NearTestnet: "NearTestnet"; readonly NearMainnet: "NearMainnet"; readonly EthereumMainnet: "EthereumMainnet"; readonly EthereumRinkeby: "EthereumRinkeby"; readonly PolygonMainnet: "PolygonMainnet"; readonly PolygonMumbai: "PolygonMumbai"; }}
 */
export const BlockchainNetworks = { ...EvmBlockchainNetworks, ...NearBlockchainNetworks } as const;

/**
 * @deprecated since version 0.1.3
 *
 * Collection of available environment types for initializing the SDK.
 *
 * @enum
 * @type {{ readonly demo: "demo"; readonly test: "test"; }}
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
 * @type {{ readonly AccreditedInvestor: "AccreditedInvestor"; readonly KYC: "KYC"; }}
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
