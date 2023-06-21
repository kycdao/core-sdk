export const AlphanumericChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export function getRandomString(length, characters) {
    let randomString = '';
    for (let i = 0; i < length; i++) {
        randomString += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return randomString;
}
export function getRandomAlphanumericString(length) {
    return getRandomString(length, AlphanumericChars);
}
export function partition(arr, predicate) {
    const partitioned = [[], []];
    arr.forEach((val) => {
        partitioned[predicate(val) ? 0 : 1].push(val);
    });
    return partitioned;
}
export function typedKeys(t) {
    return Object.keys(t);
}
export function isLike(given) {
    return typeof given === 'object' && given !== null;
}
export function isFulfilled(input) {
    return input.status === 'fulfilled';
}
export function isRejected(input) {
    return input.status === 'rejected';
}
export function isSameAddress(blockchain, address1, address2) {
    if (blockchain === 'Ethereum') {
        return address1.toLowerCase() === address2.toLowerCase();
    }
    return address1 === address2;
}
export function isEqual(val1, val2) {
    if (val1 === val2) {
        return true;
    }
    if (val1 == null || val2 == null) {
        return false;
    }
    if (typeof val1 !== 'object' || typeof val2 !== 'object') {
        return val1 === val2;
    }
    const keys1 = typedKeys(val1);
    const keys2 = typedKeys(val2);
    if (keys1.length !== keys2.length) {
        return false;
    }
    for (const key of keys1) {
        if (!keys2.includes(key)) {
            return false;
        }
    }
    for (const key of keys1) {
        if (!isEqual(val1[key], val2[key])) {
            return false;
        }
    }
    return true;
}
export class TimeOutError extends Error {
    constructor(message, originalError) {
        super(message);
        this.name = 'TimeOutError';
        this.wrappedError = originalError;
    }
}
export async function poll(asyncFunction, initialTimeout, maxRetries, options) {
    const { useExponentialBackoff, resolvePredicate, retryOnErrorPredicate } = options || {};
    let retries = 0;
    const executePoll = (resolve, reject) => {
        let timeout = initialTimeout;
        if (useExponentialBackoff) {
            timeout = 2 ** retries * initialTimeout;
        }
        const timeoutOrRetry = (error) => {
            if (retries >= maxRetries) {
                reject(new TimeOutError('TIMEOUT', error));
            }
            else {
                setTimeout(executePoll, timeout, resolve, reject);
            }
        };
        Promise.resolve(asyncFunction())
            .then((result) => {
            if (!resolvePredicate || (resolvePredicate && resolvePredicate(result))) {
                resolve(result);
            }
            else {
                timeoutOrRetry();
            }
        })
            .catch((error) => {
            if (retryOnErrorPredicate && retryOnErrorPredicate(error)) {
                timeoutOrRetry(error);
            }
            else {
                reject(error);
            }
        })
            .finally(() => retries++);
    };
    return new Promise(executePoll);
}
export async function waitForDomElement(selector, maxRetries = 100, interval = 300) {
    const check = async () => {
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
export function getChainExplorerUrlForTransaction(txHash, networkDetails) {
    const queryMapping = {
        CeloAlfajores: '',
        CeloMainnet: '',
        NearMainnet: '',
        NearTestnet: '',
        EthereumGoerli: '',
        EthereumMainnet: '',
        PolygonMainnet: '',
        PolygonMumbai: '',
        SolanaDevnet: '?cluster=devnet',
        SolanaMainnet: '',
        SolanaTestnet: '?cluster=testnet',
        BaseGoerli: '',
        ArbitrumMainnet: '',
        ArbitrumGoerli: '',
        ZKSyncMainnet: '',
        ZKSyncGoerli: '',
    };
    const { url, transaction_path } = networkDetails.explorer;
    const result = url + transaction_path + txHash + queryMapping[networkDetails.id];
    return result;
}
export function getMintingResult(networkDetails, txHash, tokenId, tokenDetails) {
    const transactionUrl = getChainExplorerUrlForTransaction(txHash, networkDetails);
    return {
        transactionUrl,
        tokenId,
        imageUrl: tokenDetails.image_url,
    };
}
export function ipfsToHttps(input) {
    return input.replace('ipfs://', 'https://kycdao.infura-ipfs.io/ipfs/');
}
//# sourceMappingURL=utils.js.map