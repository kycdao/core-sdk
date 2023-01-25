/* eslint-disable @typescript-eslint/no-explicit-any */

import { KycDaoApiError } from './api-base';
import { SentryConfiguration } from './types';
import { getRandomAlphanumericString, waitForDomElement } from './utils';

/**
 * Collection of error codes returned by the SDK.
 *
 * @readonly
 * @enum {string}
 */
export const KycDaoSDKErrorCodes = {
  KycDaoApiError: 'KycDaoApiError',
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
function publicErrorHandler(error: Error): void {
  let err: KycDaoSDKError | undefined;

  if (error instanceof KycDaoSDKError) {
    err = error;
  } else if (error instanceof KycDaoApiError) {
    const message = `${error.errorCode} - ${error.message}`;
    err = new KycDaoSDKError('KycDaoApiError', message, error.referenceId);
  } else {
    // TODO call handlers based on error code/message matching
  }

  if (!err) {
    err = new KycDaoSDKError('UnexpectedError', error.message);
  }

  // use the original stack to know what function call the error happened in
  err.stack = error.stack;

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

/**
 * This is a method decorator function designed to wrap the original method and catch and handle errors that can happen in it using a provided handler logic.
 * If the handler parameter is omitted it will use the general {@link publicErrorHandler} method by default.
 *
 * @internal
 * @param {?(_: Error) => void} [handler] An optional handler function.
 * @returns {(void) => (target: any, propertyKey: string, descriptor: PropertyDescriptor)} The original function wrapped.
 */
export function Catch(handler?: (_: Error) => void) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        let err = error;

        if (typeof error === 'string') {
          err = new Error(error);
        }

        if (err instanceof Error) {
          if (handler) {
            handler.call(null, err);
          } else {
            publicErrorHandler.call(null, err);
          }
        }
      }
    };

    return descriptor;
  };
}

export type Environment = 'local' | 'development' | 'production';

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

  // FIXME This implementation only works if we are not in an iframe...
  // by basing this logic on the backend url we can't reliably differentiate between local and dev envs
  // we can add an iframe env but can we reliable detect that we are in an iframe (cross-origin issues)
  // we can add optional iframe config input, ouir widget already needs window.origin, but other 3rd parties may miss it
  private getEnvironment(): Environment {
    const hostname = window.location.hostname;

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

  constructor(config: SentryConfiguration) {
    this._config = config;
    this._environment = this.getEnvironment();
    this._isLoaded = false;
  }

  private async loadScript(): Promise<void> {
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
