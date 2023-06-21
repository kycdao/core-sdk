declare global {
    interface Window {
        kycDaoSentry?: SentryWrapper;
    }
}
export interface SentryTags {
    errorCode?: ErrorCode;
    referenceId?: string;
    errorCodeFromWallet?: number;
}
export declare function sentryCaptureSDKError(error: KycDaoSDKError, tags?: SentryTags): void;
export declare const StatusErrors: {
    UserNotLoggedIn: string;
    InvalidEmailAddress: string;
    InvalidTaxResidency: string;
    TermsAndConditionsNotAccepted: string;
    DisclaimerNotAccepted: string;
    WalletNotConnected: string;
    UserNotVerified: string;
    UserAlreadyVerified: string;
    NetworkNotSupported: string;
    NetworkNotEnabled: string;
    NetworkSwitchingFailed: string;
    NetworkPriceTooHigh: string;
};
export declare const WalletErrors: {
    UserNotConnected: string;
    AccountUnauthorized: string;
    RejectedByUser: string;
    InsufficientFunds: string;
    InternalWalletError: string;
    ChainMissing: string;
};
export declare const TransactionErrors: {
    TransactionNotFound: string;
    TransactionFailed: string;
    TransactionRejected: string;
    MintingCostCalculationError: string;
    GasEstimationError: string;
};
export type WalletErrorCode = keyof typeof WalletErrors;
export type StatusErrorCode = keyof typeof StatusErrors;
export type TransactionErrorCode = keyof typeof TransactionErrors;
export type ErrorCode = TransactionErrorCode | StatusErrorCode | WalletErrorCode;
export declare abstract class KycDaoSDKError extends Error {
    referenceId: string;
    protected _errorCode: ErrorCode | undefined;
    constructor(errorCode: ErrorCode | undefined, message: string, referenceId?: string);
    toString(): string;
    get errorCode(): ErrorCode | undefined;
}
export declare class ConfigurationError extends KycDaoSDKError {
    constructor(message: string);
    get errorCode(): undefined;
}
export declare class StatusError extends KycDaoSDKError {
    constructor(errorCode: StatusErrorCode, message?: string);
    get errorCode(): StatusErrorCode;
}
export declare class WalletError extends KycDaoSDKError {
    errorCodeFromWallet: number;
    constructor(errorCode: WalletErrorCode, message: string, errorCodeFromWallet: number);
    get errorCode(): WalletErrorCode;
    toString(): string;
}
export declare class TransactionError extends KycDaoSDKError {
    constructor(errorCode: TransactionErrorCode, message?: string);
    get errorCode(): TransactionErrorCode;
}
export declare class InternalError extends KycDaoSDKError {
    constructor(message: string, referenceId?: string);
    get errorCode(): undefined;
}
export declare class UnreachableCaseError extends InternalError {
    constructor(val: never);
}
export declare class UnknownError extends KycDaoSDKError {
    constructor(message: string);
    get errorCode(): undefined;
}
export interface EVMError {
    code: number;
    message: string;
}
export declare function unwrapEVMError(error: unknown): EVMError | undefined;
export declare function Catch(handler?: (_: unknown) => void): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
export type Environment = 'local' | 'development' | 'production' | 'unknown';
export declare class SentryWrapper {
    private _dsn;
    get dsn(): string;
    private _environment;
    get environment(): Environment;
    private _hub;
    private getEnvironment;
    constructor();
    captureSDKError(error: KycDaoSDKError, tags?: SentryTags): void;
}
