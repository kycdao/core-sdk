import { IKycDaoJsonRpcProvider } from '../kycdao-json-rpc-provider';
import { NetworkAndAddress, NftCheckResponse } from '../../types';
export declare class SolanaJsonRpcProvider implements IKycDaoJsonRpcProvider {
    private contractAddress;
    private connection;
    private program;
    constructor(contractAddress: string, url: string);
    private getValidNftsCore;
    private getTokenMetadata;
    hasValidNft(targetAddress: string): Promise<boolean>;
    getValidNfts(targetAddress: NetworkAndAddress): Promise<NftCheckResponse>;
}
