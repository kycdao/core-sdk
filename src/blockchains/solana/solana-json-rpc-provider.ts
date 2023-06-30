import { IKycDaoJsonRpcProvider } from '../kycdao-json-rpc-provider';
import { NetworkAndAddress, NftCheckResponse, TokenMetadata } from '../../types';
import {
  Transaction as SdkTransaction,
  TransactionStatus as SdkTransactionStatus,
} from '../../types';
import { Catch, InternalError, KycDaoSDKError } from '../../errors';
import { Program, web3, BN } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as SPLToken from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';
import * as idl from './ntnft.json';
import { Ntnft } from './types/ntnft';
import { getStatusId, getMetadata } from './utils';
import { Metadata } from '@metaplex-foundation/mpl-token-metadata';

export class SolanaJsonRpcProvider implements IKycDaoJsonRpcProvider {
  private contractAddress: string;
  private connection: Connection;
  private program: Program<Ntnft>;

  constructor(contractAddress: string, url: string) {
    this.contractAddress = contractAddress;
    const connection = new Connection(url, 'confirmed');
    this.connection = connection;

    this.program = new Program<Ntnft>(idl as Ntnft, contractAddress, { connection });
  }

  @Catch()
  private async getValidNftsCore(targetAddress: NetworkAndAddress): Promise<NftCheckResponse> {
    if (await this.hasValidNft(targetAddress.address)) {
      return {
        networkAndAddress: targetAddress,
        hasValidNft: true,
        tokens: [await this.getTokenMetadata(targetAddress.address)],
      };
    } else {
      return {
        networkAndAddress: targetAddress,
        hasValidNft: false,
      };
    }
  }

  public async getTransaction(txHash: string): Promise<SdkTransaction> {
    try {
      const receipt = await this.connection.getTransaction(txHash, {
        commitment: 'finalized',
        maxSupportedTransactionVersion: 0, // it has to be a number and the only number version is 0
      });

      if (receipt === null) {
        throw new InternalError(`Transaction ${txHash} doesn't exist`);
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
      throw new InternalError(`Unexpected error while checking Solana transaction: ${e}`);
    }
  }

  private async getTokenMetadata(targetAddress: string): Promise<TokenMetadata> {
    const targetPubKey = new web3.PublicKey(targetAddress);

    const allTokens = await this.connection.getTokenAccountsByOwner(targetPubKey, {
      programId: TOKEN_PROGRAM_ID,
    });

    // This is fast but not secure, we would grab anything with KYCDAO NFT as the name
    // If we're worried we can check the token's signatures include the program address
    for (const t of allTokens.value) {
      const accountInfo = SPLToken.AccountLayout.decode(t.account.data);
      if (Number(accountInfo.amount) == 1 && accountInfo.state == SPLToken.AccountState.Frozen) {
        const mint = new PublicKey(accountInfo.mint);
        const metadataAcct = await getMetadata(mint);
        const mplMeta = await Metadata.fromAccountAddress(this.connection, metadataAcct);
        if (mplMeta.data.name.replace(/\0/g, '') == 'KYCDAO NFT') {
          const metaResp = await fetch(mplMeta.data.uri);
          const tokenMeta = await metaResp.json();
          return tokenMeta;
        }
      }
    }

    throw new Error(`No valid NFT found for ${targetAddress}`);
  }

  public async hasValidNft(targetAddress: string): Promise<boolean> {
    const targetPubKey = new web3.PublicKey(targetAddress);
    const programPubKey = new web3.PublicKey(this.contractAddress);

    const [statusId, _bump] = await getStatusId(targetPubKey, programPubKey);
    const statusAcct = await this.connection.getAccountInfo(statusId);
    if (!statusAcct) {
      return false;
    }

    // Ideally we'd simulate the onchain hasValidToken here but Solana's not great at simulating...
    const statusInfo = await this.program.account.kycDaoNftStatus.fetch(statusId);
    return statusInfo.data.isValid && statusInfo.data.expiry > new BN(Date.now() / 1000);
  }

  public async getValidNfts(targetAddress: NetworkAndAddress): Promise<NftCheckResponse> {
    try {
      return this.getValidNftsCore(targetAddress);
    } catch (e) {
      let error;

      if (e instanceof KycDaoSDKError) {
        error = e;
      } else {
        error = new InternalError(String(e));
      }
      const errorMessage = error.toString();

      return {
        networkAndAddress: targetAddress,
        error: errorMessage,
      };
    }
  }
}
