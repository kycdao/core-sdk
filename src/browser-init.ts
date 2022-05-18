import { SdkConfiguration, KycDao } from './';

export { default as COUNTRIES } from './countries.list.json';

export function init(config: SdkConfiguration): KycDao {
  return new KycDao(config);
}
