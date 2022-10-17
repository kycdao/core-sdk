import {
  EvmLogResponse,
  EvmLog,
  EvmTransactionReceiptResponse,
  EvmTransactionReceipt,
} from './types';

export class EvmResponseDecoder {
  public log(input: EvmLogResponse): EvmLog {
    return {
      ...input,
      logIndex: parseInt(input.logIndex),
      transactionIndex: parseInt(input.transactionIndex),
      blockNumber: parseInt(input.blockNumber),
    };
  }

  public transactionReceipt(input: EvmTransactionReceiptResponse): EvmTransactionReceipt {
    return {
      ...input,
      transactionIndex: parseInt(input.transactionIndex),
      blockNumber: parseInt(input.blockNumber),
      cumulativeGasUsed: parseInt(input.cumulativeGasUsed),
      gasUsed: parseInt(input.gasUsed),
      status: parseInt(input.status),
      logs: input.logs.map((log) => this.log(log)),
    };
  }
}
