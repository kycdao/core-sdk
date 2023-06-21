import { SdkConfiguration, KycDaoInitializationResult } from './';
export { default as COUNTRIES } from './countries.list.json';
export { Blockchains, BlockchainNetworks, EvmBlockchainNetworks, NearBlockchainNetworks, SolanaBlockchainNetworks, VerificationTypes, } from './constants';
export declare function init(config: SdkConfiguration): Promise<KycDaoInitializationResult>;
