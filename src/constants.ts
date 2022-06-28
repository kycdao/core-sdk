import { ConnectConfig } from 'near-api-js';
import { ClientOptions } from 'persona';

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
 * @enum
 * @type {{ readonly NearTestnet: "NearTestnet"; readonly NearMainnet: "NearMainnet"; readonly PolygonMumbai: "PolygonMumbai"; }}
 */
export const BlockchainNetworks = {
  NearTestnet: 'NearTestnet',
  NearMainnet: 'NearMainnet',
  PolygonMumbai: 'PolygonMumbai',
} as const;

/**
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
 * @type {{ readonly Accreditation: "Accreditation"; readonly KYC: "KYC"; }}
 */
export const VerificationTypes = {
  Accreditation: 'Accreditation',
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

export const NEAR_TESTNET_CONFIG: ConnectConfig = {
  networkId: 'testnet',
  nodeUrl: 'https://rpc.testnet.near.org',
  walletUrl: 'https://wallet.testnet.near.org',
  helperUrl: 'https://helper.testnet.near.org',
  headers: {},
};

export const NEAR_TESTNET_ARCHIVAL = 'https://archival-rpc.testnet.near.org';

export const PERSONA_SANDBOX_OPTIONS: ClientOptions = {
  environment: 'sandbox',
  templateId: 'itmpl_JD2di4nkGV3cZMYPhh98atkC',
};
