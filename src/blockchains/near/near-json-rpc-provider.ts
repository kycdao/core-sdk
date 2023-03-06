import { JsonRpcProvider } from 'near-api-js/lib/providers';
import { CodeResult } from 'near-api-js/lib/providers/provider';
import { ipfsToHttps } from 'src/utils';
import { Catch, InternalError, KycDaoSDKError } from '../../errors';
import { NetworkAndAddress, NftCheckResponse, TokenMetadata } from '../../types';
import { IKycDaoJsonRpcProvider } from '../kycdao-json-rpc-provider';

interface HasValidTokenArgs {
  address: string;
}

interface NtnftTokensForOwnerArgs {
  account_id: string;
  from_index: string; // it's an U128 and doesn't fit into an Int, that's why it's a string
  limit: number;
}

interface NearTokenMetadata {
  title?: string; // ex. "Arch Nemesis: Mail Carrier" or "Parcel #5055"
  description?: string; // free-form description
  media?: string; // URL to associated media, preferably to decentralized, content-addressed storage
  media_hash?: string; // Base64-encoded sha256 hash of content referenced by the `media` field. Required if `media` is included.
  copies?: number; // number of copies of this set of metadata in existence when token was minted.
  issued_at?: string; // ISO 8601 datetime when token was issued or minted
  expires_at?: string; // ISO 8601 datetime when token expires
  starts_at?: string; // ISO 8601 datetime when token starts being valid
  updated_at?: string; // ISO 8601 datetime when token was last updated
  extra?: string; // anything extra the NFT wants to store on-chain. Can be stringified JSON.
  reference?: string; // URL to an off-chain JSON file with more info.
  reference_hash?: string; // Base64-encoded sha256 hash of JSON from reference field. Required if `reference` is included.
}

interface NtnftToken {
  token_id: string;
  owner_id: string;
  metadata?: NearTokenMetadata;
}

export class NearJsonRpcProvider implements IKycDaoJsonRpcProvider {
  private contractAddress: string;
  private url: string;
  private provider: JsonRpcProvider;

  constructor(contractAddress: string, url: string) {
    this.contractAddress = contractAddress;
    this.url = url;
    this.provider = new JsonRpcProvider({ url });
  }

  public async callFunction<T>(methodName: string, args: object): Promise<T> {
    const argsBase64 = Buffer.from(JSON.stringify(args)).toString('base64');

    try {
      const rawResult = await this.provider.query<CodeResult>({
        request_type: 'call_function',
        account_id: this.contractAddress,
        method_name: methodName,
        args_base64: argsBase64,
        finality: 'final',
      });

      return JSON.parse(Buffer.from(rawResult.result).toString());
    } catch (e) {
      console.error(e);
      throw new InternalError('NEAR RPC query error');
    }
  }

  public async hasValidNft(targetAddress: string): Promise<boolean> {
    const args: HasValidTokenArgs = { address: targetAddress };

    return this.callFunction('has_valid_token', args);
  }

  // for now this will only return the first kycDAO NFT ever minted by the user, we can/will modify this logic later
  private async ntnftTokensForOwner(targetAddress: string): Promise<NtnftToken[]> {
    const args: NtnftTokensForOwnerArgs = { account_id: targetAddress, from_index: '0', limit: 1 };

    return this.callFunction('ntnft_tokens_for_owner', args);
  }

  private validateTokenMetadata(token: NtnftToken): TokenMetadata {
    const metadata = token.metadata;

    // all of these string fields should be defined and shouldn't be empty
    if (!metadata || !metadata.title || !metadata.description || !metadata.media) {
      throw new InternalError('NEAR token metadata is invalid');
    }

    return {
      name: metadata.title,
      description: metadata.description,
      image: ipfsToHttps(metadata.media),
    };
  }

  @Catch()
  private async getValidNftsCore(targetAddress: NetworkAndAddress): Promise<NftCheckResponse> {
    const hasValidNft = await this.hasValidNft(targetAddress.address);

    if (hasValidNft) {
      const tokens = await this.ntnftTokensForOwner(targetAddress.address);

      if (!tokens.length) {
        throw new InternalError('NEAR account has no tokens while it should have at least one.');
      }

      const metadata = this.validateTokenMetadata(tokens[0]);

      return {
        networkAndAddress: targetAddress,
        hasValidNft: true,
        tokens: [metadata],
      };
    } else {
      return {
        networkAndAddress: targetAddress,
        hasValidNft: false,
      };
    }
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
