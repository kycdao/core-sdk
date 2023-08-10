import { InternalError } from '../../errors';
import { AptosBlockchainNetwork, MintDetails } from '../../types';
import { Network } from 'aptos';
import { IWeb3Wallet, AptosSignature } from './types';

export const NetworkMapping: Record<AptosBlockchainNetwork, Network> = {
  AptosDevnet: Network.DEVNET,
  AptosMainnet: Network.MAINNET,
  AptosTestnet: Network.TESTNET,
};

export class AptosProviderWrapper {
  private _blockchainNetwork: AptosBlockchainNetwork;
  public get blockchainNetwork(): AptosBlockchainNetwork {
    return this._blockchainNetwork;
  }

  private _wallet?: IWeb3Wallet;

  public async address(): Promise<string | undefined> {
    const account = await this._wallet?.account();
    return account?.address;
  }

  public async publicKey(): Promise<string | undefined> {
    const account = await this._wallet?.account();
    return account?.publicKey;
  }

  constructor(blockchainNetwork: AptosBlockchainNetwork) {
    this._blockchainNetwork = blockchainNetwork;
  }

  public async connected(): Promise<boolean> {
    return (await this._wallet?.isConnected()) || false;
  }

  public async connect(): Promise<void> {
    // TODO: Probably dont want to touch the window object here,
    // in the future we should handle this as we do evmProvider
    if ('aptos' in window) {
      this._wallet = window.aptos as IWeb3Wallet;
      await this._wallet.connect();
    } else {
      throw new InternalError('Aptos wallet not installed');
    }
    return;
  }

  public async disconnect(): Promise<void> {
    if (await this._wallet?.disconnect()) {
      return;
    }
  }

  public async signMessage(message: string): Promise<AptosSignature> {
    if (!this._wallet) {
      throw new InternalError('Aptos wallet not initialized');
    }

    // Unfortunately it's compulsory to pass a nonce, which is added as a suffix,
    // also 'APTOS' is added as the prefix. This is hard-coded into the backend signature verification
    const response = await this._wallet.signMessage({
      message: message,
      nonce: '0',
    });

    return {
      signature: response.signature as string,
      publicKey: (await this.publicKey()) as string,
      network: this._blockchainNetwork,
    };
  }

  public async mint(contractAddress: string, mintDetails: MintDetails): Promise<string> {
    if (!this._wallet) {
      throw new InternalError('Aptos wallet not initialized');
    }

    contractAddress = contractAddress.startsWith('0x') ? contractAddress : `0x${contractAddress}`;

    const sigBytes = Uint8Array.from(Buffer.from(mintDetails.signature, 'hex'));

    const args = [
      mintDetails.metadata_cid,
      mintDetails.expiry,
      mintDetails.seconds_to_pay,
      mintDetails.verification_tier,
      sigBytes,
    ];

    const pendingTx = await this._wallet.signAndSubmitTransaction({
      function: `${contractAddress}::kycdao_sbt::mint_with_signature`,
      type_arguments: [],
      arguments: args,
    });

    return pendingTx.hash;
  }
}
