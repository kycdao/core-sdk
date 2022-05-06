import { ApiBase } from './api-base';
import { ApiStatus, ServerStatus } from './types';

export { Configuration } from './api-base';
export { ServerStatus } from './types';

export default class KycDao extends ApiBase {
  public async getStatus(): Promise<ServerStatus> {
    let apiStatus: string;

    try {
      const status = await this.get<ApiStatus>('status');
      apiStatus = `OK - current_time: ${status.current_time}`;
    } catch (e) {
      if (e instanceof Error) {
        apiStatus = e.message;
      } else {
        apiStatus = `Error: ${e}`;
      }
    }

    return {
      serverBaseUrl: this.baseUrl,
      apiStatus,
    };
  }
}
