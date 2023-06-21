import { ConnectConfig } from 'near-api-js';
export declare const Blockchains: {
    readonly Ethereum: "Ethereum";
    readonly Near: "Near";
    readonly Solana: "Solana";
};
export declare const EvmBlockchainNetworks: {
    readonly CeloAlfajores: "CeloAlfajores";
    readonly CeloMainnet: "CeloMainnet";
    readonly EthereumGoerli: "EthereumGoerli";
    readonly EthereumMainnet: "EthereumMainnet";
    readonly PolygonMainnet: "PolygonMainnet";
    readonly PolygonMumbai: "PolygonMumbai";
    readonly BaseGoerli: "BaseGoerli";
    readonly ArbitrumMainnet: "ArbitrumMainnet";
    readonly ArbitrumGoerli: "ArbitrumGoerli";
    readonly ZKSyncMainnet: "ZKSyncMainnet";
    readonly ZKSyncGoerli: "ZKSyncGoerli";
};
export declare const NearBlockchainNetworks: {
    readonly NearMainnet: "NearMainnet";
    readonly NearTestnet: "NearTestnet";
};
export declare const SolanaBlockchainNetworks: {
    readonly SolanaDevnet: "SolanaDevnet";
    readonly SolanaMainnet: "SolanaMainnet";
    readonly SolanaTestnet: "SolanaTestnet";
};
export declare const BlockchainNetworks: {
    readonly SolanaDevnet: "SolanaDevnet";
    readonly SolanaMainnet: "SolanaMainnet";
    readonly SolanaTestnet: "SolanaTestnet";
    readonly NearMainnet: "NearMainnet";
    readonly NearTestnet: "NearTestnet";
    readonly CeloAlfajores: "CeloAlfajores";
    readonly CeloMainnet: "CeloMainnet";
    readonly EthereumGoerli: "EthereumGoerli";
    readonly EthereumMainnet: "EthereumMainnet";
    readonly PolygonMainnet: "PolygonMainnet";
    readonly PolygonMumbai: "PolygonMumbai";
    readonly BaseGoerli: "BaseGoerli";
    readonly ArbitrumMainnet: "ArbitrumMainnet";
    readonly ArbitrumGoerli: "ArbitrumGoerli";
    readonly ZKSyncMainnet: "ZKSyncMainnet";
    readonly ZKSyncGoerli: "ZKSyncGoerli";
};
export declare const TokenImageTypes: {
    readonly Identicon: "Identicon";
    readonly AllowList: "AllowList";
    readonly TypeSpecific: "TypeSpecific";
};
export declare const KycDaoEnvironments: {
    readonly demo: "demo";
    readonly test: "test";
};
export declare const VerificationProviders: {
    readonly ParallelMarkets: "ParallelMarkets";
    readonly Persona: "Persona";
    readonly VerifyInvestor: "VerifyInvestor";
};
export declare const VerificationStasuses: {
    readonly Created: "Created";
    readonly Failed: "Failed";
    readonly InReview: "InReview";
    readonly Verified: "Verified";
    readonly NotVerified: "NotVerified";
};
export declare const VerificationTypes: {
    readonly AccreditedInvestor: "AccreditedInvestor";
    readonly KYC: "KYC";
};
export declare const WalletProviders: {
    readonly Near: "Near";
    readonly MetaMask: "MetaMask";
    readonly WalletConnect: "WalletConnect";
};
export declare const KYCDAO_PUBLIC_API_PATH = "api/public/";
export declare const NEAR_TESTNET_CONFIG: ConnectConfig;
export declare const NEAR_MAINNET_CONFIG: ConnectConfig;
export declare const NEAR_TESTNET_ARCHIVAL = "https://archival-rpc.testnet.near.org";
export declare const NEAR_MAINNET_ARCHIVAL = "https://archival-rpc.mainnet.near.org";
