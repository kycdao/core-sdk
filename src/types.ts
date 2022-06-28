import { ConnectConfig, Contract, Near, WalletConnection } from 'near-api-js';
import { BrowserLocalStorageKeyStore } from 'near-api-js/lib/key_stores';
import { FinalExecutionOutcome } from 'near-api-js/lib/providers';
import {
  BlockchainNetworks,
  Blockchains,
  KycDaoEnvironments,
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
 * Union type of string values of {@link BlockchainNetworks}.
 *
 * @typedef {BlockchainNetwork}
 */
export type BlockchainNetwork = keyof typeof BlockchainNetworks;

/**
 * Union type of string values of {@link KycDaoEnvironments}.
 *
 * @typedef {KycDaoEnvironment}
 */
export type KycDaoEnvironment = keyof typeof KycDaoEnvironments;

/**
 * @internal
 */
export type TransactionData = FinalExecutionOutcome;

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
   * Environment type used for influencing the behavior of the SDK.
   *
   * @see {@link KycDaoEnvironments} for more details.
   * @type {KycDaoEnvironment}
   */
  environment: KycDaoEnvironment;
  /**
   * The base API URL of the kycDAO server to connect to.
   *
   * @type {string}
   */
  baseUrl: string;
  /**
   * List of {@link BlockchainNetworks} to be available to use.\
   * This can influence what third party providers will get initialized.
   *
   * @type {BlockchainNetwork[]}
   */
  enabledBlockchainNetworks: BlockchainNetwork[];
  /**
   * List of {@link VerificationTypes} to be available to use.\
   * This can influence what third party providers will get initialized.
   *
   * @type {VerificationType[]}
   */
  enabledVerificationTypes: VerificationType[];
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
   * The wallet address.
   *
   * @type {string}
   */
  address: string;
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
}

/* INTERNAL (not in API reference) */

export interface ApiStatus {
  current_time: string;
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
  keyStore: BrowserLocalStorageKeyStore;
  config: ConnectConfig;
  api: Near;
  wallet: WalletConnection;
  archival: string;
  contractName: string;
}

export interface KycDaoContract extends Contract {
  mint: (_: {
    args: Record<string, unknown>;
    gas: string;
    amount: string;
    callbackUrl?: string;
  }) => Promise<unknown>;
}

export interface Transaction {
  status: TransactionStatus;
  data: TransactionData;
}

export interface ProviderProfile {
  id: number;
  created: string;
  user_id: number;
  provider_name: VerificationProvider;
  provider_profile_id: string;
}

export interface Token {
  id: number;
  blockchain_account_id: number;
  network: BlockchainNetwork;
  authorization_code: string;
  authorization_tx_id?: string;
  minted_at?: string;
  minting_tx_id?: string;
  token_id?: string;
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
  tokens: Token[];
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
  chain_and_address: ChainAndAddress;
  usable_networks: BlockchainNetwork[];
  allow_list_entry?: AllowListEntry;
  user?: UserDetails;
}

export interface MintingAuthorizationRequest {
  blockchain_account_id: number;
  network: string;
}

export interface MintingAuthorizationResponse {
  code: string;
  tx_hash: string;
}
