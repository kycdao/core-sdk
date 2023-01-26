/* eslint-disable @typescript-eslint/no-explicit-any */

import { WalletError } from '@solana/wallet-adapter-base';
import { KycDaoApiError } from './api-base';
import { SentryConfiguration } from './types';
import { getRandomAlphanumericString, isLike, waitForDomElement } from './utils';

/**
 * Collection of error codes returned by the SDK.
 *
 * @readonly
 * @enum {string}
 */
export const KycDaoSDKErrorCodes = {
  KycDaoApiError: 'KycDaoApiError',
  KycDaoConfigurationError: 'KycDaoConfigurationError',
  UserCancelError: 'UserCancelError',
  UserUnauthorizedError: 'UserUnauthorizedError',
  UserNotConnected: 'UserNotConnected',
  UserWrongChainError: 'UserWrongChainError',
  InternalError: 'InternalError',
  TransactionRejectedError: 'TransactionRejectedError',
  RateLimitError: 'RateLimitError',
  UnexpectedError: 'UnexpectedError',
} as const;

/**
 * Union type of string values of {@link KycDaoSDKErrorCodes}.
 *
 * @typedef {KycDaoSDKErrorCode}
 */
export type KycDaoSDKErrorCode = keyof typeof KycDaoSDKErrorCodes;

export const KycDaoSDKErrorMessages: Record<KycDaoSDKErrorCode, string> = {
  KycDaoApiError: 'kycDAO server error',
  KycDaoConfigurationError: 'kycDAO SDK configuration error',
  UserCancelError: 'User cancelled the operation',
  UserUnauthorizedError: 'The account used is unauthorized',
  UserNotConnected: 'The user is not connected',
  UserWrongChainError: 'The user is connected to the wrong chain',
  InternalError: 'Internal error',
  TransactionRejectedError: 'The transaction was rejected',
  RateLimitError: 'An RPC rate limit error occurred',
  UnexpectedError: 'Unexpected error',
} as const;

/**
 * The specific error class returned by SDK methods.
 *
 * @interface KycDaoSDKError
 * @typedef {KycDaoSDKError}
 * @extends {Error}
 */
export class KycDaoSDKError extends Error {
  /**
   * The type of the error.
   *
   * @type {KycDaoSDKErrorCode}
   */
  public errorCode: KycDaoSDKErrorCode;
  /**
   * This is a unique reference to the error that can help us identify and solve the issue.
   *
   * @type {string}
   */
  public referenceId: string;

  constructor(errorCode: KycDaoSDKErrorCode, message?: string | null, referenceId?: string) {
    const staticMessage = KycDaoSDKErrorMessages[errorCode];

    if (!message) {
      message = staticMessage;
    } else {
      message = `${staticMessage} - ${message}`;
    }

    super(message);
    this.name = 'KycDaoSDKError';
    this.errorCode = errorCode;
    this.referenceId = referenceId || getRandomAlphanumericString(10);
  }
}

/**
 * Error handler for public methods of the SDK.
 * It catches all unhandled errors, wraps them in a KycDaoSDKError and throws that instead.
 *
 * @internal
 * @param {Error} error
 */
function publicErrorHandler(error: unknown): void {
  let err: KycDaoSDKError | undefined;
  if (error instanceof KycDaoSDKError) {
    err = error;
  } else if (error instanceof KycDaoApiError) {
    const message = `${error.errorCode} - ${error.message}`;
    err = new KycDaoSDKError('KycDaoApiError', message, error.referenceId);
  }
  // apply error transformations
  for (const fn of [transformSolanaErrors, transformEVMErrors]) {
    if (!err) {
      err = fn(error);
    }
  }
  if (!err) {
    if (typeof error === 'string') {
      err = new KycDaoSDKError('UnexpectedError', error);
    } else if (error instanceof Error) {
      err = new KycDaoSDKError('UnexpectedError', error.message);
    } else {
      err = new KycDaoSDKError('UnexpectedError', JSON.stringify(error));
    }
  }

  if (isLike<{ stack: string }>(error) && error.stack) {
    // append the original stack to know what function call the error happened in
    err.stack = err.stack + '\nCaused by:\n' + error.stack;
  }

  // report to sentry
  // TODO only report UnexpectedErrors?
  const sentry = (window as any).Sentry as any;
  if (sentry != null) {
    sentry.captureException(err, {
      tags: {
        errorCode: err.errorCode,
        referenceId: err.referenceId,
      },
    });
  }

  // TODO only log UnexpectedErrors?
  console.error(err);
  throw err;
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

  switch (code) {
    case 4001: // user rejected
      return new KycDaoSDKError('UserCancelError', msg);
    case 4100: // unauthorized account
      return new KycDaoSDKError('UserUnauthorizedError', msg);
    case 4900: // user not connected
      return new KycDaoSDKError('UserNotConnected', msg);
    case 4901: // user not connected to the right chain
      return new KycDaoSDKError('UserWrongChainError', msg);
    case 4200: // method not implemented
    case -32700: // parse error
    case -32600: // invalid request
    case -32601: // method not found
    case -32602: // invalid params
    case -32603: // internal error (???)
    case -32000: // invalid input
    case -32001: // resource doesnt exists
    case -32002: // resource unavailable
    case -32004: // method not supported
      return new KycDaoSDKError('InternalError', msg);
    case -32003:
      return new KycDaoSDKError('TransactionRejectedError', msg);
    case -32005:
      return new KycDaoSDKError('RateLimitError', msg);
  }

  return;
}

// https://docs.phantom.app/solana/integrating-phantom/errors
function transformSolanaErrors(error: unknown): KycDaoSDKError | undefined {
  if (error instanceof WalletError) {
    const err = error.error as unknown as {
      code: number;
      message: string;
    };
    if (!err || !err.code || !err.message) {
      return;
    }
    switch (err.code) {
      case 4001: // user rejected
        return new KycDaoSDKError('UserCancelError', err.message);
      case 4100: // unauthorized account
        return new KycDaoSDKError('UserUnauthorizedError', err.message);
      case 4900: // user not connected
        return new KycDaoSDKError('UserNotConnected', err.message);
      case -32000: // invalid input
      case -32002: // resource unavailable
      case -32601: // method not found
      case -32603: // internal error
        return new KycDaoSDKError('InternalError', err.message);
      case -32003:
        return new KycDaoSDKError('TransactionRejectedError', err.message);
    }
  }
  return;
}

/**
 * This is a method decorator function designed to wrap the original method and catch and handle errors that can happen in it using a provided handler logic.
 * If the handler parameter is omitted it will use the general {@link publicErrorHandler} method by default.
 *
 * @internal
 * @param {?(_: Error) => void} [handler] An optional handler function.
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
