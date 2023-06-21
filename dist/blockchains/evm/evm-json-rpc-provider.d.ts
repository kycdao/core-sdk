import { IKycDaoJsonRpcProvider } from '../kycdao-json-rpc-provider';
import { NetworkAndAddress, NftCheckResponse } from '../../types';
export declare class EvmJsonRpcProvider implements IKycDaoJsonRpcProvider {
    private contractAddress;
    private url;
    constructor(contractAddress: string, url: string);
    private fetchJsonRpc;
    private ethCall;
    hasValidNft(targetAddress: string): Promise<boolean>;
    private tokenOfOwnerByIndex;
    private tokenUri;
    private getValidNftsCore;
    getValidNfts(targetAddress: NetworkAndAddress): Promise<NftCheckResponse>;
    getGasPrice(): Promise<number>;
    getMaxPriorityFeePerGas(): Promise<number>;
    getBaseFeePerGas(): Promise<number>;
}
