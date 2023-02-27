import { JsonRpcProvider } from 'near-api-js/lib/providers';
import { CodeResult } from 'near-api-js/lib/providers/provider';
import { InternalError } from '../../errors';
import { NetworkAndAddress, NftCheckResponse } from '../../types';
import { IKycDaoJsonRpcProvider } from '../kycdao-json-rpc-provider';

export class NearJsonRpcProvider implements IKycDaoJsonRpcProvider {
  private contractAddress: string;
  private url: string;
  private provider: JsonRpcProvider;

  constructor(contractAddress: string, url: string) {
    this.contractAddress = contractAddress;
    this.url = url;
    this.provider = new JsonRpcProvider({ url });
  }

  public async hasValidNft(targetAddress: string): Promise<boolean> {
    const args = { address: targetAddress };
    const argsBase64 = Buffer.from(JSON.stringify(args)).toString('base64');

    try {
      const rawResult = await this.provider.query<CodeResult>({
        request_type: 'call_function',
        account_id: this.contractAddress,
        method_name: 'has_valid_token',
        args_base64: argsBase64,
        finality: 'final',
      });

      const result: boolean = JSON.parse(Buffer.from(rawResult.result).toString());

      return result;
    } catch (e) {
      console.error(e);
      throw new InternalError('NEAR RPC query error');
    }
  }

  public async getValidNfts(_targetAddress: NetworkAndAddress): Promise<NftCheckResponse> {
    throw new InternalError('Getting NFT data is not supported for NEAR yet.');
  }
}
