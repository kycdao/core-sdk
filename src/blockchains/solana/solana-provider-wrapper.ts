import {
  MessageSignerWalletAdapter,
  SignerWalletAdapter,
  WalletAdapter,
  WalletAdapterNetwork,
  WalletReadyState,
} from '@solana/wallet-adapter-base';
import bs58 from 'bs58';
import { SolanaBlockchainNetwork } from 'src/types';
import { isLike } from 'src/utils';

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
  }

  get ready(): boolean {
    return (
      !!this._adapter &&
      (this._adapter.readyState === WalletReadyState.Installed ||
        this._adapter.readyState === WalletReadyState.Loadable)
    );
  }

  get connected(): boolean {
    return !!this._adapter?.connected;
  }

  public async connect(): Promise<void> {
    if (this.ready && !this.connected) {
      return this._adapter?.connect();
    }
  }

  public async disconnect(): Promise<void> {
    if (this.ready && this.connected) {
      return this._adapter?.disconnect();
    }
  }

  public async signMessage(message: string): Promise<string> {
    if (
      isLike<MessageSignerWalletAdapter>(this._adapter) &&
      typeof this._adapter.signMessage === 'function'
    ) {
      const signature = await this._adapter.signMessage(Buffer.from(message, 'utf-8'));
      return bs58.encode(signature);
    } else {
      throw new Error('Initialized wallet provider is unable to sign messages.');
    }
  }
}
