import { KYCDAO_PUBLIC_API_PATH } from './constants';
import { InternalError } from './errors';
export class KycDaoApiError extends Error {
    constructor(statusCode, errorCode, message, referenceId) {
        super(message);
        this.name = 'KycDaoApiError';
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.referenceId = referenceId;
    }
}
export class ApiBase {
    get baseUrl() {
        return this._baseUrl;
    }
    constructor(config) {
        this._apiKey = config.apiKey;
        this._baseUrl = config.baseUrl.endsWith('/') ? config.baseUrl : config.baseUrl + '/';
    }
    url(path) {
        if (path.startsWith('/')) {
            path = path.slice(1);
        }
        if (path.endsWith('/')) {
            path = path.slice(0, path.length - 1);
        }
        return this._baseUrl + KYCDAO_PUBLIC_API_PATH + path;
    }
    async request(path, options) {
        var _a;
        let url = this.url(path);
        if ((!(options === null || options === void 0 ? void 0 : options.method) || (options === null || options === void 0 ? void 0 : options.method) === 'GET') &&
            (options === null || options === void 0 ? void 0 : options.body) &&
            options.body instanceof URLSearchParams) {
            url = url + '?' + options.body;
            options.body = null;
        }
        const headers = new Headers();
        if ((options === null || options === void 0 ? void 0 : options.body) && typeof options.body === 'string') {
            headers.append('Content-type', 'application/json');
        }
        if (this._apiKey) {
            headers.append('Authorization', this._apiKey);
        }
        const requestOptions = Object.assign(Object.assign({}, options), { headers, credentials: 'include' });
        const response = await fetch(url, requestOptions).catch((reason) => {
            throw new InternalError(`The kycDAO server at ${this.baseUrl} is unreachable. Reason: ${reason}. If you have an ad blocker please disable it and try again.`);
        });
        const isJson = (_a = response.headers.get('content-type')) === null || _a === void 0 ? void 0 : _a.includes('application/json');
        const data = isJson
            ? await response.json().catch((reason) => {
                throw new InternalError(`kycDAO server JSON response is invalid. Reason: ${reason}`);
            })
            : null;
        if (!response.ok) {
            let status = response.status;
            let errorCode = 'KycDaoApiError';
            let message = status.toString();
            let referenceId;
            if (data) {
                const error = data;
                if (typeof error === 'string') {
                    message = error;
                }
                if (error === null || error === void 0 ? void 0 : error.error) {
                    const apiError = error.error;
                    status = apiError.code;
                    message = apiError.description;
                }
                if (error === null || error === void 0 ? void 0 : error.reference_id) {
                    const apiError = error;
                    status = apiError.status_code;
                    errorCode = apiError.error_code;
                    message = apiError.message;
                    referenceId = apiError.reference_id;
                }
            }
            throw new KycDaoApiError(status, errorCode, message, referenceId);
        }
        return data;
    }
    async get(path, queryParams) {
        return this.request(path, {
            method: 'GET',
            body: new URLSearchParams(queryParams),
        });
    }
    async post(path, payload) {
        return this.request(path, {
            method: 'POST',
            body: payload ? JSON.stringify(payload) : null,
        });
    }
    async put(path, payload) {
        return this.request(path, {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
    }
}
//# sourceMappingURL=api-base.js.map