import { ConnectConfig, Contract, Near, WalletConnection } from 'near-api-js';
import { BrowserLocalStorageKeyStore } from 'near-api-js/lib/key_stores';
import { FinalExecutionOutcome } from 'near-api-js/lib/providers';
import { EvmTransactionReceipt } from './blockchains/evm/types';
import {
  BlockchainNetworks,
  Blockchains,
  EvmBlockchainNetworks,
  KycDaoEnvironments,
  NearBlockchainNetworks,
  TokenImageTypes,
  SolanaBlockchainNetworks,
  VerificationProviders,
  VerificationStasuses,
  VerificationTypes,
  WalletProviders,
} from './constants';

/* TYPES */

/**
 * Union type of string values of {@link Blockchains}.
 *
 * @typedef {Blockchain}
 */
export type Blockchain = keyof typeof Blockchains;

/**
 * Union type of string values of {@link EvmBlockchainNetworks}.
 *
 * @typedef {EvmBlockchainNetwork}
 */
export type EvmBlockchainNetwork = keyof typeof EvmBlockchainNetworks;

/**
 * Union type of string values of {@link NearBlockchainNetworks}.
 *
 * @typedef {NearBlockchainNetwork}
 */
export type NearBlockchainNetwork = keyof typeof NearBlockchainNetworks;

/**
 * Union type of string values of {@link SolanaBlockchainNetworks}.
 *
 * @typedef {SolanaBlockchainNetwork}
 */
export type SolanaBlockchainNetwork = keyof typeof SolanaBlockchainNetworks;

/**
 * Union type of string values of {@link BlockchainNetworks}.
 *
 * @typedef {BlockchainNetwork}
 */
export type BlockchainNetwork = keyof typeof BlockchainNetworks;

/**
 * @deprecated since version 0.1.3
 *
 * Union type of string values of {@link KycDaoEnvironments}.
 *
 * @typedef {KycDaoEnvironment}
 */
export type KycDaoEnvironment = keyof typeof KycDaoEnvironments;

/**
 * Union type of string values of {@link TokenImageTypes}.
 *
 * @internal
 * @typedef {TokenImageType}
 */
export type TokenImageType = keyof typeof TokenImageTypes;

/**
 * @internal
 */
export type TransactionData = FinalExecutionOutcome | EvmTransactionReceipt | string;

/**
 * @internal
 */
export type TransactionStatus = 'NotStarted' | 'Started' | 'Success' | 'Failure' | 'Unknown';

/**
 * @internal
 */
export type VerificationProvider = keyof typeof VerificationProviders;

/**
 * @internal
 */
export type VerificationStasus = keyof typeof VerificationStasuses;

/**
 * Union type of string values of {@link VerificationTypes}.
 *
 * @typedef {VerificationType}
 */
export type VerificationType = keyof typeof VerificationTypes;

/**
 * Type for representing verified status for possible verification types with a boolean flag.
 *
 * @typedef {VerificationStasusByType}
 */
export type VerificationStasusByType = Partial<Record<VerificationType, boolean>>;

/**
 * @internal
 */
export type WalletProvider = keyof typeof WalletProviders;

/**
 * Possible events handled by the SDK during initialization after a redirect.
 *
 * @typedef {RedirectEvent}
 */
export type RedirectEvent = 'NearLogin' | 'NearMint' | 'NearUserRejectedError';

/* INTERFACES */

/* PUBLIC (included in API reference)*/

export interface BlockchainNetworkConfiguration {
  rpcUrl?: string;
}

/**
 * Configuration parameters required for instantiating the SDK object.
 *
 * @interface SdkConfiguration
 * @typedef {SdkConfiguration}
 */
export interface SdkConfiguration {
  /**
   * **CURRENTLY UNUSED**\
   * Optional API key used to identify the client initializing the SDK.
   *
   * @type {?string}
   */
  apiKey?: string;
  /**
   * @deprecated since version 0.1.3, use {@link demoMode} switch instead.
   *
   * Environment type used for influencing the behavior of the SDK.
   *
   * @see {@link KycDaoEnvironments} for more details.
   * @type {KycDaoEnvironment}
   */
  environment?: KycDaoEnvironment;
  /**
   * Switch for enabling demo mode.\
   * Demo mode is intended to be more conveninet for demonstrating (and also developing) the integration with kycDAO.\
   * It removes some verification and minting restrictions so the same wallet/user can be used multiple times to start/finish the flows.
   *
   * @type {boolean}
   * @default false
   */
  demoMode?: boolean;
  /**
   * The base API URL of the kycDAO server to connect to.\
   * For integration/testing use `https://staging.kycdao.xyz`\
   * For production use `https://kycdao.xyz`
   *
   * @type {string}
   */
  baseUrl: string;
  /**
   * List of {@link BlockchainNetworks} to be available to use. This can influence what third party providers will get initialized.
   * As a rule of thumb test networks will be available when connecting to a kycDAO test server and main networks when connecting to the kycDAO production server (see {@link baseUrl}).
   *
   * @type {BlockchainNetwork[]}
   */
  enabledBlockchainNetworks: BlockchainNetwork[];
  /**
   * List of {@link VerificationTypes} to be available to use.\
   * This can influence what third party providers will get initialized.\
   * \
   * Limitations:\
   * Only networks of a single chain type/protocol can be enabled at a time. Currently we do not allow initialization with multiple protocols.
   *
   * @type {VerificationType[]}
   */
  enabledVerificationTypes: VerificationType[];
  /**
   * If there are any EVM networks enabled this object will be used as the EVM provider (i.e.: MetaMask, WalletConnect or anything [EIP-1193](https://eips.ethereum.org/EIPS/eip-1193), [EIP-2255](https://eips.ethereum.org/EIPS/eip-2255) compatible).
   * Historically, EVM providers have been made available as the `window.ethereum` object in web browsers, but this convention is not part of the mentioned specifications.\
   * \
   * Existance of required methods/fields will be verified during SDK initialization.
   *
   * @type {?unknown}
   */
  evmProvider?: unknown;
  /**
   * An optional blockchain network configuration override parameter which allows certain network related values to be customized (e.g. custom RPC endpoints can be specified)
   *
   * @type {?Partial<Record<BlockchainNetwork, BlockchainNetworkConfiguration>>}
   */
  blockchainNetworkConfiguration?: Partial<
    Record<BlockchainNetwork, BlockchainNetworkConfiguration>
  >;
}

/**
 * The current status of the SDK.
 *
 * @interface SdkStatus
 * @typedef {SdkStatus}
 */
export interface SdkStatus {
  /**
   * The base API URL of the kycDAO server currently used by the SDK.
   *
   * @type {string}
   */
  baseUrl: string;
  /**
   * A flag indicating if demo mode is turned on or not. See {@link SdkConfiguration.demoMode}.
   *
   * @type {boolean}
   */
  demoMode: boolean;
  /**
   * List of {@link BlockchainNetworks} currently available to use. See {@link SdkConfiguration.enabledBlockchainNetworks}.
   *
   * @type {BlockchainNetwork[]}
   */
  availableBlockchainNetworks: BlockchainNetwork[];
  /**
   * List of {@link VerificationTypes} currently available to use. See {@link SdkConfiguration.enabledVerificationTypes}.
   *
   * @type {VerificationType[]}
   */
  availableVerificationTypes: VerificationType[];
  /**
   * A flag indicating if an EVM provider is configured and ready to use or not. See {@link SdkConfiguration.evmProvider}.
   *
   * @type {boolean}
   */
  evmProviderConfigured: boolean;
  /**
   * The NEAR blockchain network currently used by the SDK, `null` if there is none.\
   * This value will depend on the {@link SdkConfiguration} provided and the available networks on the connected kycDAO server.
   *
   * @type {(BlockchainNetwork | null)}
   */
  nearNetworkConnected: NearBlockchainNetwork | null;
  /**
   * The Solana blockchain network currently used by the SDK, `null` if there is none.\
   * This value will depend on the {@link SdkConfiguration} provided and the available networks on the connected kycDAO server.
   *
   * @type {(BlockchainNetwork | null)}
   */
  solanaNetworkConnected: SolanaBlockchainNetwork | null;
}

/**
 * Status of a kycDAO server.
 *
 * @interface ServerStatus
 * @typedef {ServerStatus}
 */
export interface ServerStatus {
  /**
   * The base API URL of the connected kycDAO server.
   *
   * @type {string}
   */
  serverBaseUrl: string;
  /**
   * If the server status is OK it contains the current server datetime in ISO 8601 format.\
   * If it isn't it contains an error message.
   *
   * @type {string}
   */
  apiStatus: string;
  /**
   * Signals if the server is available and accesible or not.
   *
   * @type {boolean}
   */
  isOk: boolean;
}

/**
 * Representation of a blockchain wallet.
 *
 * @interface NetworkAndAddress
 * @typedef {NetworkAndAddress}
 */
export interface NetworkAndAddress {
  /**
   * A blockchain from {@link BlockchainNetworks}.
   *
   * @type {BlockchainNetwork}
   */
  blockchainNetwork: BlockchainNetwork;
  /**
   * The wallet address.
   *
   * @type {string}
   */
  address: string;
}

/**
 * Representation of a blockchain wallet with the implemented blockchain protocol included.
 *
 * @interface ChainAndAddress
 * @typedef {ChainAndAddress}
 */
export interface ChainAndAddress {
  /**
   * A blockchain from {@link Blockchains}.
   *
   * @type {Blockchain}
   */
  blockchain: Blockchain;
  /**
   * A blockchain from {@link BlockchainNetworks}.
   *
   * @type {BlockchainNetwork}
   */
  blockchainNetwork: BlockchainNetwork;
  /**
   * The wallet address.
   *
   * @type {string}
   */
  address: string;
}

/**
 * Information associated with a {@link BlockchainNetwork}.
 *
 * @interface BlockchainNetworkInfo
 * @typedef {BlockchainNetworkInfo}
 */
export interface BlockchainNetworkInfo {
  /**
   * The {@link Blockchain} protocol/platform that the {@link BlockchainNetwork} implements.
   *
   * @type {Blockchain}
   */
  blockchain: Blockchain;
  /**
   * The chain id of the EVM network. A hexadecimal number.
   *
   * @type {?string}
   */
  chainId?: string;
  /**
   * The RPC endpoint used for the on-chain NFT check.
   *
   * @type {string}
   */
  rpcUrl: string;
  /**
   * A flag indicating if this is a main network or not.
   *
   * @type {boolean}
   */
  isMainnet: boolean;
}

export interface Country {
  /**
   * English name of the country.
   *
   * @type {string}
   */
  name: string;
  /**
   * Alphanumeric, 2 character ISO code of the country.
   *
   * @type {string}
   */
  iso_cca2: string;
}

/**
 * Options for the {@link KycDao.hasValidNft} method.
 *
 * @interface NftCheckOptions
 * @typedef {NftCheckOptions}
 */
export interface NftCheckOptions {
  /**
   * The wallet to check for a valid kycDAO NFT. If undefined the current connected wallet will be used.
   *
   * @type {?NetworkAndAddress}
   */
  networkAndAddress?: NetworkAndAddress;
  /**
   * @deprecated since version 0.3.6, use {@link SdkConfiguration.blockchainNetworkConfiguration} instead to override RPC endpoints.
   *
   * A custom RPC endpoint URL to use for the check instead of the default one.
   *
   * @type {string}
   */
  rpcUrl?: string;
}

/**
 * The result of an on-chain valid kycDAO NFT check.
 *
 * @interface NftCheckResponse
 * @typedef {NftCheckResponse}
 */
export interface NftCheckResponse {
  /**
   * The network and wallet address that was checked.
   *
   * @type {NetworkAndAddress}
   */
  networkAndAddress: NetworkAndAddress;
  /**
   * The result of the check.\
   * It will always have a value if the check was successfully performed and it will be undefined if the check failed.
   *
   * @type {?boolean}
   */
  hasValidNft?: boolean;
  /**
   * The error encountered during the check.\
   * It will always have a value if the checking process failed and it will be undefined if the check was successfully performed.
   *
   * @type {?string}
   */
  error?: string;
}

/**
 * Information about a user's active email address
 *
 * @interface EmailData
 * @typedef {EmailData}
 */
export interface EmailData {
  address?: string;
  isConfirmed?: boolean;
}

/**
 * Data required by kycDAO to initiate a verification flow.
 *
 * @interface VerificationData
 * @typedef {VerificationData}
 */
export interface VerificationData {
  /**
   * Email address of the user.
   *
   * @type {string}
   */
  email: string;
  /**
   * Was the email address already confirmed?
   *
   * @type {boolean}
   */
  isEmailConfirmed: boolean;
  /**
   * Country of tax residency. Either the English name or the ISO code of a country from the {@link Countries} list.
   *
   * @type {string}
   */
  taxResidency: string;
  /**
   * Is the user a legal entity or not?
   *
   * @type {boolean}
   */
  isLegalEntity: boolean;
  /**
   * The selected verification type from `enabledVerificationTypes` specified in {@link SdkConfiguration} during initialization.
   *
   * @type {VerificationType}
   */
  verificationType: VerificationType;
  /**
   * Were the kycDAO legal documents accepted by the user? Has to be `true` or verification requests will fail.
   *
   * @type {boolean}
   */
  termsAccepted: boolean;
}

/**
 * Options related to the Persona verification flow.
 *
 * @interface PersonaOptions
 * @typedef {PersonaOptions}
 */
export interface PersonaOptions {
  /**
   * This callback is called when an user cancels the inquiry flow before completion.
   *
   * @type {?() => void}
   */
  onCancel?: () => void;
  /**
   * This callback is called when the inquiry has completed the inquiry flow and the user clicks on the complete button to close the flow.
   *
   * @type {?() => void}
   */
  onComplete?: () => void;
  /**
   * This callback is called in response to errors in the inquiry flow that prevent the inquiry flow from being usable. These generally occur on initial load.
   *
   * @type {?(error: string) => void}
   */
  onError?: (error: string) => void;
  /**
   * Allows specifying additional origins for CSP purposes. Values should
   * include both protocol and host (e.g. https://withpersona.com).
   *
   * This is REQUIRED when the page that embeds the Persona widget is itself
   * embedded in another page as an iframe. The value should be an array of
   * origins for ALL iframes that are ancestors of the Persona iframe.
   *
   * `window.target.origin` is provided by default.
   *
   * @type {?string[]}
   */
  frameAncestors?: string[];
  /**
   * Allows specifying a custom target for `window.postMessage` from the
   * Persona app, which defaults to the iframe origin.
   *
   * This is REQUIRED when the page that embeds the Persona widget is itself
   * embedded in another page as an iframe. The value should be the origin where
   * the Persona SDK is mounted.
   *
   * @type {?string}
   */
  messageTargetOrigin?: string;
}

/**
 * Options related to various verification providers.
 *
 * @interface VerificationProviderOptions
 * @typedef {VerificationProviderOptions}
 */
export interface VerificationProviderOptions {
  /**
   * Options related to the Persona.
   *
   * @type {?PersonaOptions}
   */
  personaOptions?: PersonaOptions;
}

/**
 * Data required by kycDAO to initiate NFT minting.
 *
 * @interface MintingData
 * @typedef {MintingData}
 */
export interface MintingData {
  /**
   * Was the disclaimer about the kycDAO NFTs accepted by the user? Has to be `true` or the minting request will fail.
   *
   * @type {boolean}
   */
  disclaimerAccepted: boolean;
  /**
   * The user has to be verified for this verification type to be able to have a token minted.
   * The {@link KycDao.checkVerificationStatus} method can be used to query/poll the kycDao server and check for the verification status.
   * The verification type determines which smart contract will be used for the minting.
   * It defaults to `"KYC"` when left undefined for backward compatibility reasons.
   *
   * @type {?VerificationType}
   * @default `"KYC"`
   */
  verificationType?: VerificationType;
  /**
   * The ID of the selected image to be minted in the NFT. Has to be one of the keys in the object returned by the {@link KycDao.getNftImageOptions} method.
   * If omitted the first generated identicon will be used from the options.
   *
   * @type {?string}
   */
  imageId?: string;
  /**
   * The number of years for which the user will be subscribed to kycDAO. This will directly influence the expiry time and the minting cost of the token. The default value is 1 year.\
   * Currently it only has any effect if the user is not subscribed yet, otherwise this value will be ignored. The current user's subscription status can be checked with the {@link KycDao.subscribed}.
   *
   * @type {?number}
   */
  subscriptionYears?: number;
}

/**
 * Data related to a successful mint transaction and the minted token.
 *
 * @interface MintingResult
 * @typedef {MintingResult}
 */
export interface MintingResult {
  /**
   * Chain explorer URL of the minting transaction.
   *
   * @type {string}
   */
  transactionUrl: string;
  /**
   * The ID associated with the minted token.
   *
   * @type {string}
   */
  tokenId: string;
  /**
   * The URL of the image associated with the minted token.
   *
   * @type {string}
   */
  imageUrl: string;
}

/* INTERNAL (not in API reference) */

export interface RedirectResult {
  event?: RedirectEvent;
  mintingResult?: MintingResult;
}

export interface PersonaStatus {
  template_id: string;
  sandbox: boolean;
}

export interface SmartContractConfig {
  address: string;
  payment_discount_percent: number;
}

export type SmartContractsByVerificationType = Partial<
  Record<VerificationType, SmartContractConfig>
>;
export type SmartContractsByBlockchainNetwork = Partial<
  Record<BlockchainNetwork, SmartContractsByVerificationType>
>;

export interface KycDaoDefaultApiError {
  code: number;
  reason: string;
  description: string;
}

export interface KycDaoCustomApiError {
  reference_id: string;
  status_code: number;
  internal: boolean;
  error_code: string;
  message: string; // human readable error message
  error_details?: string; // only present for InternalErrors
}

export interface ApiStatus {
  current_time: string;
  persona: PersonaStatus;
  enabled_networks: BlockchainNetwork[];
  smart_contracts_info: SmartContractsByBlockchainNetwork;
}

export interface PersonaSessionData {
  referenceId: string;
  inquiryId: string;
  sessionToken?: string;
}

export interface VerificationStatus {
  personaSessionData?: PersonaSessionData;
}

export interface NearSdk {
  blockchainNetwork: NearBlockchainNetwork;
  keyStore: BrowserLocalStorageKeyStore;
  config: ConnectConfig;
  api: Near;
  wallet: WalletConnection;
  archival: string;
  contractName: string;
}

export interface KycDaoContract extends Contract {
  mint_with_code: (_: {
    args: {
      auth_code: number;
    };
    gas: string;
    amount: string;
    callbackUrl?: string;
  }) => Promise<unknown>;
  get_required_mint_cost_for_code: (_: { auth_code: number; dst: string }) => Promise<string>;
}

export interface Transaction {
  status: TransactionStatus;
  data?: TransactionData;
}

export interface ProviderProfile {
  id: number;
  created: string;
  user_id: number;
  provider_name: VerificationProvider;
  provider_profile_id: string;
}

export interface TokenDetails {
  id: number;
  blockchain_account_id: number;
  network: BlockchainNetwork;
  authorization_code: string;
  authorization_tx_id?: string;
  minted_at?: string;
  minting_tx_id?: string;
  token_id?: string;
  verification_type: VerificationType;
  image_url: string;
}

export interface VerificationRequest {
  id: number;
  user_id: number;
  provider_name: VerificationProvider;
  provider_request_id: string;
  created: string;
  updated: string;
  status: VerificationStasus;
  verification_type: VerificationType;
  expires?: string;
}

export interface BlockchainAccountDetails {
  id: number;
  blockchain: Blockchain;
  address: string;
  user_id: number;
  tokens: TokenDetails[];
}

export interface TokenImage {
  image_type: TokenImageType;
  url: string;
}

export interface UserDetails {
  id: number;
  legal_entity?: boolean;
  created: string;
  residency?: string;
  disclaimer_accepted?: string;
  email?: string;
  email_confirmed?: string;
  user_hash: string;
  ext_id: string;
  provider_profiles: ProviderProfile[];
  verification_requests: VerificationRequest[];
  blockchain_accounts: BlockchainAccountDetails[];
  available_images: { [imageId: string]: TokenImage };
  subscription_expiry?: string;
}

export interface UserUpdateRequest {
  legal_entity?: boolean;
  residency?: string;
  email?: string;
}

export interface AllowListEntry {
  id: number;
  blockchain: Blockchain;
  address: string;
  dao_name?: string;
  image_url?: string;
}

export interface Session {
  id: string;
  expires: string;
  nonce: string;
  eip_4361_message: string;
  chain_and_address: ChainAndAddress;
  usable_networks: BlockchainNetwork[];
  allow_list_entry?: AllowListEntry;
  user?: UserDetails;
}

export interface MintingAuthorizationRequest {
  blockchain_account_id: number;
  network: string;
  selected_image_id?: string;
  subscription_duration?: string;
}

export interface MintingAuthorizationResponse {
  token: TokenDetails;
  metadata_url?: string;
  transaction?: string;
}

export interface TokenMetadata {
  name: string;
  description: string;
  image: string;
}
