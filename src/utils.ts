import { BlockchainNetwork } from './types';

export function partition<T>(arr: T[], predicate: (_: T) => boolean): [T[], T[]] {
  const partitioned: [T[], T[]] = [[], []];
  arr.forEach((val: T) => {
    partitioned[predicate(val) ? 0 : 1].push(val);
  });
  return partitioned;
}
export function typedKeys<T extends object>(t: T) {
  return Object.keys(t) as Extract<keyof T, string>[];
}

export function isLike<T>(given: unknown): given is Partial<Record<keyof T, unknown>> {
  return typeof given === 'object' && given !== null;
}

export function isFulfilled<T>(input: PromiseSettledResult<T>): input is PromiseFulfilledResult<T> {
  return input.status === 'fulfilled';
}

export function isRejected(input: PromiseSettledResult<unknown>): input is PromiseRejectedResult {
  return input.status === 'rejected';
}

export interface PollingOptions<T> {
  useExponentialBackoff?: boolean;
  resolvePredicate?: (result: T) => boolean;
  retryOnErrorPredicate?: (error: unknown) => boolean;
}

export async function poll<T>(
  asyncFunction: () => PromiseLike<T>,
  initialTimeout: number,
  maxRetries: number,
  options?: PollingOptions<T>,
): Promise<T> {
  const { useExponentialBackoff, resolvePredicate, retryOnErrorPredicate } = options || {};

  let retries = 0;

  const executePoll = (resolve: (value: T) => void, reject: (error: unknown) => void): void => {
    let timeout = initialTimeout;
    if (useExponentialBackoff) {
      timeout = 2 ** retries * initialTimeout;
    }

    const timeoutOrRetry = () => {
      if (retries >= maxRetries) {
        reject(new Error('TIMEOUT'));
      } else {
        setTimeout(executePoll, timeout, resolve, reject);
      }
    };

    Promise.resolve(asyncFunction())
      .then((result) => {
        if (!resolvePredicate || (resolvePredicate && resolvePredicate(result))) {
          resolve(result);
        } else {
          timeoutOrRetry();
        }
      })
      .catch((error) => {
        if (retryOnErrorPredicate && retryOnErrorPredicate(error)) {
          timeoutOrRetry();
        } else {
          reject(error);
        }
      })
      .finally(() => retries++);
  };

  return new Promise(executePoll);
}

export function getChainExplorerUrlForTransaction(
  txHash: string,
  blockchainNetwork: BlockchainNetwork,
): string {
  const urlMapping: Record<BlockchainNetwork, string> = {
    CeloAlfajores: `https://explorer.celo.org/alfajores/tx/${txHash}`,
    CeloMainnet: `https://explorer.celo.org/mainnet/tx/${txHash}`,
    NearMainnet: `https://explorer.near.org/transactions/${txHash}`,
    NearTestnet: `https://explorer.testnet.near.org/transactions/${txHash}`,
    EthereumGoerli: `https://goerli.etherscan.io/tx/${txHash}`,
    EthereumMainnet: `https://etherscan.io/tx/${txHash}`,
    PolygonMainnet: `https://polygonscan.com/tx/${txHash}`,
    PolygonMumbai: `https://mumbai.polygonscan.com/tx/${txHash}`,
    SolanaDevnet: `https://explorer.solana.com/tx/${txHash}?cluster=devnet`,
    SolanaMainnet: `https://explorer.solana.com/tx/${txHash}`,
    SolanaTestnet: `https://explorer.solana.com/tx/${txHash}?cluster=testnet`,
  };

  return urlMapping[blockchainNetwork];
}
