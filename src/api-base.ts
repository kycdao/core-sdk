import { KYCDAO_PUBLIC_API_PATH } from './constants';
import { SdkConfiguration } from './types';

/**
 * @internal
 */
export class HttpError extends Error {
  public statusCode: number;

  constructor(statusCode: number, message?: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
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

    const headers = new Headers({
      'Content-type': 'application/json',
    });

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
      const errorCode: string = data?.error?.error_code || response.statusText;
      const error = new HttpError(response.status, errorCode);
      console.log(
        `${error.name} - ${response.url} ${options?.method || 'GET'} - ${
          response.status
        } ${errorCode}`,
      );
      throw error;
    }

    return data;
  }

  protected async get<T>(path: string, queryParams?: Record<string, string>): Promise<T> {
    return this.request<T>(path, {
      method: 'GET',
      body: new URLSearchParams(queryParams),
    });
  }

  protected async post<T>(path: string, payload: object): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  protected async put<T>(path: string, payload: object): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }
}
