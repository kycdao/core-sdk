import { NetworkAndAddress, NftCheckResponse } from '../../types';
import { IKycDaoJsonRpcProvider } from '../kycdao-json-rpc-provider';
export declare class NearJsonRpcProvider implements IKycDaoJsonRpcProvider {
    private contractAddress;
    private url;
    private provider;
    constructor(contractAddress: string, url: string);
    callFunction<T>(methodName: string, args: object): Promise<T>;
    hasValidNft(targetAddress: string): Promise<boolean>;
    private ntnftTokensForOwner;
    private validateTokenMetadata;
    private getValidNftsCore;
    getValidNfts(targetAddress: NetworkAndAddress): Promise<NftCheckResponse>;
}
