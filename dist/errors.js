import { WalletError as SolanaWalletError } from '@solana/wallet-adapter-base';
import { KycDaoApiError } from './api-base';
import { getRandomAlphanumericString, isLike } from './utils';
import { BrowserClient, Hub, defaultIntegrations, defaultStackParser, makeFetchTransport, } from '@sentry/browser';
function ensureType() {
    return (a) => a;
}
export function sentryCaptureSDKError(error, tags) {
    if (window.kycDaoSentry) {
        window.kycDaoSentry.captureSDKError(error, tags);
    }
}
export const StatusErrors = ensureType()({
    UserNotLoggedIn: 'User is not logged in. Please make sure that third party cookies are enabled in your browser and try again.',
    InvalidEmailAddress: 'Invalid email address',
    InvalidTaxResidency: 'Invalid taxResidency. Please use the country list provided by the SDK.',
    TermsAndConditionsNotAccepted: 'Terms and Conditions and Privacy Policy must be accepted to start verification',
    DisclaimerNotAccepted: 'Disclaimer must be accepted',
    WalletNotConnected: 'Wallet connection required',
    UserNotVerified: 'User must be verified to be able to mint an NFT',
    UserAlreadyVerified: 'User already verified',
    NetworkNotSupported: 'Selected network is not supported',
    NetworkNotEnabled: 'Selected network is not enabled',
    NetworkSwitchingFailed: 'Network switching failed',
    NetworkPriceTooHigh: 'Network price too high, try again later',
});
export const WalletErrors = ensureType()({
    UserNotConnected: 'User is not connected to a wallet',
    AccountUnauthorized: 'Account is not authorized',
    RejectedByUser: 'User cancelled the transaction',
    InsufficientFunds: 'Insufficient funds',
    InternalWalletError: 'Internal wallet error',
    ChainMissing: 'Chain missing error',
});
export const TransactionErrors = ensureType()({
    TransactionNotFound: 'Transaction not found',
    TransactionFailed: 'Transaction failed',
    TransactionRejected: 'Transaction rejected by the contract',
    MintingCostCalculationError: 'Minting cost calculation error',
    GasEstimationError: 'Gas estimation error',
});
export class KycDaoSDKError extends Error {
    constructor(errorCode, message, referenceId) {
        super(message);
        this.name = 'KycDaoSDKError';
        this._errorCode = errorCode;
        this.referenceId = referenceId || getRandomAlphanumericString(10);
    }
    toString() {
        return `${this.name}${this.errorCode ? '[' + this.errorCode + ']' : ''}: ${this.message} (ref: ${this.referenceId})`;
    }
    get errorCode() {
        return this._errorCode;
    }
}
export class ConfigurationError extends KycDaoSDKError {
    constructor(message) {
        super(undefined, message);
        this.name = 'ConfigurationError';
    }
    get errorCode() {
        return undefined;
    }
}
export class StatusError extends KycDaoSDKError {
    constructor(errorCode, message) {
        if (!message) {
            message = StatusErrors[errorCode];
        }
        super(errorCode, message);
        this.name = `StatusError`;
    }
    get errorCode() {
        return super.errorCode;
    }
}
export class WalletError extends KycDaoSDKError {
    constructor(errorCode, message, errorCodeFromWallet) {
        super(errorCode, message);
        this.name = `WalletError`;
        this.errorCodeFromWallet = errorCodeFromWallet;
    }
    get errorCode() {
        return super.errorCode;
    }
    toString() {
        return `${this.name}[${this.errorCode}]: ${this.message} (ref: ${this.referenceId}, errorCodeFromWallet: ${this.errorCodeFromWallet})`;
    }
}
export class TransactionError extends KycDaoSDKError {
    constructor(errorCode, message) {
        if (!message) {
            message = TransactionErrors[errorCode];
        }
        super(errorCode, message);
        this.name = 'TransactionError';
    }
    get errorCode() {
        return super.errorCode;
    }
}
export class InternalError extends KycDaoSDKError {
    constructor(message, referenceId) {
        super(undefined, message, referenceId);
        this.name = 'InternalError';
    }
    get errorCode() {
        return undefined;
    }
}
export class UnreachableCaseError extends InternalError {
    constructor(val) {
        super(`Unreachable case: ${JSON.stringify(val)}`);
    }
}
export class UnknownError extends KycDaoSDKError {
    constructor(message) {
        super(undefined, message);
        this.name = 'UnknownError';
    }
    get errorCode() {
        return undefined;
    }
}
function publicErrorHandler(error) {
    let err;
    if (error instanceof KycDaoSDKError) {
        err = error;
    }
    else if (error instanceof KycDaoApiError) {
        if (error.statusCode === 401) {
            err = new StatusError('UserNotLoggedIn');
        }
        else {
            const message = `${error.errorCode} - ${error.message}`;
            err = new InternalError(message, error.referenceId);
        }
    }
    for (const fn of [transformSolanaErrors, transformEVMErrors]) {
        if (!err) {
            err = fn(error);
        }
    }
    if (!err) {
        if (typeof error === 'string') {
            err = new UnknownError(error);
        }
        else if (error instanceof Error) {
            err = new UnknownError(error.message);
        }
        else {
            err = new UnknownError(JSON.stringify(error));
        }
    }
    let errorCodeFromWallet;
    if (err instanceof WalletError) {
        errorCodeFromWallet = err.errorCodeFromWallet;
    }
    if (err !== error) {
        if (isLike(error) && error.stack) {
            err.stack = '' + error.stack;
        }
    }
    sentryCaptureSDKError(err, { errorCodeFromWallet });
    console.error(err);
    throw err;
}
function transformWalletErrorCode(code, msg) {
    switch (code) {
        case 4001:
            return new WalletError('RejectedByUser', msg, code);
        case 4100:
            return new WalletError('AccountUnauthorized', msg, code);
        case 4900:
        case 4901:
            return new WalletError('UserNotConnected', msg, code);
        case 4902:
            return new WalletError('ChainMissing', msg, code);
        case -32000:
            if (msg.indexOf('insufficient funds') !== -1) {
                return new WalletError('InsufficientFunds', msg, code);
            }
            else {
                return new WalletError('InternalWalletError', msg, code);
            }
        case 4200:
        case -32700:
        case -32600:
        case -32601:
        case -32602:
        case -32603:
        case -32001:
        case -32002:
        case -32004:
        case -32005:
        case -32003:
            return new WalletError('InternalWalletError', msg, code);
    }
    return;
}
export function unwrapEVMError(error) {
    const err = error;
    if (!err.code || !err.message) {
        return;
    }
    let { code, message } = err;
    const data = err.data;
    if (code === -32603 && (data === null || data === void 0 ? void 0 : data.code) && (data.message || data.details)) {
        code = data.code;
        message = data.message || data.details || '';
    }
    return {
        code,
        message,
    };
}
function transformEVMErrors(error) {
    const err = unwrapEVMError(error);
    if (!err) {
        return;
    }
    const { code, message } = err;
    if (code === 3) {
        return new TransactionError('TransactionRejected', message);
    }
    return transformWalletErrorCode(code, message);
}
function transformSolanaErrors(error) {
    if (error instanceof SolanaWalletError) {
        const err = error.error;
        if (!err || !err.code || !err.message) {
            return;
        }
        return transformWalletErrorCode(err.code, err.message);
    }
    return;
}
export function Catch(handler) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            try {
                return await originalMethod.apply(this, args);
            }
            catch (error) {
                if (handler) {
                    handler.call(null, error);
                }
                else {
                    publicErrorHandler.call(null, error);
                }
            }
        };
        return descriptor;
    };
}
export class SentryWrapper {
    get dsn() {
        return this._dsn;
    }
    get environment() {
        return this._environment;
    }
    getEnvironment() {
        const getHostname = () => {
            var _a;
            const inIframe = window !== window.self;
            if (inIframe) {
                try {
                    return (_a = window.top) === null || _a === void 0 ? void 0 : _a.location.hostname;
                }
                catch (_b) {
                    return;
                }
            }
            else {
                return window.location.hostname;
            }
        };
        const hostname = getHostname();
        if (hostname != null) {
            if (hostname === 'localhost' || hostname === '127.0.0.1') {
                return 'local';
            }
            if (hostname.includes('pre.kycdao.xyz') ||
                hostname.includes('dev.kycdao.xyz') ||
                hostname.includes('staging.kycdao.xyz')) {
                return 'development';
            }
            return 'production';
        }
        return 'unknown';
    }
    constructor() {
        this._dsn = 'https://23dafecec027439b9413cd50eb22567d@o1184096.ingest.sentry.io/4504559638413313';
        this._environment = this.getEnvironment();
        const client = new BrowserClient({
            dsn: this._dsn,
            environment: this._environment,
            transport: makeFetchTransport,
            stackParser: defaultStackParser,
            integrations: defaultIntegrations,
        });
        this._hub = new Hub(client);
        window.kycDaoSentry = this;
    }
    captureSDKError(error, tags) {
        this._hub.withScope((_) => {
            this._hub.setTags(Object.assign(Object.assign({}, tags), { errorCode: error.errorCode, referenceId: error.referenceId }));
            this._hub.captureException(error);
        });
    }
}
//# sourceMappingURL=errors.js.map