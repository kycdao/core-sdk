import { SdkConfiguration } from './types';
export declare class KycDaoApiError extends Error {
    statusCode: number;
    errorCode: string;
    referenceId?: string;
    constructor(statusCode: number, errorCode: string, message: string, referenceId?: string);
}
export declare abstract class ApiBase {
    private _apiKey?;
    private _baseUrl;
    get baseUrl(): string;
    constructor(config: SdkConfiguration);
    protected url(path: string): string;
    protected request<T>(path: string, options?: RequestInit): Promise<T>;
    protected get<T>(path: string, queryParams?: Record<string, string>): Promise<T>;
    protected post<T>(path: string, payload?: object): Promise<T>;
    protected put<T>(path: string, payload: object): Promise<T>;
}
