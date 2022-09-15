const EthereumUnits = {
  wei: 0,
  kwei: 3,
  mwei: 6,
  gwei: 9,
  szabo: 12,
  finney: 15,
  ether: 18,
} as const;
type EthereumUnit = keyof typeof EthereumUnits;

export function parseUnits(value: number, unit: EthereumUnit): number {
  return value * 10 ** EthereumUnits[unit];
}

export type HexEncodeOptions = {
  addPrefix?: boolean;
  padToBytes?: number;
};

function applyHexEncodeOptions(hex: string, options?: HexEncodeOptions): string {
  const padToChars = options?.padToBytes ? Math.max(options.padToBytes, 0) * 2 : 0;
  return (options?.addPrefix ? '0x' : '') + hex.padStart(padToChars, '0');
}

export function hexEncodeString(input: string, options?: HexEncodeOptions): string {
  return applyHexEncodeOptions(Buffer.from(input, 'ascii').toString('hex'), options);
}

export function hexEncodeUint(uint: number, options?: HexEncodeOptions): string {
  return applyHexEncodeOptions(uint.toString(16), options);
}

export function hexDecodeToString(input: string, hasPrefix = true): string {
  if (hasPrefix) {
    input = input.substring(2);
  }

  let str = '';
  for (let i = 0; i < input.length; i += 2) {
    str += String.fromCharCode(parseInt(input.substring(i, 2), 16));
  }
  return str;
}

export interface EvmLogResponse {
  removed: boolean; // TAG - true when the log was removed, due to a chain reorganization. false if its a valid log.
  logIndex: string; // QUANTITY - integer of the log index position in the block. null when its pending log.
  transactionIndex: string; // QUANTITY - integer of the transactions index position log was created from. null when its pending log.
  transactionHash: string; // DATA, 32 Bytes - hash of the transactions this log was created from. null when its pending log.
  blockHash: string; // DATA, 32 Bytes - hash of the block where this log was in. null when its pending. null when its pending log.
  blockNumber: string; // QUANTITY - the block number where this log was in. null when its pending. null when its pending log.
  address: string; // DATA, 20 Bytes - address from which this log originated.
  data: string; // DATA - contains one or more 32 Bytes non-indexed arguments of the log.
  topics: string[]; // Array of DATA - Array of 0 to 4 32 Bytes DATA of indexed log arguments. (In solidity: The first topic is the hash of the signature of the event (e.g. Deposit(address,bytes32,uint256)), except you declared the event with the anonymous specifier.)
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
  transactionHash: string; // DATA 32 Bytes - hash of the transaction.
  transactionIndex: string; // QUANTITY - integer of the transactions index position in the block.
  blockHash: string; // DATA, 32 Bytes - hash of the block where this transaction was in.
  blockNumber: string; //QUANTITY - block number where this transaction was in.
  from: string; // DATA, 20 Bytes - address of the sender.
  to: string; // DATA, 20 Bytes - address of the receiver. null when its a contract creation transaction.
  cumulativeGasUsed: string; // QUANTITY - The total amount of gas used when this transaction was executed in the block.
  gasUsed: string; // QUANTITY - The amount of gas used by this specific transaction alone.
  contractAddress: string; // DATA, 20 Bytes - The contract address created, if the transaction was a contract creation, otherwise null.
  logs: EvmLogResponse[]; // Array - Array of log objects, which this transaction generated.
  logsBloom: string; // DATA, 256 Bytes - Bloom filter for light clients to quickly retrieve related logs. It also returns either :
  root: string; // DATA 32 bytes of post-transaction stateroot (pre Byzantium)
  status: string; // QUANTITY either 1 (success) or 0 (failure)
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
