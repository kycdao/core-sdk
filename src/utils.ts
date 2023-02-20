import { BlockchainNetwork, MintingResult, TokenDetails } from './types';

export const AlphanumericChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function getRandomString(length: number, characters: string): string {
  let randomString = '';

  for (let i = 0; i < length; i++) {
    randomString += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return randomString;
}

export function getRandomAlphanumericString(length: number): string {
  return getRandomString(length, AlphanumericChars);
}

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

/**
 * Performs a deep comparison between two values to determine if they are equivalent.
 *
 * **Note:** This method supports comparing arrays, booleans, numbers, `Object` objects, strings and symbols.
 * `Object` objects are compared by their own, not inherited, enumerable properties.
 *
 * @param {unknown} val1 The value to compare.
 * @param {unknown} val2 The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 */
export function isEqual(val1: unknown, val2: unknown): boolean {
  // check if the values are actually equal
  if (val1 === val2) {
    return true;
  }

  // check if any of the objects are null or undefined
  if (val1 == null || val2 == null) {
    return false;
  }

  // check if both values are objects
  if (typeof val1 !== 'object' || typeof val2 !== 'object') {
    return val1 === val2;
  }

  // get the keys of the objects
  const keys1 = typedKeys(val1);
  const keys2 = typedKeys(val2);

  // check if the number of keys is the same
  if (keys1.length !== keys2.length) {
    return false;
  }

  // check if the keys are the same
  for (const key of keys1) {
    if (!keys2.includes(key)) {
      return false;
    }
  }

  // recursively check if the value pairs are the same
  for (const key of keys1) {
    if (!isEqual(val1[key], val2[key])) {
      return false;
    }
  }

  return true;
}

export interface PollingOptions<T> {
  useExponentialBackoff?: boolean;
  resolvePredicate?: (result: T) => boolean;
  retryOnErrorPredicate?: (error: unknown) => boolean;
}

export class TimeOutError extends Error {
  public wrappedError;
  constructor(message: string, originalError?: Error) {
    super(message);
    this.name = 'TimeOutError';
    this.wrappedError = originalError;
  }
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

    const timeoutOrRetry = (error?: Error) => {
      if (retries >= maxRetries) {
        reject(new TimeOutError('TIMEOUT', error));
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
          timeoutOrRetry(error);
        } else {
          reject(error);
        }
      })
      .finally(() => retries++);
  };

  return new Promise(executePoll);
}

export async function waitForDomElement<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selector: (window: any) => T,
  maxRetries = 100,
  interval = 300,
): Promise<T> {
  const check = async (): Promise<T | undefined> => {
    return selector(window);
  };

  const elem = await poll(check, interval, maxRetries, {
    useExponentialBackoff: false,
    resolvePredicate: (result) => result != null,
  });

  if (elem) {
    return elem;
  }

  throw new Error('NOT FOUND');
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

export function getMintingResult(
  blockchainNetwork: BlockchainNetwork,
  txHash: string,
  tokenId: string,
  tokenDetails: TokenDetails,
): MintingResult {
  const transactionUrl = getChainExplorerUrlForTransaction(txHash, blockchainNetwork);

  return {
    transactionUrl,
    tokenId,
    imageUrl: tokenDetails.image_url,
  };
}

export function ipfsToHttps(input: string): string {
  return input.replace('ipfs://', 'https://kycdao.infura-ipfs.io/ipfs/');
}
