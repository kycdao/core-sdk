export const Blockchains = {
    Ethereum: 'Ethereum',
    Near: 'Near',
    Solana: 'Solana',
};
export const EvmBlockchainNetworks = {
    CeloAlfajores: 'CeloAlfajores',
    CeloMainnet: 'CeloMainnet',
    EthereumGoerli: 'EthereumGoerli',
    EthereumMainnet: 'EthereumMainnet',
    PolygonMainnet: 'PolygonMainnet',
    PolygonMumbai: 'PolygonMumbai',
    BaseGoerli: 'BaseGoerli',
    ArbitrumMainnet: 'ArbitrumMainnet',
    ArbitrumGoerli: 'ArbitrumGoerli',
    ZKSyncMainnet: 'ZKSyncMainnet',
    ZKSyncGoerli: 'ZKSyncGoerli',
};
export const NearBlockchainNetworks = {
    NearMainnet: 'NearMainnet',
    NearTestnet: 'NearTestnet',
};
export const SolanaBlockchainNetworks = {
    SolanaDevnet: 'SolanaDevnet',
    SolanaMainnet: 'SolanaMainnet',
    SolanaTestnet: 'SolanaTestnet',
};
export const BlockchainNetworks = Object.assign(Object.assign(Object.assign({}, EvmBlockchainNetworks), NearBlockchainNetworks), SolanaBlockchainNetworks);
export const TokenImageTypes = {
    Identicon: 'Identicon',
    AllowList: 'AllowList',
    TypeSpecific: 'TypeSpecific',
};
export const KycDaoEnvironments = {
    demo: 'demo',
    test: 'test',
};
export const VerificationProviders = {
    ParallelMarkets: 'ParallelMarkets',
    Persona: 'Persona',
    VerifyInvestor: 'VerifyInvestor',
};
export const VerificationStasuses = {
    Created: 'Created',
    Failed: 'Failed',
    InReview: 'InReview',
    Verified: 'Verified',
    NotVerified: 'NotVerified',
};
export const VerificationTypes = {
    AccreditedInvestor: 'AccreditedInvestor',
    KYC: 'KYC',
};
export const WalletProviders = {
    Near: 'Near',
    MetaMask: 'MetaMask',
    WalletConnect: 'WalletConnect',
};
export const KYCDAO_PUBLIC_API_PATH = 'api/public/';
export const NEAR_TESTNET_CONFIG = {
    networkId: 'testnet',
    nodeUrl: 'https://rpc.testnet.near.org',
    walletUrl: 'https://wallet.testnet.near.org',
    helperUrl: 'https://helper.testnet.near.org',
    headers: {},
};
export const NEAR_MAINNET_CONFIG = {
    networkId: 'mainnet',
    nodeUrl: 'https://rpc.mainnet.near.org',
    walletUrl: 'https://wallet.mainnet.near.org',
    helperUrl: 'https://helper.mainnet.near.org',
    headers: {},
};
export const NEAR_TESTNET_ARCHIVAL = 'https://archival-rpc.testnet.near.org';
export const NEAR_MAINNET_ARCHIVAL = 'https://archival-rpc.mainnet.near.org';
//# sourceMappingURL=constants.js.map