import { SdkConfiguration, KycDao, KycDaoInitializationResult } from './';

export { default as COUNTRIES } from './countries.list.json';
export {
  Blockchains,
  BlockchainNetworks,
  EvmBlockchainNetworks,
  NearBlockchainNetworks,
  SolanaBlockchainNetworks,
  AptosBlockchainNetworks,
  VerificationTypes,
} from './constants';

export async function init(config: SdkConfiguration): Promise<KycDaoInitializationResult> {
  return KycDao.initialize(config);
}
