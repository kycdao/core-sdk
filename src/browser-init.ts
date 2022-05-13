import { Configuration, KycDao } from './';

export function init(config: Configuration): KycDao {
  return new KycDao(config);
}
