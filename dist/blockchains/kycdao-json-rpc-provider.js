import { UnreachableCaseError } from '../errors';
import { EvmJsonRpcProvider } from './evm/evm-json-rpc-provider';
import { NearJsonRpcProvider } from './near/near-json-rpc-provider';
import { SolanaJsonRpcProvider } from './solana/solana-json-rpc-provider';
export class KycDaoJsonRpcProvider {
    constructor(blockchain, contractAddress, url) {
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
    async hasValidNft(targetAddress) {
        return this.provider.hasValidNft(targetAddress);
    }
    async getValidNfts(targetAddress) {
        return this.provider.getValidNfts(targetAddress);
    }
}
//# sourceMappingURL=kycdao-json-rpc-provider.js.map