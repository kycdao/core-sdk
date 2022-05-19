import { ConnectConfig, Near, WalletConnection } from 'near-api-js';
import { BrowserLocalStorageKeyStore } from 'near-api-js/lib/key_stores';
import {
  BlockchainNetworks,
  Blockchains,
  VerificationProviders,
  VerificationTypes,
  WalletProviders,
} from './constants';

/* TYPES */

export type Blockchain = typeof Blockchains[number];

export type BlockchainNetwork = typeof BlockchainNetworks[number];

export type VerificationProvider = typeof VerificationProviders[number];

export type VerificationType = typeof VerificationTypes[number];

export type WalletProvider = typeof WalletProviders[number];

/* INTERFACES */

export interface SdkConfiguration {
  apiKey?: string;
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
}

export interface NftImage {
  id: string; // seed
  url: string;
  name?: string;
  description?: string;
}

export interface MintingData {
  disclaimerAccepted: boolean;
  nftImageId?: string;
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
  // verification_requests: VerificationRequest[]; // skip this for now, seems unnecessary for the SDK
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
