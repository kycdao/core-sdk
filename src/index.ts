import { ApiBase } from './api-base';
import { name, version } from '../package.json';
import { ApiStatus, PackageStatus } from './types';

export default class KycDao extends ApiBase {
  public async getStatus(): Promise<PackageStatus> {
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
      name,
      version,
      serverBaseUrl: this.baseUrl,
      apiStatus,
    };
  }
}
