import {
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  getAssociatedTokenAddress,
  getMinimumBalanceForRentExemptAccount,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  MessageSignerWalletAdapter,
  SignerWalletAdapter,
  WalletAdapter,
  WalletAdapterNetwork,
  WalletReadyState,
} from '@solana/wallet-adapter-base';
import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionBlockhashCtor,
} from '@solana/web3.js';
import bs58 from 'bs58';
import {
  SolanaBlockchainNetwork,
  Transaction as SdkTransaction,
  TransactionStatus as SdkTransactionStatus,
} from 'src/types';
import { isLike } from 'src/utils';
import { mintAndFreezeNft } from './contract';

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

  public async mint(
    toAddress: string,
    fromAddress: string,
    _authCode: string,
  ): Promise<string | undefined> {
    if (!this._adapter) {
      throw new Error('Solana wallet adapter not initialized');
    }

    if (toAddress.startsWith('0x')) {
      toAddress = toAddress.slice(2);
    }

    const programID = new PublicKey(toAddress);

    const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

    const walletPubKey = new PublicKey(fromAddress);
    const mintKey = Keypair.generate();
    const mintPubKey = mintKey.publicKey;

    const lamports = await getMinimumBalanceForRentExemptAccount(this._connection);

    const tokenAccount = await getAssociatedTokenAddress(mintPubKey, walletPubKey);

    const getMetadata = async (mint: PublicKey): Promise<PublicKey> => {
      return (
        await PublicKey.findProgramAddress(
          [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
          TOKEN_METADATA_PROGRAM_ID,
        )
      )[0];
    };

    const metadataAddress = await getMetadata(mintKey.publicKey);

    const mintInstruction = mintAndFreezeNft(
      programID,
      {
        creatorKey: mintKey.publicKey,
        uri: 'https://cdn.madskullz.io/madskullz/metadata/2795.json',
        title: 'Frozen NFT 2',
      },
      {
        mintAuthority: walletPubKey,
        mint: mintKey.publicKey,
        tokenAccount: tokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        metadata: metadataAddress,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        payer: walletPubKey,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      },
    );

    const latestBlockhash = await this._connection.getLatestBlockhash();

    const mintTransaction = new Transaction({
      ...latestBlockhash,
      feePayer: walletPubKey,
    } as TransactionBlockhashCtor).add(
      SystemProgram.createAccount({
        fromPubkey: walletPubKey,
        newAccountPubkey: mintPubKey,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
        lamports,
      }),
      createInitializeMintInstruction(mintPubKey, 0, walletPubKey, walletPubKey),
      createAssociatedTokenAccountInstruction(walletPubKey, tokenAccount, walletPubKey, mintPubKey),
      mintInstruction,
    );

    mintTransaction.partialSign(mintKey);
    return await this._adapter.sendTransaction(mintTransaction, this._connection);
  }

  public async getTransaction(txHash: string): Promise<SdkTransaction> {
    try {
      // TODO added acceptance of fake auth minting result, because of KYC-413
      if (txHash === 'fake_solana_authorize_minting_hash') {
        return { status: 'Success' };
      }

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
