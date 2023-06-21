import { Blockchain, NetworkAndAddress, NftCheckResponse } from '../types';
export interface IKycDaoJsonRpcProvider {
    hasValidNft(targetAddress: string): Promise<boolean>;
    getValidNfts(targetAddress: NetworkAndAddress): Promise<NftCheckResponse>;
}
export declare class KycDaoJsonRpcProvider implements IKycDaoJsonRpcProvider {
    private provider;
    constructor(blockchain: Blockchain, contractAddress: string, url: string);
    hasValidNft(targetAddress: string): Promise<boolean>;
    getValidNfts(targetAddress: NetworkAndAddress): Promise<NftCheckResponse>;
}
