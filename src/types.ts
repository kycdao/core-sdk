import { ConnectConfig, Near, WalletConnection } from 'near-api-js';
import { BrowserLocalStorageKeyStore } from 'near-api-js/lib/key_stores';
import { BlockchainNetworks, Blockchains, VerificationTypes, WalletProviders } from './constants';

/* TYPES */

export type Blockchain = typeof Blockchains[number];

export type BlockchainNetwork = typeof BlockchainNetworks[number];

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
