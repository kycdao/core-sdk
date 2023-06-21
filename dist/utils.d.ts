import { Blockchain, MintingResult, NetworkMetadata, TokenDetails } from './types';
export declare const AlphanumericChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export declare function getRandomString(length: number, characters: string): string;
export declare function getRandomAlphanumericString(length: number): string;
export declare function partition<T>(arr: T[], predicate: (_: T) => boolean): [T[], T[]];
export declare function typedKeys<T extends object>(t: T): Extract<keyof T, string>[];
export declare function isLike<T>(given: unknown): given is Partial<Record<keyof T, unknown>>;
export declare function isFulfilled<T>(input: PromiseSettledResult<T>): input is PromiseFulfilledResult<T>;
export declare function isRejected(input: PromiseSettledResult<unknown>): input is PromiseRejectedResult;
export declare function isSameAddress(blockchain: Blockchain, address1: string, address2: string): boolean;
export declare function isEqual(val1: unknown, val2: unknown): boolean;
export interface PollingOptions<T> {
    useExponentialBackoff?: boolean;
    resolvePredicate?: (result: T) => boolean;
    retryOnErrorPredicate?: (error: unknown) => boolean;
}
export declare class TimeOutError extends Error {
    wrappedError: Error | undefined;
    constructor(message: string, originalError?: Error);
}
export declare function poll<T>(asyncFunction: () => PromiseLike<T>, initialTimeout: number, maxRetries: number, options?: PollingOptions<T>): Promise<T>;
export declare function waitForDomElement<T>(selector: (window: any) => T, maxRetries?: number, interval?: number): Promise<T>;
export declare function getChainExplorerUrlForTransaction(txHash: string, networkDetails: NetworkMetadata): string;
export declare function getMintingResult(networkDetails: NetworkMetadata, txHash: string, tokenId: string, tokenDetails: TokenDetails): MintingResult;
export declare function ipfsToHttps(input: string): string;
