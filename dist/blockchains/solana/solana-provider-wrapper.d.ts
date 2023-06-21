import { MessageSignerWalletAdapter, SignerWalletAdapter, WalletAdapter } from '@solana/wallet-adapter-base';
import { Transaction } from '@solana/web3.js';
import { SolanaBlockchainNetwork, Transaction as SdkTransaction } from '../../types';
export type Adapter = WalletAdapter | SignerWalletAdapter | MessageSignerWalletAdapter;
export declare class SolanaProviderWrapper {
    private _blockchainNetwork;
    get blockchainNetwork(): SolanaBlockchainNetwork;
    private _network;
    private _connection;
    private _adapter?;
    set adapter(adapter: Adapter);
    get address(): string | undefined;
    constructor(blockchainNetwork: SolanaBlockchainNetwork);
    get ready(): boolean;
    get connected(): boolean;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    signMessage(message: string): Promise<string>;
    mint(toAddress: string, mintTransaction: Transaction): Promise<string>;
    getTransaction(txHash: string): Promise<SdkTransaction>;
}
