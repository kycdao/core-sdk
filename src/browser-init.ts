import { SdkConfiguration, KycDao } from './';

export function init(config: SdkConfiguration): KycDao {
  return new KycDao(config);
}
