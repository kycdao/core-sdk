export function partition<T>(arr: T[], predicate: (_: T) => boolean): [T[], T[]] {
  const partitioned: [T[], T[]] = [[], []];
  arr.forEach((val: T) => {
    partitioned[predicate(val) ? 0 : 1].push(val);
  });
  return partitioned;
}

export function isLike<T>(given: unknown): given is Partial<Record<keyof T, unknown>> {
  return typeof given === 'object' && given !== null;
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
