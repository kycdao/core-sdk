import { ConnectConfig, Near, WalletConnection } from 'near-api-js';
import { BrowserLocalStorageKeyStore } from 'near-api-js/lib/key_stores';
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

export type Blockchain = typeof Blockchains[number];

export type BlockchainNetwork = typeof BlockchainNetworks[number];

export type KycDaoEnvironment = typeof KycDaoEnvironments[number];

export type VerificationProvider = typeof VerificationProviders[number];

export type VerificationStasus = typeof VerificationStasuses[number];
export type VerificationType = typeof VerificationTypes[number];
export type VerificationStasusByType = { [name: VerificationType]: boolean };

export type WalletProvider = typeof WalletProviders[number];

/* INTERFACES */

export interface SdkConfiguration {
  apiKey?: string;
  environment: KycDaoEnvironment;
  baseUrl: string;
  enbaledBlockchainNetworks: BlockchainNetwork[];
  enbaledVerificationTypes: VerificationType[];
}

export interface ApiStatus {
  current_time: string;
}

export interface ServerStatus {
  serverBaseUrl: string;
  apiStatus: string;
}

export interface ChainAndAddress {
  blockchain: Blockchain;
  address: string;
}

export interface Country {
  name: string;
  iso_cca2: string;
}

export interface VerificationData {
  email: string;
  isEmailConfirmed: boolean;
  taxResidency: string;
  isLegalEntity: boolean;
  verificationType: VerificationType;
  termsAccepted: boolean;
}

export interface PersonaOptions {
  onCancel?: () => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export interface VerificationProviderOptions {
  personaOptions?: PersonaOptions;
}

export interface PersonaSessionData {
  referenceId: string;
  inquiryId: string;
  sessionToken?: string;
}

export interface VerificationStatus {
  personaSessionData?: PersonaSessionData;
}

export interface MintingData {
  disclaimerAccepted: boolean;
}

export interface NearSdk {
  keyStore: BrowserLocalStorageKeyStore;
  config: ConnectConfig;
  api: Near;
  wallet: WalletConnection;
  contractName: string;
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
