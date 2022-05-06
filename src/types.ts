export interface ApiStatus {
  current_time: string;
}

export interface PackageStatus {
  name: string;
  version: string;
  serverBaseUrl: string;
  apiStatus: string;
}

export type Blockchains = 'Ethereum' | 'Near';

export interface CreateSessionRequest {
  blockchain: Blockchains;
  address: string;
  legal_entity?: boolean;
  // 2 letter ISO CCA2 code
  residency?: string;
  email?: string;
}
