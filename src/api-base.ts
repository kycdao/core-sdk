import { KYCDAO_PUBLIC_API_PATH } from './constants';
import { KycDaoCustomApiError, KycDaoDefaultApiError, SdkConfiguration } from './types';

/**
 * @internal
 */
export class KycDaoApiError extends Error {
  public statusCode: number;
  public errorCode: string;

  constructor(statusCode: number, errorCode: string, message: string) {
    super(message);
    this.name = 'KycDaoApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

/**
 * @internal
 */
export abstract class ApiBase {
  private _apiKey?: string;
  private _baseUrl: string;

  /**
   * Returns the base URL of the configured kycDAO server.
   *
   * @readonly
   * @type {string}
   */
  get baseUrl(): string {
    return this._baseUrl;
  }

  constructor(config: SdkConfiguration) {
    this._apiKey = config.apiKey;
    this._baseUrl = config.baseUrl.endsWith('/') ? config.baseUrl : config.baseUrl + '/';
  }

  protected url(path: string): string {
    if (path.startsWith('/')) {
      path = path.slice(1);
    }

    if (path.endsWith('/')) {
      path = path.slice(0, path.length - 1);
    }

    return this._baseUrl + KYCDAO_PUBLIC_API_PATH + path;
  }

  protected async request<T>(path: string, options?: RequestInit): Promise<T> {
    let url = this.url(path);

    if (
      (!options?.method || options?.method === 'GET') &&
      options?.body &&
      options.body instanceof URLSearchParams
    ) {
      url = url + '?' + options.body;
      options.body = null;
    }

    const headers = new Headers();

    if (options?.body && typeof options.body === 'string') {
      headers.append('Content-type', 'application/json');
    }

    if (this._apiKey) {
      headers.append('Authorization', this._apiKey);
    }

    const requestOptions: RequestInit = {
      ...options,
      headers,
      credentials: 'include',
    };

    const response = await fetch(url, requestOptions);
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : null;

    if (!response.ok) {
      let status = response.status;
      let errorCode = 'KycDaoApiError';
      let message = 'Unknown error';

      if (data) {
        const error = data;

        // the response body is a string
        if (typeof error === 'string') {
          message = error;
        }

        // it's some kind of "default" Rocket error
        if (error?.error) {
          const apiError = error.error as KycDaoDefaultApiError;
          status = apiError.code;
          message = apiError.description;
        }

        // it's our custom API error
        if (error?.reference_id) {
          const apiError = error as KycDaoCustomApiError;
          status = apiError.status_code;
          errorCode = apiError.error_code;
          message = apiError.message;
        }
      }

      const apiError = new KycDaoApiError(status, errorCode, message);
      console.log(
        `${apiError.name} - ${response.url} ${
          options?.method || 'GET'
        } ${status} - ${errorCode} : ${message}`,
      );
      throw apiError;
    }

    return data;
  }

  protected async get<T>(path: string, queryParams?: Record<string, string>): Promise<T> {
    return this.request<T>(path, {
      method: 'GET',
      body: new URLSearchParams(queryParams),
    });
  }

  protected async post<T>(path: string, payload?: object): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: payload ? JSON.stringify(payload) : null,
    });
  }

  protected async put<T>(path: string, payload: object): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }
}
