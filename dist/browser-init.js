import { KycDao } from './';
export { default as COUNTRIES } from './countries.list.json';
export { Blockchains, BlockchainNetworks, EvmBlockchainNetworks, NearBlockchainNetworks, SolanaBlockchainNetworks, VerificationTypes, } from './constants';
export async function init(config) {
    return KycDao.initialize(config);
}
//# sourceMappingURL=browser-init.js.map