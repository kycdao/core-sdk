/* TYPES */

export type Blockchain = 'Ethereum' | 'Near';

export type VerificationType = 'KYB' | 'KYC';

/* INTERFACES */

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

export interface VerificationData {
  email: string;
  isEmailConfirmed: boolean;
  taxResidency: string;
  isLegalEntity: boolean;
  verificationType: VerificationType;
}
