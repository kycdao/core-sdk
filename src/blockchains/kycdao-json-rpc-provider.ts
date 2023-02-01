import { InternalError, UnreachableCaseError } from '../errors';
import { Blockchain } from '../types';
import { EvmJsonRpcProvider } from './evm/evm-json-rpc-provider';
import { NearJsonRpcProvider } from './near/near-json-rpc-provider';

export interface IKycDaoJsonRpcProvider {
  hasValidToken(contractAddress: string, targetAddress: string): Promise<boolean>;
}

export class KycDaoJsonRpcProvider {
  private url: string;
  private provider: IKycDaoJsonRpcProvider;

  constructor(blockchain: Blockchain, url: string) {
    this.url = url;

    switch (blockchain) {
      case 'Ethereum': {
        this.provider = new EvmJsonRpcProvider(this.url);
        break;
      }
      case 'Near': {
        this.provider = new NearJsonRpcProvider(this.url);
        break;
      }
      case 'Solana': {
        throw new InternalError('Solana is not supported yet');
        break;
      }
      default:
        throw new UnreachableCaseError(blockchain);
    }
  }

  public async hasValidToken(contractAddress: string, targetAddress: string): Promise<boolean> {
    return this.provider.hasValidToken(contractAddress, targetAddress);
  }
}
