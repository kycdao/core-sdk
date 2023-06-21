import { EvmLogResponse, EvmLog, EvmTransactionReceiptResponse, EvmTransactionReceipt } from './types';
export declare class EvmResponseDecoder {
    log(input: EvmLogResponse): EvmLog;
    transactionReceipt(input: EvmTransactionReceiptResponse): EvmTransactionReceipt;
}
