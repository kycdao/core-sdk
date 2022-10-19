import { JsonRpcProvider } from 'near-api-js/lib/providers';
import { CodeResult } from 'near-api-js/lib/providers/provider';
import { IKycDaoJsonRpcProvider } from '../kycdao-json-rpc-provider';

export class NearJsonRpcProvider implements IKycDaoJsonRpcProvider {
  private url: string;
  private provider: JsonRpcProvider;

  constructor(url: string) {
    this.url = url;
    this.provider = new JsonRpcProvider(this.url);
  }

  public async hasValidToken(contractAddress: string, targetAddress: string): Promise<boolean> {
    const args = { address: targetAddress };
    const argsBase64 = Buffer.from(JSON.stringify(args)).toString('base64');

    try {
      const rawResult = await this.provider.query<CodeResult>({
        request_type: 'call_function',
        account_id: contractAddress,
        method_name: 'has_valid_token',
        args_base64: argsBase64,
        finality: 'final',
      });

      const result: boolean = JSON.parse(Buffer.from(rawResult.result).toString());

      return result;
    } catch (e) {
      console.error(e);
      throw new Error('NEAR RPC query error');
    }
  }
}
