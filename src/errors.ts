/* eslint-disable @typescript-eslint/no-explicit-any */

import { WalletError as SolanaWalletError } from '@solana/wallet-adapter-base';
import { KycDaoApiError } from './api-base';
import { SentryConfiguration } from './types';
import { getRandomAlphanumericString, isLike, waitForDomElement } from './utils';

function ensureType<T>() {
  return <Actual extends T>(a: Actual) => a;
}

/**
 * Error codes for the {@link StatusError} class
 * @enum {string}
 */
export const StatusErrors = ensureType<Record<string, string>>()({
  /** The called API function requires an active logged in user */
  UserNotLoggedIn: 'User is not logged in',
  /** The provided email address is invalid */
  InvalidEmailAddress: 'Invalid email address',
  /** The provided tax residency is invalid */
  InvalidTaxResidency: 'Invalid taxResidency. Please use the country list provided by the SDK.',
  /** The called API function requires the terms and conditions to be accepted by the user */
  TermsAndConditionsNotAccepted:
    'Terms and Conditions and Privacy Policy must be accepted to start verification',
  /** The called API function requires the disclaimer to be accepted by the user */
  DisclaimerNotAccepted: 'Disclaimer must be accepted',
  /** The called API function requires a wallet to be connected */
  WalletNotConnected: 'Wallet connection required',
  /** The called API function requires the user to be verified */
  UserNotVerified: 'User must be verified to be able to mint an NFT',
  /** The user has an active verification while requesting a new verification */
  UserAlreadyVerified: 'User already verified',
  /** The selected network is not supported by the SDK */
  NetworkNotSupported: 'Selected network is not supported',
  /** The selected network is supported by the SDK but wasn't enabled in the SDK */
  NetworkNotEnabled: 'Selected network is not enabled',
  /** Network switching failed */
  NetworkSwitchingFailed: 'Network switching failed',
});

/**
 * Error codes for the {@link WalletError} class
 * @enum {string}
 */
export const WalletErrors = ensureType<Record<string, string>>()({
  /** The user is not connected to chain. It can happen because of network connection problems. */
  UserNotConnected: 'User is not connected to a wallet',
  /** The SDK is trying to do a wallet action, but the account provided by the wallet was not authorized before. */
  AccountUnauthorized: 'Account is not authorized',
  /** The wallet action initiated by the SDK was cancelled by the user. */
  RejectedByUser: 'User cancelled the transaction',
  /** The account does not have enough funds to complete the transaction. */
  InsufficientFunds: 'Insufficient funds',
  /** An internal wallet error occured. */
  InternalWalletError: 'Internal wallet error',
  /** The chain does not exist in the user's wallet */
  ChainMissing: 'Chain missing error',
});

/**
 * Error codes for the {@link TransactionError} class
 * @enum {string}
 */
export const TransactionErrors = ensureType<Record<string, string>>()({
  /** The transaction was not found on the chain in time. */
  TransactionNotFound: 'Transaction not found',
  /** The transaction was found on the chain but it's in a failed state. */
  TransactionFailed: 'Transaction failed',
  /** The transaction was rejected by the contract. */
  TransactionRejected: 'Transaction rejected by the contract',
  /** An error occurred during evaluating the minting cost. Can be caused by unstable RPC endpoint. */
  MintingCostCalculationError: 'Minting cost calculation error',
  /** An error occurred during evaluating the required gas. Can be caused by unstable RPC endpoint. */
  GasEstimationError: 'Gas estimation error',
});

export type WalletErrorCode = keyof typeof WalletErrors;
export type StatusErrorCode = keyof typeof StatusErrors;
export type TransactionErrorCode = keyof typeof TransactionErrors;

export type ErrorCode = TransactionErrorCode | StatusErrorCode | WalletErrorCode;

/**
 * The abstract class of all the error classes returned by SDK methods.
 *
 * Subclasses represent various error types:
 * - Integration errors:
 *   - {@link ConfigurationError}
 * - Runtime errors (to be handled by the client):
 *   - {@link StatusError}
 *   - {@link WalletError}
 *   - {@link TransactionError}
 * - Unexpected errors (not to be handled by the client):
 *   - {@link InternalError}
 *   - {@link UnknownError}
 *
 * @class KycDaoSDKError
 * @typedef {KycDaoSDKError}
 * @extends {Error}
 */
export abstract class KycDaoSDKError extends Error {
  /**
   * This is a unique reference to the error that can help us identify and solve the issue.
   *
   * @type {string}
   */
  public referenceId: string;

  protected _errorCode: ErrorCode | undefined;

  constructor(errorCode: ErrorCode | undefined, message: string, referenceId?: string) {
    super(message);
    this.name = 'KycDaoSDKError';
    this._errorCode = errorCode;
    this.referenceId = referenceId || getRandomAlphanumericString(10);
  }

  override toString(): string {
    return `${this.name}${this.errorCode ? '[' + this.errorCode + ']' : ''}: ${
      this.message
    } (ref: ${this.referenceId})`;
  }

  /** Some subclasses contain an error code. The accessor here is provided for convenience */
  get errorCode(): ErrorCode | undefined {
    return this._errorCode;
  }
}

/**
 * This error class represents the errors that can occur when the SDK evaluates its configuration.
 *
 * These errors intend to guide you to fix configuration problems while integrating the SDK. They should not occur in normal circumstances.
 * The {@link errorCode} property is always undefined for these errors, the message property contains the error description.
 *
 * @class ConfigurationError
 * @typedef {ConfigurationError}
 */
export class ConfigurationError extends KycDaoSDKError {
  constructor(message: string) {
    super(undefined, message);
    this.name = 'ConfigurationError';
  }

  /** Error code is always undefined for this subclass */
  override get errorCode(): undefined {
    return undefined;
  }
}

/**
 * This error class represents the various errors that can occur when interacting with the SDK while some preconditions are not met.
 *
 * The {@link errorCode} property can be used to identify the specific error. See {@link StatusErrors} for the list of possible errors.
 *
 * @class StatusError
 * @typedef {StatusError}
 */
export class StatusError extends KycDaoSDKError {
  constructor(errorCode: StatusErrorCode, message?: string) {
    if (!message) {
      message = StatusErrors[errorCode];
    }
    super(errorCode, message);
    this.name = `StatusError`;
  }

  /** Error code represents various subtypes of the error, see {@link StatusErrors} for details. */
  override get errorCode(): StatusErrorCode {
    return super.errorCode as StatusErrorCode;
  }
}

/**
 * This error class represents the various errors that can occur when the SDK is interacting with a wallet.
 *
 * The {@link errorCode} property can be used to identify the specific error. See {@link WalletErrors} for the list of possible problems.
 * @class WalletError
 * @typedef {WalletError}
 */
export class WalletError extends KycDaoSDKError {
  public errorCodeFromWallet: number;
  constructor(errorCode: WalletErrorCode, message: string, errorCodeFromWallet: number) {
    super(errorCode, message);
    this.name = `WalletError`;
    this.errorCodeFromWallet = errorCodeFromWallet;
  }

  /** Error code represents various subtypes of the error, see {@link WalletErrors} for details. */
  override get errorCode(): WalletErrorCode {
    return super.errorCode as WalletErrorCode;
  }

  override toString(): string {
    return `${this.name}[${this.errorCode}]: ${this.message} (ref: ${this.referenceId}, errorCodeFromWallet: ${this.errorCodeFromWallet})`;
  }
}

/**
 * This error class represents the various errors that can occur during the minting transaction.
 *
 * The {@link errorCode} property can be used to identify the specific error. See {@link TransactionErrors} for the list of possible problems.
 * @class TransactionError
 * @typedef {TransactionError}
 */
export class TransactionError extends KycDaoSDKError {
  constructor(errorCode: TransactionErrorCode, message?: string) {
    if (!message) {
      message = TransactionErrors[errorCode];
    }
    super(errorCode, message);
    this.name = 'TransactionError';
  }

  /** Error code represents various subtypes of the error, see {@link TransactionErrors} for details. */
  override get errorCode(): TransactionErrorCode {
    return super.errorCode as TransactionErrorCode;
  }
}

/**
 * This error class represents errors that can occur independently from the SDK state. They can be caused by network issues, unstable RPC endpoints, errors in the SDK, etc.
 *
 * The {@link errorCode} property is always undefined for these error, the message property contains the error description.*
 *
 * @class InternalError
 * @typedef {InternalError}
 */
export class InternalError extends KycDaoSDKError {
  constructor(message: string, referenceId?: string) {
    super(undefined, message, referenceId);
    this.name = 'InternalError';
  }

  /** Error code is always undefined for this subclass */
  override get errorCode(): undefined {
    return undefined;
  }
}

/**
 * @internal
 */
export class UnreachableCaseError extends InternalError {
  constructor(val: never) {
    super(`Unreachable case: ${JSON.stringify(val)}`);
  }
}

/**
 * This error class represents errors that can occur because of some unexpected behavior of the SDK.
 *
 * The {@link errorCode} property is always undefined for these error, the message property contains the error description.
 * @class UnknownError
 * @typedef {UnknownError}
 */
export class UnknownError extends KycDaoSDKError {
  constructor(message: string) {
    super(undefined, message);
    this.name = 'UnknownError';
  }

  /** Error code is always undefined for this subclass */
  override get errorCode(): undefined {
    return undefined;
  }
}

/**
 * Error handler for public methods of the SDK.
 * It catches all unhandled errors, wraps them in a KycDaoSDKError and throws that instead.
 *
 * @internal
 * @param {unknown} error
 */
function publicErrorHandler(error: unknown): void {
  let err: KycDaoSDKError | undefined;
  if (error instanceof KycDaoSDKError) {
    err = error;
  } else if (error instanceof KycDaoApiError) {
    const message = `${error.errorCode} - ${error.message}`;
    err = new InternalError(message, error.referenceId);
  }
  // apply error transformations
  for (const fn of [transformSolanaErrors, transformEVMErrors]) {
    if (!err) {
      err = fn(error);
    }
  }

  if (!err) {
    if (typeof error === 'string') {
      err = new UnknownError(error);
    } else if (error instanceof Error) {
      err = new UnknownError(error.message);
    } else {
      err = new UnknownError(JSON.stringify(error));
    }
  }

  let errorCodeFromWallet;
  if (err instanceof WalletError) {
    errorCodeFromWallet = err.errorCodeFromWallet;
  }

  if (err !== error) {
    if (isLike<{ stack: string }>(error) && error.stack) {
      err.stack = '' + error.stack;
    }
  }

  // report to sentry
  const sentry = (window as any).Sentry as any;
  if (sentry != null) {
    sentry.captureException(err, {
      tags: {
        errorCode: err.errorCode,
        referenceId: err.referenceId,
        errorCodeFromWallet,
      },
    });
  }

  // TODO only log UnexpectedErrors?
  console.error(err);
  throw err;
}

function transformWalletErrorCode(code: number, msg: string) {
  switch (code) {
    case 4001: // user rejected
      return new WalletError('RejectedByUser', msg, code);
    case 4100: // unauthorized account
      return new WalletError('AccountUnauthorized', msg, code);
    case 4900: // user not connected
    case 4901: // user not connected to the right chain
      return new WalletError('UserNotConnected', msg, code);
    case 4902: // chain does not exist in wallet
      return new WalletError('ChainMissing', msg, code);
    case -32000: // invalid input
      if (msg.indexOf('insufficient funds') !== -1) {
        return new WalletError('InsufficientFunds', msg, code);
      } else {
        return new WalletError('InternalWalletError', msg, code);
      }
    case 4200: // method not implemented
    case -32700: // parse error
    case -32600: // invalid request
    case -32601: // method not found
    case -32602: // invalid params
    case -32603: // internal error, TODO: is it always unwrapped by metamask?
    case -32001: // resource doesnt exists
    case -32002: // resource unavailable
    case -32004: // method not supported
    case -32005: // rate limit exceeded
    case -32003: // transaction rejected, TODO: maybe should have an explicit error code
      return new WalletError('InternalWalletError', msg, code);
  }
  return;
}

function transformEVMErrors(error: unknown): KycDaoSDKError | undefined {
  const err = error as {
    code: number;
    message: string;
    data?: { code: number; message: string };
  };

  if (!err.code || !err.message) {
    return;
  }

  let code = err.code;
  let msg = err.message;

  // in case of metamask the error is wrapped into an outer JSON-RPC error
  if (code === -32603 && err.data) {
    code = err.data.code;
    msg = err.data.message;
  }

  if (code === 3) {
    return new TransactionError('TransactionRejected', msg);
  }

  return transformWalletErrorCode(code, msg);
}

// https://docs.phantom.app/solana/integrating-phantom/errors
function transformSolanaErrors(error: unknown): KycDaoSDKError | undefined {
  if (error instanceof SolanaWalletError) {
    const err = error.error as unknown as {
      code: number;
      message: string;
    };
    if (!err || !err.code || !err.message) {
      return;
    }
    return transformWalletErrorCode(err.code, err.message);
  }
  return;
}

/**
 * This is a method decorator function designed to wrap the original method and catch and handle errors that can happen in it using a provided handler logic.
 * If the handler parameter is omitted it will use the general {@link publicErrorHandler} method by default.
 *
 * @internal
 * @param {?(_: unknown) => void} [handler] An optional handler function.
 * @returns {(void) => (target: any, propertyKey: string, descriptor: PropertyDescriptor)} The original function wrapped.
 */
export function Catch(handler?: (_: unknown) => void) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        if (handler) {
          handler.call(null, error);
        } else {
          publicErrorHandler.call(null, error);
        }
      }
    };

    return descriptor;
  };
}

export type Environment = 'local' | 'development' | 'production' | 'unknown';

export class SentryWrapper {
  private _config: SentryConfiguration;
  get config() {
    return this._config;
  }

  private _environment: Environment;
  get environment() {
    return this._environment;
  }

  private _isLoaded: boolean;

  // This implementation might not be perfect for all browsers but at least it will not return the wrong env from inside an iframe
  private getEnvironment(): Environment {
    const getHostname = (): string | undefined => {
      const inIframe = window !== window.self;

      if (inIframe) {
        try {
          return window.top?.location.hostname;
        } catch {
          return;
        }
      } else {
        return window.location.hostname;
      }
    };

    const hostname = getHostname();

    if (hostname != null) {
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'local';
      }

      if (
        hostname.includes('pre.kycdao.xyz') ||
        hostname.includes('dev.kycdao.xyz') ||
        hostname.includes('staging.kycdao.xyz')
      ) {
        return 'development';
      }

      return 'production';
    }

    return 'unknown';
  }

  constructor(config: SentryConfiguration) {
    this._config = config;
    this._environment = this.getEnvironment();
    this._isLoaded = false;
  }

  private async loadScript(): Promise<void> {
    const sentry = (window as any).Sentry as any;
    if (sentry != null) {
      throw new Error('window.Sentry is already defined');
    }

    if (this._isLoaded === false) {
      const tag = document.createElement('script');
      tag.type = 'text/javascript';
      tag.src = 'https://browser.sentry-cdn.com/7.33.0/bundle.min.js';
      tag.integrity = 'sha384-fqi7Nj+xYL2iw/JEQszlVbuFt0CckGZmcb7XqOEOF5DBR0Ajzp3ZAlG3CT765hE3';
      tag.crossOrigin = 'anonymous';
      document.body.appendChild(tag);
      this._isLoaded = true;
    }

    await waitForDomElement((window) => window.Sentry);
  }

  private init(): void {
    const sentry = (window as any).Sentry as any;
    sentry.onLoad(() => {
      sentry.init({
        dsn: this._config.dsn,
        environment: this._environment,
      });

      /* sentry.configureScope(scope => {
        scope.setTag( ... );
      }); */
    });

    sentry.forceLoad();
  }

  public async lazyLoad(): Promise<void> {
    try {
      await this.loadScript();
      this.init();
    } catch (e) {
      console.warn('kycDAO Sentry loading/initialization failed', e);
    }
  }
}
