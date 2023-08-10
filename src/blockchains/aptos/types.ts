import { Types } from 'aptos';

export type AptosSignature = {
  signature: string;
  publicKey: string;
  network: string;
};

export type PublicAccount = {
  address: string;
  publicKey: string;
};

// This is the standard Aptos wallet interface
export interface IWeb3Wallet {
  connect(): Promise<PublicAccount>;
  disconnect(): Promise<boolean>;
  isConnected(): Promise<boolean>;

  account(): Promise<PublicAccount>;
  network(): Promise<string>;

  signMessage(payload: SignMessagePayload): Promise<SignMessageResponse>;
  signAndSubmitTransaction(payload: Types.EntryFunctionPayload): Promise<Types.PendingTransaction>;
}

export interface SignMessagePayload {
  address?: boolean; // Should we include the address of the account in the message
  application?: boolean; // Should we include the domain of the dApp
  chainId?: boolean; // Should we include the current chain id the wallet is connected to
  message: string; // The message to be signed and displayed to the user
  nonce: string; // A nonce the dApp should generate
}

export interface SignMessageResponse {
  address?: string;
  application?: string;
  chainId?: number;
  fullMessage: string; // The message that was generated to sign
  message: string; // The message passed in by the user
  nonce: string;
  prefix: string; // Should always be APTOS
  signature: string | string[]; // The signed full message
  bitmap?: Uint8Array; // a 4-byte (32 bits) bit-vector of length N
}
