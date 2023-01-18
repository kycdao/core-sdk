import {
  MessageSignerWalletAdapter,
  SignerWalletAdapter,
  WalletAdapter,
  WalletAdapterNetwork,
  WalletReadyState,
} from '@solana/wallet-adapter-base';
import { clusterApiUrl, Connection, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import {
  SolanaBlockchainNetwork,
  Transaction as SdkTransaction,
  TransactionStatus as SdkTransactionStatus,
} from '../../types';
import { isLike } from '../../utils';

const WalletAdapterNetworkMapping: Record<SolanaBlockchainNetwork, WalletAdapterNetwork> = {
  SolanaDevnet: WalletAdapterNetwork.Devnet,
  SolanaMainnet: WalletAdapterNetwork.Mainnet,
  SolanaTestnet: WalletAdapterNetwork.Testnet,
};

export type Adapter = WalletAdapter | SignerWalletAdapter | MessageSignerWalletAdapter;

export class SolanaProviderWrapper {
  private _blockchainNetwork: SolanaBlockchainNetwork;
  public get blockchainNetwork(): SolanaBlockchainNetwork {
    return this._blockchainNetwork;
  }

  private _network: WalletAdapterNetwork;
  private _connection: Connection;

  private _adapter?: Adapter;
  set adapter(adapter: Adapter) {
    this._adapter = adapter;
  }

  get address(): string | undefined {
    return this._adapter?.publicKey?.toBase58();
  }

  constructor(blockchainNetwork: SolanaBlockchainNetwork) {
    this._blockchainNetwork = blockchainNetwork;
    this._network = WalletAdapterNetworkMapping[blockchainNetwork];
    this._connection = new Connection(clusterApiUrl(this._network), 'processed');
  }

  // TODO revisit this
  get ready(): boolean {
    return (
      !!this._adapter &&
      (this._adapter.readyState === WalletReadyState.Installed ||
        this._adapter.readyState === WalletReadyState.Loadable)
    );
  }

  // TODO revisit this
  get connected(): boolean {
    return !!this._adapter?.connected;
  }

  // TODO revisit this
  public async connect(): Promise<void> {
    if (this.ready && !this.connected) {
      return this._adapter?.connect();
    }
  }

  // TODO revisit this
  public async disconnect(): Promise<void> {
    if (this.ready && this.connected) {
      return this._adapter?.disconnect();
    }
  }

  public async signMessage(message: string): Promise<string> {
    if (!isLike<MessageSignerWalletAdapter>(this._adapter)) {
      throw new Error('Solana wallet adapter not initialized');
    }

    if (!(typeof this._adapter.signMessage === 'function')) {
      throw new Error('Initialized wallet provider is unable to sign messages');
    }

    const signature = await this._adapter.signMessage(Buffer.from(message, 'utf-8'));
    return bs58.encode(signature);
  }

  public async mint(toAddress: string, mintTransaction: Transaction): Promise<string> {
    if (!this._adapter) {
      throw new Error('Solana wallet adapter not initialized');
    }

    if (toAddress.startsWith('0x')) {
      toAddress = toAddress.slice(2);
    }

    return await this._adapter.sendTransaction(mintTransaction, this._connection);
  }

  public async getTransaction(txHash: string): Promise<SdkTransaction> {
    try {
      const receipt = await this._connection.getTransaction(txHash, {
        commitment: 'finalized',
        maxSupportedTransactionVersion: 0, // it has to be a number and the only number version is 0
      });

      if (receipt === null) {
        throw new Error(`Transaction ${txHash} doesn't exist`);
      } else {
        const postTokenBalances = receipt.meta?.postTokenBalances;
        const status: SdkTransactionStatus = receipt.meta?.err === null ? 'Success' : 'Unknown'; // TODO Should this be failure? I'm not sure how this works.
        if (postTokenBalances && postTokenBalances.length === 1) {
          const tokenAmount = postTokenBalances[0].uiTokenAmount;
          if (tokenAmount.uiAmount === 1 && tokenAmount.decimals === 0) {
            const tokenId = postTokenBalances[0].mint;
            return {
              status: status,
              data: tokenId.toString(),
            };
          } else {
            return {
              status: status,
            };
          }
        } else {
          return {
            status: status,
          };
        }
      }
    } catch (e) {
      throw new Error(`Unexpected error while checking Solana transaction: ${e}`);
    }
  }
}
