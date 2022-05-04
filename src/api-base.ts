import { pickBy, trim } from 'lodash';

export interface Configuration {
  apiKey?: string;
  baseUrl: string;
}

export abstract class ApiBase {
  private apiKey?: string;
  private baseUrl: string;

  constructor(config: Configuration) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.endsWith('/') ? config.baseUrl : config.baseUrl + '/';
  }

  protected async request<T>(path: string, options?: RequestInit): Promise<T> {
    let url = this.baseUrl + trim(path, '/');

    if (
      (!options?.method || options?.method === 'GET') &&
      options?.body &&
      options.body instanceof URLSearchParams
    ) {
      url = url + '?' + options.body;
      options.body = null;
    }

    const headers = pickBy({
      'Content-type': 'application/json',
      Authorization: this.apiKey,
    }) as Record<string, string>;

    const requestOptions: RequestInit = {
      ...options,
      headers,
      credentials: 'include',
    };

    const res = await fetch(url, requestOptions);
    if (res.ok) {
      return res.json();
    }
    throw new Error(res.statusText);
  }

  protected async get<T>(path: string, queryParams?: Record<string, string>): Promise<T> {
    return this.request<T>(path, {
      method: 'GET',
      body: new URLSearchParams(queryParams),
    });
  }

  protected async post<T>(path: string, payload: BodyInit): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: payload,
    });
  }

  protected async put<T>(path: string, payload: BodyInit): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: payload,
    });
  }
}
