import { UnreachableCaseError } from '../errors';
import { Blockchain, NetworkAndAddress, NftCheckResponse } from '../types';
import { EvmJsonRpcProvider } from './evm/evm-json-rpc-provider';
import { NearJsonRpcProvider } from './near/near-json-rpc-provider';
import { SolanaJsonRpcProvider } from './solana/solana-json-rpc-provider';

export interface IKycDaoJsonRpcProvider {
  hasValidNft(targetAddress: string): Promise<boolean>;
  getValidNfts(targetAddress: NetworkAndAddress): Promise<NftCheckResponse>;
}

export class KycDaoJsonRpcProvider implements IKycDaoJsonRpcProvider {
  private provider: IKycDaoJsonRpcProvider;

  constructor(blockchain: Blockchain, contractAddress: string, url: string) {
    switch (blockchain) {
      case 'Ethereum': {
        this.provider = new EvmJsonRpcProvider(contractAddress, url);
        break;
      }
      case 'Near': {
        this.provider = new NearJsonRpcProvider(contractAddress, url);
        break;
      }
      case 'Solana': {
        this.provider = new SolanaJsonRpcProvider(contractAddress, url);
        break;
      }
      default:
        throw new UnreachableCaseError(blockchain);
    }
  }

  public async hasValidNft(targetAddress: string): Promise<boolean> {
    return this.provider.hasValidNft(targetAddress);
  }

  public async getValidNfts(targetAddress: NetworkAndAddress): Promise<NftCheckResponse> {
    return this.provider.getValidNfts(targetAddress);
  }
}
