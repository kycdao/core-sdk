import { ConnectConfig, Contract, Near, WalletConnection } from 'near-api-js';
import { BrowserLocalStorageKeyStore } from 'near-api-js/lib/key_stores';
import { FinalExecutionOutcome } from 'near-api-js/lib/providers';
import { EvmTransactionReceipt } from './blockchains/evm/types';
import { BlockchainNetworks, Blockchains, EvmBlockchainNetworks, KycDaoEnvironments, NearBlockchainNetworks, TokenImageTypes, SolanaBlockchainNetworks, VerificationProviders, VerificationStasuses, VerificationTypes, WalletProviders } from './constants';
export type Blockchain = keyof typeof Blockchains;
export type EvmBlockchainNetwork = keyof typeof EvmBlockchainNetworks;
export type NearBlockchainNetwork = keyof typeof NearBlockchainNetworks;
export type SolanaBlockchainNetwork = keyof typeof SolanaBlockchainNetworks;
export type BlockchainNetwork = keyof typeof BlockchainNetworks;
export type KycDaoEnvironment = keyof typeof KycDaoEnvironments;
export type TokenImageType = keyof typeof TokenImageTypes;
export type TransactionData = FinalExecutionOutcome | EvmTransactionReceipt | string;
export type TransactionStatus = 'NotStarted' | 'Started' | 'Success' | 'Failure' | 'Unknown';
export type VerificationProvider = keyof typeof VerificationProviders;
export type VerificationStasus = keyof typeof VerificationStasuses;
export type VerificationType = keyof typeof VerificationTypes;
export type VerificationStasusByType = Partial<Record<VerificationType, boolean>>;
export type WalletProvider = keyof typeof WalletProviders;
export type RedirectEvent = 'NearLogin' | 'NearMint' | 'NearUserRejectedError';
export interface BlockchainNetworkConfiguration {
    rpcUrl?: string;
}
export interface SentryConfiguration {
    dsn: string;
}
export interface SdkConfiguration {
    apiKey?: string;
    environment?: KycDaoEnvironment;
    demoMode?: boolean;
    baseUrl: string;
    enabledBlockchainNetworks: BlockchainNetwork[];
    enabledVerificationTypes: VerificationType[];
    evmProvider?: unknown;
    blockchainNetworkConfiguration?: Partial<Record<BlockchainNetwork, BlockchainNetworkConfiguration>>;
    sentryConfiguration?: SentryConfiguration;
}
export interface SdkStatus {
    baseUrl: string;
    demoMode: boolean;
    availableBlockchainNetworks: BlockchainNetwork[];
    availableVerificationTypes: VerificationType[];
    evmProviderConfigured: boolean;
    nearNetworkConnected: NearBlockchainNetwork | null;
    solanaNetworkConnected: SolanaBlockchainNetwork | null;
}
export interface ServerStatus {
    serverBaseUrl: string;
    apiStatus: string;
    isOk: boolean;
}
export interface NetworkAndAddress {
    blockchainNetwork: BlockchainNetwork;
    address: string;
}
export interface ChainAndAddress {
    blockchain: Blockchain;
    blockchainNetwork: BlockchainNetwork;
    address: string;
}
export interface Country {
    name: string;
    iso_cca2: string;
}
export interface NftCheckOptions {
    networkAndAddress?: NetworkAndAddress;
    rpcUrl?: string;
}
export interface TokenMetadata {
    name: string;
    description: string;
    image: string;
}
export interface NftCheckResponse {
    networkAndAddress: NetworkAndAddress;
    hasValidNft?: boolean;
    error?: string;
    tokens?: TokenMetadata[];
}
export interface EmailData {
    address?: string;
    isConfirmed?: boolean;
}
export interface VerificationData {
    email: string;
    isEmailConfirmed: boolean;
    taxResidency: string;
    isLegalEntity: boolean;
    verificationType: VerificationType;
    termsAccepted: boolean;
}
export interface PersonaOptions {
    onCancel?: () => void;
    onComplete?: () => void;
    onError?: (error: string) => void;
    frameAncestors?: string[];
    messageTargetOrigin?: string;
}
export interface VerificationProviderOptions {
    personaOptions?: PersonaOptions;
}
export interface MintingData {
    disclaimerAccepted: boolean;
    verificationType?: VerificationType;
    imageId: string;
    subscriptionYears?: number;
}
export interface MintingResult {
    transactionUrl: string;
    tokenId: string;
    imageUrl: string;
}
export interface RedirectResult {
    event?: RedirectEvent;
    mintingResult?: MintingResult;
}
export interface PersonaStatus {
    template_id: string;
    sandbox: boolean;
}
export interface SmartContractConfig {
    address: string;
    payment_discount_percent: number;
}
export type SmartContractsByVerificationType = Partial<Record<VerificationType, SmartContractConfig>>;
export type SmartContractsByBlockchainNetwork = Partial<Record<BlockchainNetwork, SmartContractsByVerificationType>>;
export interface KycDaoDefaultApiError {
    code: number;
    reason: string;
    description: string;
}
export interface KycDaoCustomApiError {
    reference_id: string;
    status_code: number;
    internal: boolean;
    error_code: string;
    message: string;
    error_details?: string;
}
export interface ApiStatus {
    current_time: string;
    persona: PersonaStatus;
    enabled_networks: BlockchainNetwork[];
    smart_contracts_info: SmartContractsByBlockchainNetwork;
}
export interface CurrencyData {
    name: string;
    symbol: string;
    decimals: number;
}
export interface ExplorerData {
    name: string;
    url: string;
    transaction_path: string;
}
export interface NetworkMetadata {
    id: BlockchainNetwork;
    blockchain: Blockchain;
    name: string;
    caip2id: string;
    chain_id?: number;
    native_currency: CurrencyData;
    explorer: ExplorerData;
    testnet: boolean;
    rpc_urls: string[];
}
export interface PersonaSessionData {
    referenceId: string;
    inquiryId: string;
    sessionToken?: string;
}
export interface VerificationStatus {
    personaSessionData?: PersonaSessionData;
}
export interface NearSdk {
    blockchainNetwork: NearBlockchainNetwork;
    keyStore: BrowserLocalStorageKeyStore;
    config: ConnectConfig;
    api: Near;
    wallet: WalletConnection;
    archival: string;
    contractName: string;
}
export interface MintingState {
    chainAndAddress: ChainAndAddress;
    mintingData: MintingData;
    mintAuthResponse: MintingAuthorizationResponse;
}
export interface KycDaoContract extends Contract {
    mint_with_code: (_: {
        args: {
            auth_code: number;
        };
        gas: string;
        amount: string;
        callbackUrl?: string;
    }) => Promise<unknown>;
    get_required_mint_cost_for_code: (_: {
        auth_code: number;
        dst: string;
    }) => Promise<string>;
}
export interface Transaction {
    status: TransactionStatus;
    data?: TransactionData;
}
export interface ProviderProfile {
    id: number;
    created: string;
    user_id: number;
    provider_name: VerificationProvider;
    provider_profile_id: string;
}
export interface TokenDetails {
    id: number;
    blockchain_account_id: number;
    network: BlockchainNetwork;
    authorization_code: string;
    authorization_tx_id?: string;
    minted_at?: string;
    minting_tx_id?: string;
    token_id?: string;
    verification_type: VerificationType;
    image_url: string;
}
export interface VerificationRequest {
    id: number;
    user_id: number;
    provider_name: VerificationProvider;
    provider_request_id: string;
    created: string;
    updated: string;
    status: VerificationStasus;
    verification_type: VerificationType;
    expires?: string;
}
export interface BlockchainAccountDetails {
    id: number;
    blockchain: Blockchain;
    address: string;
    user_id: number;
    tokens: TokenDetails[];
}
export interface TokenImage {
    image_type: TokenImageType;
    url: string;
}
export interface UserDetails {
    id: number;
    legal_entity?: boolean;
    created: string;
    residency?: string;
    disclaimer_accepted?: string;
    email?: string;
    email_confirmed?: string;
    user_hash: string;
    ext_id: string;
    provider_profiles: ProviderProfile[];
    verification_requests: VerificationRequest[];
    blockchain_accounts: BlockchainAccountDetails[];
    available_images: {
        [imageId: string]: TokenImage;
    };
    subscription_expiry?: string;
}
export interface UserUpdateRequest {
    legal_entity?: boolean;
    residency?: string;
    email?: string;
}
export interface AllowListEntry {
    id: number;
    blockchain: Blockchain;
    address: string;
    dao_name?: string;
    image_url?: string;
}
export interface Session {
    id: string;
    expires: string;
    nonce: string;
    eip_4361_message: string;
    chain_and_address: ChainAndAddress;
    usable_networks: BlockchainNetwork[];
    allow_list_entry?: AllowListEntry;
    user?: UserDetails;
}
export interface MintingAuthorizationRequest {
    blockchain_account_id: number;
    network: string;
    selected_image_id?: string;
    subscription_duration?: string;
}
export interface MintingAuthorizationResponse {
    token: TokenDetails;
    metadata_url?: string;
    transaction?: string;
}
