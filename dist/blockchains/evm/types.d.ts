export declare const EthereumUnits: {
    readonly wei: 0;
    readonly kwei: 3;
    readonly mwei: 6;
    readonly gwei: 9;
    readonly szabo: 12;
    readonly finney: 15;
    readonly ether: 18;
};
export type EthereumUnit = keyof typeof EthereumUnits;
export type HexEncodeOptions = {
    addPrefix?: boolean;
    padToBytes?: number;
};
export interface ProviderRpcError extends Error {
    message: string;
    code: number;
    data?: unknown;
}
export interface EvmRequestArguments {
    readonly method: string;
    readonly params?: readonly unknown[] | object;
}
interface WalletConnectProvider {
    request<T>(_: EvmRequestArguments): Promise<T>;
    on<T>(event: string, callback: (data: T) => void): void;
    isWalletConnect: true;
    enable(): Promise<string[]>;
    disconnect(): Promise<void>;
}
export interface BaseEvmProvider {
    request<T>(_: EvmRequestArguments): Promise<T>;
    on<T>(event: string, callback: (data: T) => void): void;
    isWalletConnect?: false | undefined;
}
export type EvmProvider = WalletConnectProvider | BaseEvmProvider;
export interface EvmTransaction {
    to: string;
    from?: string;
    gas?: number;
    gasPrice?: number;
    value?: number;
    data?: string;
}
export interface EvmLogResponse {
    removed: boolean;
    logIndex: string;
    transactionIndex: string;
    transactionHash: string;
    blockHash: string;
    blockNumber: string;
    address: string;
    data: string;
    topics: string[];
}
export interface EvmLog {
    removed: boolean;
    logIndex: number;
    transactionIndex: number;
    transactionHash: string;
    blockHash: string;
    blockNumber: number;
    address: string;
    data: string;
    topics: string[];
}
export interface EvmTransactionReceiptResponse {
    transactionHash: string;
    transactionIndex: string;
    blockHash: string;
    blockNumber: string;
    from: string;
    to: string;
    cumulativeGasUsed: string;
    gasUsed: string;
    contractAddress: string;
    logs: EvmLogResponse[];
    logsBloom: string;
    root: string;
    status: string;
}
export interface EvmTransactionReceipt {
    transactionHash: string;
    transactionIndex: number;
    blockHash: string;
    blockNumber: number;
    from: string;
    to: string;
    cumulativeGasUsed: number;
    gasUsed: number;
    contractAddress: string;
    logs: EvmLog[];
    logsBloom: string;
    root: string;
    status: number;
}
export {};
