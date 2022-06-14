export function partition<T>(arr: T[], predicate: (_: T) => boolean): [T[], T[]] {
  const partitioned: [T[], T[]] = [[], []];
  arr.forEach((val: T) => {
    partitioned[predicate(val) ? 0 : 1].push(val);
  });
  return partitioned;
}

export async function poll<T>(
  asyncFunction: () => PromiseLike<T>,
  predicate: (result: T) => boolean,
  interval: number,
  maxAttempts: number,
): Promise<T> {
  let attempts = 0;

  const executePoll = (resolve: (value: T) => void, reject: (error: Error) => void): void => {
    attempts++;
    Promise.resolve(asyncFunction())
      .then((result) => {
        if (predicate(result)) {
          return resolve(result);
        } else if (attempts === maxAttempts) {
          return reject(new Error('TIMEOUT'));
        } else {
          setTimeout(executePoll, interval, resolve, reject);
        }
      })
      .catch((error) => reject(error));
  };

  return new Promise(executePoll);
}
