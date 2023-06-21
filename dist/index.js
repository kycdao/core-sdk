var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Contract, keyStores, Near, WalletConnection } from 'near-api-js';
import { base_encode } from 'near-api-js/lib/utils/serialize';
import { Client as PersonaClient } from 'persona';
import { ApiBase, KycDaoApiError } from './api-base';
import { BN } from 'bn.js';
import { BlockchainNetworks, EvmBlockchainNetworks, NEAR_MAINNET_ARCHIVAL, NEAR_MAINNET_CONFIG, NEAR_TESTNET_ARCHIVAL, NEAR_TESTNET_CONFIG, VerificationTypes, } from './constants';
import { default as COUNTRIES } from './countries.list.json';
import { JsonRpcProvider } from 'near-api-js/lib/providers';
import { getMintingResult, isFulfilled, isLike, isEqual, isSameAddress, partition, poll, typedKeys, } from './utils';
import { EvmProviderWrapper } from './blockchains/evm/evm-provider-wrapper';
import { KycDaoJsonRpcProvider } from './blockchains/kycdao-json-rpc-provider';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { SolanaProviderWrapper } from './blockchains/solana/solana-provider-wrapper';
import { Transaction as SolanaTransaction } from '@solana/web3.js';
import { Catch, ConfigurationError, InternalError, SentryWrapper, StatusError, TransactionError, UnreachableCaseError, WalletError, } from './errors';
export { ApiBase, KycDaoApiError } from './api-base';
export { Blockchains, BlockchainNetworks, EvmBlockchainNetworks, NearBlockchainNetworks, KycDaoEnvironments, SolanaBlockchainNetworks, VerificationTypes, } from './constants';
export { KycDaoSDKError, ConfigurationError, StatusError, WalletError, TransactionError, InternalError, UnknownError, StatusErrors, WalletErrors, TransactionErrors, } from './errors';
export const Countries = Array.from(COUNTRIES);
export class KycDao extends ApiBase {
    getNetworkDetails(network) {
        const details = this.networkDetails[network];
        if (!details) {
            throw new InternalError(`Network details not found for ${network}`);
        }
        return details;
    }
    get sdkStatus() {
        var _a, _b;
        return {
            baseUrl: this.baseUrl,
            demoMode: this.demoMode,
            availableBlockchainNetworks: this.blockchainNetworks,
            availableVerificationTypes: this.verificationTypes,
            evmProviderConfigured: !!this.evmProvider,
            nearNetworkConnected: ((_a = this.near) === null || _a === void 0 ? void 0 : _a.blockchainNetwork) || null,
            solanaNetworkConnected: ((_b = this.solana) === null || _b === void 0 ? void 0 : _b.blockchainNetwork) || null,
        };
    }
    get connectedWallet() {
        return this._chainAndAddress;
    }
    get walletConnected() {
        return !!this._chainAndAddress;
    }
    get loggedIn() {
        return !!this.user;
    }
    get subscribed() {
        if (!this.user) {
            throw new StatusError('UserNotLoggedIn');
        }
        return !!this.user.subscription_expiry;
    }
    isVerifiedForType(verificationType) {
        var _a;
        return (((_a = this.user) === null || _a === void 0 ? void 0 : _a.verification_requests.some((req) => req.verification_type === verificationType && req.status === 'Verified')) || false);
    }
    getVerificationStatusByType() {
        const status = {};
        const allVerificationTypes = Object.values(VerificationTypes);
        for (const verificationType of allVerificationTypes) {
            status[verificationType] = this.isVerifiedForType(verificationType);
        }
        return status;
    }
    getSmartContractAddress(blockchainNetwork, verificationType) {
        var _a, _b, _c;
        return (_c = (_b = (_a = this.apiStatus) === null || _a === void 0 ? void 0 : _a.smart_contracts_info[blockchainNetwork]) === null || _b === void 0 ? void 0 : _b[verificationType]) === null || _c === void 0 ? void 0 : _c.address;
    }
    getBlockchainAccount(chainAndAddress) {
        var _a;
        const accounts = (_a = this.user) === null || _a === void 0 ? void 0 : _a.blockchain_accounts;
        if (!(accounts === null || accounts === void 0 ? void 0 : accounts.length)) {
            throw new InternalError('User has no blockchain accounts.');
        }
        const { blockchain, address } = chainAndAddress;
        const accountsFound = accounts.filter((acc) => isSameAddress(blockchain, acc.address, address));
        if (accountsFound.length > 1) {
            throw new InternalError('Multiple blockchain accounts found for the same wallet address.');
        }
        if (!accountsFound.length) {
            throw new InternalError('Wallet address is not registered to the current user.');
        }
        return accountsFound[0];
    }
    getValidAuthorizationCode() {
        var _a;
        if (this._chainAndAddress && this.user) {
            try {
                const account = this.getBlockchainAccount(this._chainAndAddress);
                return (_a = account.tokens.find((token) => {
                    return token.authorization_tx_id && !token.minted_at;
                })) === null || _a === void 0 ? void 0 : _a.authorization_code;
            }
            catch (_b) {
                return undefined;
            }
        }
        return undefined;
    }
    async getTx(chainAndAddress, txHash) {
        switch (chainAndAddress.blockchain) {
            case 'Near': {
                if (!this.near) {
                    throw new ConfigurationError('Near SDK not initialized.');
                }
                const provider = new JsonRpcProvider({ url: this.near.archival });
                try {
                    const outcome = await provider.txStatus(txHash, this.near.contractName);
                    if (typeof outcome.status !== 'string') {
                        if (outcome.status.SuccessValue !== undefined) {
                            return {
                                status: 'Success',
                                data: outcome,
                            };
                        }
                        if (outcome.status.Failure !== undefined) {
                            return {
                                status: 'Failure',
                                data: outcome,
                            };
                        }
                        return {
                            status: 'Unknown',
                            data: outcome,
                        };
                    }
                    else {
                        return {
                            status: outcome.status,
                            data: outcome,
                        };
                    }
                }
                catch (e) {
                    throw new InternalError(`Unexpected error while checking Near transaction: ${e}.`);
                }
            }
            case 'Ethereum': {
                if (!this.evmProvider) {
                    throw new ConfigurationError('EVM provider not configured.');
                }
                const receipt = await this.evmProvider.getTransactionReceipt(txHash);
                if (!receipt) {
                    return {
                        status: 'Unknown',
                    };
                }
                if (receipt.status === 1) {
                    return {
                        status: 'Success',
                        data: receipt,
                    };
                }
                else {
                    return {
                        status: 'Failure',
                        data: receipt,
                    };
                }
            }
            case 'Solana':
                if (!this.solana) {
                    throw new ConfigurationError('Solana support is not enabled.');
                }
                return await this.solana.getTransaction(txHash);
            default:
                throw new UnreachableCaseError(chainAndAddress.blockchain);
        }
    }
    async waitForTransaction(chainAndAddress, txHash) {
        try {
            return await poll(() => this.getTx(chainAndAddress, txHash), 5000, 12 * 3, {
                resolvePredicate: (r) => {
                    return r.status === 'Success' || r.status === 'Failure';
                },
                retryOnErrorPredicate: (e) => {
                    if (e instanceof Error) {
                        const txDoesNotExistPred = e.message.includes(`Transaction ${txHash} doesn't exist`);
                        return txDoesNotExistPred;
                    }
                    else {
                        return false;
                    }
                },
                useExponentialBackoff: false,
            });
        }
        catch (e) {
            if (e instanceof Error && e.message === 'TIMEOUT') {
                throw new TransactionError('TransactionNotFound');
            }
            else {
                throw e;
            }
        }
    }
    validateBlockchainNetworks(availableBlockchainNetworks, enabledBlockchainNetworks) {
        const errorPrefix = 'kycDAO SDK';
        const allBlockchainNetworks = Object.values(BlockchainNetworks);
        const [validBlockchainNetworks, invalidBlockchainNetworks] = partition([...new Set(enabledBlockchainNetworks)], (network) => allBlockchainNetworks.includes(network));
        if (invalidBlockchainNetworks.length > 0) {
            console.warn(`Invalid network name(s) were found in configuration and will be ignored: ${invalidBlockchainNetworks.join(', ')}. Valid values are: ${allBlockchainNetworks.join(', ')}.`);
        }
        if (!validBlockchainNetworks.length) {
            throw new ConfigurationError(`No valid network names were found in configuration. Configured values: ${enabledBlockchainNetworks.join(', ')}; Valid values are: ${allBlockchainNetworks.join(', ')}.`);
        }
        const [finalBlockchainNetworks, unavailableBlockchainNetworks] = partition(validBlockchainNetworks, (network) => availableBlockchainNetworks.includes(network));
        if (unavailableBlockchainNetworks.length > 0) {
            console.warn(`${errorPrefix} - The following configured networks are unavailable on the connected server: ${unavailableBlockchainNetworks.join(', ')}. Avaliable networks are: ${availableBlockchainNetworks.join(', ')}.`);
        }
        const ensureSingleChain = () => {
            let currentChain;
            for (const network of finalBlockchainNetworks) {
                const chain = this.getNetworkDetails(network).blockchain;
                if (!currentChain) {
                    currentChain = chain;
                }
                else {
                    if (chain !== currentChain) {
                        return false;
                    }
                }
            }
            return true;
        };
        if (!ensureSingleChain()) {
            throw new ConfigurationError('Only networks of a single chain type/protocol can be enabled at a time.');
        }
        if (!finalBlockchainNetworks.length) {
            throw new ConfigurationError(`No available networks were found in configuration. Available networks are: ${availableBlockchainNetworks.join(', ')}.`);
        }
        const multipleNearNetworks = finalBlockchainNetworks.filter((network) => network.startsWith('Near')).length > 1;
        if (multipleNearNetworks) {
            throw new ConfigurationError('Only one Near network can be configured at a time.');
        }
        const multipleSolanaNetworks = finalBlockchainNetworks.filter((network) => network.startsWith('Solana')).length > 1;
        if (multipleSolanaNetworks) {
            throw new ConfigurationError('Only one Solana network can be configured at a time.');
        }
        return finalBlockchainNetworks;
    }
    static validateVerificationTypes(verificationTypes) {
        const errorPrefix = 'kycDAO SDK';
        const allVerificationTypes = Object.values(VerificationTypes);
        const [validVerificationTypes, invalidVerificationTypes] = partition([...new Set(verificationTypes)], (verificationType) => allVerificationTypes.includes(verificationType));
        if (invalidVerificationTypes.length > 0) {
            console.warn(`${errorPrefix} - Invalid verification type(s) were found in configuration and will be ignored: ${invalidVerificationTypes.join(', ')}. Valid values are: ${allVerificationTypes.join(', ')}.`);
        }
        if (!validVerificationTypes.length) {
            throw new ConfigurationError(`No valid verification types were found in configuration. Valid values are: ${allVerificationTypes.join(', ')}.`);
        }
        return validVerificationTypes;
    }
    static validateEvmProvider(blockchainNetworks, evmProvider) {
        const evmBlockchainNetworks = Object.values(EvmBlockchainNetworks);
        const hasEvmNetworkEnabled = evmBlockchainNetworks.some((network) => blockchainNetworks.includes(network));
        if (hasEvmNetworkEnabled) {
            if (evmProvider === undefined) {
                console.warn('EVM provider is missing from the SDK configuration while at least one EVM network has been enabled');
                return;
            }
            if (isLike(evmProvider) &&
                typeof evmProvider.request === 'function' &&
                typeof evmProvider.on === 'function') {
                return evmProvider;
            }
            throw new ConfigurationError('The configured EVM provider is not compliant with the required standards.');
        }
        return;
    }
    validateEmail(email) {
        const emailRegExp = new RegExp('^[^@]+@([\\w-]+\\.)+[\\w-]{2,}$');
        if (!email.match(emailRegExp)) {
            throw new StatusError('InvalidEmailAddress');
        }
    }
    validateVerificationData(verificationData) {
        if (!verificationData.termsAccepted) {
            throw new StatusError('TermsAndConditionsNotAccepted');
        }
        const allVerificationTypes = Object.values(VerificationTypes);
        const verificationType = verificationData.verificationType;
        if (!allVerificationTypes.includes(verificationType)) {
            throw new ConfigurationError(`Invalid verificationType. Valid values are: ${allVerificationTypes.join(', ')}.`);
        }
        if (!this.verificationTypes.includes(verificationType)) {
            throw new ConfigurationError(`Invalid verificationType. "${verificationType}" was not enabled during SDK initialization.`);
        }
        this.validateEmail(verificationData.email);
        const taxResidency = verificationData.taxResidency;
        const country = Countries.find((country) => country.iso_cca2.toUpperCase() === taxResidency.toUpperCase() ||
            country.name.toLowerCase() === taxResidency.toLowerCase());
        if (country) {
            const isNameMatch = country.name.toLowerCase() === taxResidency.toLowerCase();
            if (isNameMatch) {
                verificationData.taxResidency = country.iso_cca2;
            }
        }
        else {
            throw new StatusError('InvalidTaxResidency');
        }
        return verificationData;
    }
    syncUserAndSessionWithWallet() {
        if (this.user) {
            let isSameUser = false;
            if (this._chainAndAddress) {
                const { blockchain, address } = this._chainAndAddress;
                isSameUser = this.user.blockchain_accounts.some((account) => account.blockchain === blockchain &&
                    isSameAddress(blockchain, account.address, address));
            }
            if (!isSameUser) {
                this.user = undefined;
                this.session = undefined;
            }
        }
        else if (this.session) {
            const isSameWallet = isEqual(this.session.chain_and_address, this._chainAndAddress);
            if (!isSameWallet) {
                this.session = undefined;
            }
        }
    }
    async refreshSession() {
        const createSession = async (chainAndAddress) => {
            const session = await this.post('session', chainAndAddress);
            this.session = session;
            this.user = session.user;
        };
        try {
            const session = await this.get('session');
            this.session = session;
            this.user = session.user;
            this.syncUserAndSessionWithWallet();
            if (!this.session && this._chainAndAddress) {
                await createSession(this._chainAndAddress);
            }
            return this.session;
        }
        catch (e) {
            if (e instanceof KycDaoApiError && e.statusCode === 401) {
                if (this._chainAndAddress) {
                    await createSession(this._chainAndAddress);
                }
                else {
                    this.session = undefined;
                    this.user = undefined;
                }
                return this.session;
            }
            console.error(`Unexpected error during kycDAO session refresh: ${e}`);
            throw e;
        }
    }
    initNear(blockchainNetwork) {
        if (!blockchainNetwork.startsWith('Near')) {
            throw new InternalError(`Not a  Near network: ${blockchainNetwork}`);
        }
        const contractName = this.getSmartContractAddress(blockchainNetwork, 'KYC');
        if (!contractName) {
            throw new InternalError('Smart contract name configuration missing.');
        }
        let config = NEAR_TESTNET_CONFIG;
        let archival = NEAR_TESTNET_ARCHIVAL;
        if (blockchainNetwork === 'NearMainnet') {
            config = NEAR_MAINNET_CONFIG;
            archival = NEAR_MAINNET_ARCHIVAL;
        }
        const keyStore = new keyStores.BrowserLocalStorageKeyStore();
        config.keyStore = keyStore;
        const nearApi = new Near(config);
        const wallet = new WalletConnection(nearApi, 'kycDAO');
        this.near = {
            blockchainNetwork,
            keyStore,
            config,
            api: nearApi,
            wallet,
            archival,
            contractName,
        };
    }
    async handleNearWalletCallback(event, queryParams, detectedValue) {
        if (!this.near) {
            throw new InternalError('Near callback detected but the Near SDK is  not initialized.');
        }
        if (this.near.wallet.isSignedIn()) {
            const address = this.near.wallet.getAccountId();
            this._chainAndAddress = {
                blockchain: 'Near',
                blockchainNetwork: this.near.blockchainNetwork,
                address,
            };
            await this.refreshSession();
            let mintingResult;
            switch (event) {
                case 'NearLogin':
                    break;
                case 'NearMint': {
                    const authCode = queryParams.get('authCode');
                    if (authCode) {
                        const chainAndAddress = Object.assign({}, this._chainAndAddress);
                        const transaction = await this.getTx(chainAndAddress, detectedValue);
                        if (transaction.status !== 'Success') {
                            throw new TransactionError('TransactionFailed');
                        }
                        const outcome = transaction.data;
                        if (typeof outcome.status === 'string' || !outcome.status.SuccessValue) {
                            throw new InternalError('NearMint callback detected but transaction outcome does not have a SuccessValue (token ID).');
                        }
                        else {
                            const successValue = outcome.status.SuccessValue;
                            const tokenId = JSON.parse(Buffer.from(successValue, 'base64').toString()).token_id;
                            const tokenDetails = await this.post('token', {
                                authorization_code: authCode,
                                token_id: tokenId,
                                minting_tx_id: detectedValue,
                            });
                            const networkDetails = this.getNetworkDetails(chainAndAddress.blockchainNetwork);
                            mintingResult = getMintingResult(networkDetails, detectedValue, tokenId, tokenDetails);
                        }
                    }
                    else {
                        throw new InternalError('authCode parameter is empty or missing from NearMint callback URL.');
                    }
                    break;
                }
                case 'NearUserRejectedError':
                    break;
                default:
                    throw new UnreachableCaseError(event);
            }
            return mintingResult;
        }
        return;
    }
    async handleRedirect() {
        const errorPrefix = 'Wallet callback handling error';
        const knownQueryParams = {
            account_id: 'NearLogin',
            errorCode: 'NearUserRejectedError',
            transactionHashes: 'NearMint',
        };
        const knownQueryParamNames = Object.keys(knownQueryParams);
        const queryParams = new URLSearchParams(window.location.search);
        const queryParamsArray = [...queryParams];
        const matches = queryParamsArray.filter(([key, _]) => knownQueryParamNames.includes(key));
        const url = new URL(window.location.href);
        knownQueryParamNames
            .concat(['authCode', 'errorMessage'])
            .forEach((param) => url.searchParams.delete(param));
        window.history.replaceState({}, document.title, url);
        if (matches.length > 1) {
            console.error(`${errorPrefix} - Multiple URL query parameters identified: ${matches.map(([key, _]) => key)}.`);
            return;
        }
        if (matches.length === 1) {
            const match = matches[0];
            const key = match[0];
            const value = match[1];
            const event = knownQueryParams[key];
            let mintingResult;
            if (event.startsWith('Near')) {
                mintingResult = await this.handleNearWalletCallback(event, queryParams, value);
            }
            return { event, mintingResult };
        }
        return;
    }
    constructor(config) {
        if (config.environment) {
            console.warn('The environment parameter in the kycDAO SDK configuration is deprecated, please use the demoMode switch instead!');
        }
        config.enabledVerificationTypes = KycDao.validateVerificationTypes(config.enabledVerificationTypes);
        super(config);
        this.networkDetails = {};
        this.demoMode = !!config.demoMode;
        this.verificationTypes = config.enabledVerificationTypes;
        this.blockchainNetworks = [];
        this.verificationStatus = {
            personaSessionData: undefined,
        };
        this.sentry = new SentryWrapper();
    }
    static async initialize(config) {
        var _a;
        const kycDao = new KycDao(config);
        kycDao.apiStatus = await kycDao.get('status');
        const networks = await kycDao.get('networks');
        networks.forEach((network) => {
            kycDao.networkDetails[network.id] = network;
        });
        const networkConf = config.blockchainNetworkConfiguration;
        if (networkConf) {
            let network;
            for (network in networkConf) {
                const details = kycDao.getNetworkDetails(network);
                const config = networkConf[network];
                const rpcUrls = (config === null || config === void 0 ? void 0 : config.rpcUrl) ? [config.rpcUrl] : details.rpc_urls;
                kycDao.networkDetails[network] = Object.assign(Object.assign({}, details), { rpc_urls: rpcUrls });
            }
        }
        kycDao.blockchainNetworks = kycDao.validateBlockchainNetworks(kycDao.apiStatus.enabled_networks, config.enabledBlockchainNetworks);
        const evmProvider = KycDao.validateEvmProvider(kycDao.blockchainNetworks, config.evmProvider);
        if (!evmProvider) {
            kycDao.blockchainNetworks = kycDao.blockchainNetworks.filter((network) => !Object.keys(EvmBlockchainNetworks).includes(network));
        }
        else {
            evmProvider.on('chainChanged', (chainId) => {
                const networkDetails = kycDao.networkDetails;
                const blockchainNetwork = typedKeys(networkDetails).find((network) => kycDao.getNetworkDetails(network).chain_id === chainId);
                const isSupportedAndEnabled = blockchainNetwork && kycDao.blockchainNetworks.includes(blockchainNetwork);
                if (kycDao._chainAndAddress &&
                    kycDao._chainAndAddress.blockchain === 'Ethereum' &&
                    isSupportedAndEnabled) {
                    kycDao._chainAndAddress.blockchainNetwork = blockchainNetwork;
                }
            });
            kycDao.evmProvider = new EvmProviderWrapper(evmProvider, Object.values(kycDao.networkDetails));
        }
        const nearNetwork = kycDao.blockchainNetworks.find((network) => network.startsWith('Near'));
        if (nearNetwork) {
            kycDao.initNear(nearNetwork);
        }
        const solanaNetwork = kycDao.blockchainNetworks.find((network) => network.startsWith('Solana'));
        if (solanaNetwork) {
            kycDao.solana = new SolanaProviderWrapper(solanaNetwork);
        }
        const redirectResult = await kycDao.handleRedirect();
        return {
            kycDao,
            redirectEvent: redirectResult === null || redirectResult === void 0 ? void 0 : redirectResult.event,
            transactionUrl: (_a = redirectResult === null || redirectResult === void 0 ? void 0 : redirectResult.mintingResult) === null || _a === void 0 ? void 0 : _a.transactionUrl,
            mintingResult: redirectResult === null || redirectResult === void 0 ? void 0 : redirectResult.mintingResult,
            sdkStatus: kycDao.sdkStatus,
        };
    }
    async getServerStatus() {
        let apiStatus;
        let isOk;
        try {
            const status = await this.get('status');
            isOk = true;
            apiStatus = `${status.current_time}`;
        }
        catch (e) {
            isOk = false;
            if (e instanceof Error) {
                apiStatus = e.message;
            }
            else {
                apiStatus = `Error: ${e}`;
            }
        }
        return {
            serverBaseUrl: this.baseUrl,
            apiStatus,
            isOk,
        };
    }
    getChainAndAddressForNftCheck(options) {
        const networkAndAddress = options === null || options === void 0 ? void 0 : options.networkAndAddress;
        const chainAndAddress = networkAndAddress
            ? Object.assign(Object.assign({}, networkAndAddress), { blockchain: this.getNetworkDetails(networkAndAddress.blockchainNetwork).blockchain }) : this._chainAndAddress;
        if (!chainAndAddress) {
            throw new StatusError('WalletNotConnected', 'BlockchainNetwork and address not set yet. Either connect a wallet with kycDAO first or specify them in the parameters.');
        }
        const address = chainAndAddress.address;
        if (!address) {
            throw new InternalError('Wallet address cannot be empty.');
        }
        return chainAndAddress;
    }
    getRpcProviderForWallet(verificationType, chainAndAddress) {
        var _a, _b, _c, _d;
        const { blockchain, blockchainNetwork } = chainAndAddress;
        const rpcUrl = this.getNetworkDetails(blockchainNetwork).rpc_urls[0];
        const contractAddress = (_d = (_c = (_b = (_a = this.apiStatus) === null || _a === void 0 ? void 0 : _a.smart_contracts_info) === null || _b === void 0 ? void 0 : _b[blockchainNetwork]) === null || _c === void 0 ? void 0 : _c[verificationType]) === null || _d === void 0 ? void 0 : _d.address;
        if (!contractAddress) {
            throw new InternalError('Smart contract address not found.');
        }
        return new KycDaoJsonRpcProvider(blockchain, contractAddress, rpcUrl);
    }
    async checkValidNft(verificationType, chainAndAddress) {
        const provider = this.getRpcProviderForWallet(verificationType, chainAndAddress);
        return provider.hasValidNft(chainAndAddress.address);
    }
    async hasValidNft(verificationType, options) {
        const chainAndAddress = this.getChainAndAddressForNftCheck(options);
        return await this.checkValidNft(verificationType, chainAndAddress);
    }
    async getValidNfts(verificationType, options) {
        const chainAndAddress = this.getChainAndAddressForNftCheck(options);
        const provider = this.getRpcProviderForWallet(verificationType, chainAndAddress);
        return await provider.getValidNfts(chainAndAddress);
    }
    async checkVerifiedNetworks(verificationType, options) {
        const chainAndAddress = this.getChainAndAddressForNftCheck(options);
        const selectedNetworkDetails = this.getNetworkDetails(chainAndAddress.blockchainNetwork);
        const networksToCheck = typedKeys(this.networkDetails).filter((blockchainNetwork) => {
            const details = this.getNetworkDetails(blockchainNetwork);
            return (this.blockchainNetworks.includes(blockchainNetwork) &&
                details.blockchain === selectedNetworkDetails.blockchain &&
                details.testnet === selectedNetworkDetails.testnet);
        });
        const promises = networksToCheck.map((blockchainNetwork) => {
            const networkAndAddress = {
                blockchainNetwork,
                address: chainAndAddress.address,
            };
            return new Promise((resolve, _) => {
                this.checkValidNft(verificationType, Object.assign(Object.assign({}, chainAndAddress), { blockchainNetwork }))
                    .then((hasValidNft) => {
                    resolve({ networkAndAddress, hasValidNft });
                })
                    .catch((reason) => {
                    resolve({ networkAndAddress, error: String(reason) });
                });
            });
        });
        const results = await Promise.allSettled(promises);
        const fulfilled = results.filter(isFulfilled);
        return fulfilled.map((fulfilled) => fulfilled.value);
    }
    async switchOrAddNetworkChecked(newChainDetails) {
        if (!this.evmProvider) {
            throw new InternalError('EVM provider not found.');
        }
        await this.evmProvider.switchOrAddNetwork(newChainDetails);
        const updatedChainId = await this.evmProvider.getChainId();
        if (Number(updatedChainId) !== newChainDetails.chain_id) {
            throw new InternalError(`EVM network switching failed: switchNetwork call did not throw an error, but wallet returns wrong chainId (${updatedChainId}), expected ${newChainDetails.chain_id}.`);
        }
    }
    isUserRejectError(e) {
        return e instanceof WalletError && e.errorCode === 'RejectedByUser';
    }
    async ensureValidProviderNetwork(blockchain, autoSwitch = false) {
        const networkDetails = this.networkDetails;
        let blockchainNetwork;
        switch (blockchain) {
            case 'Ethereum': {
                if (!this.evmProvider) {
                    throw new ConfigurationError('EVM provider not configured.');
                }
                const chainId = await this.evmProvider.getChainId();
                blockchainNetwork = typedKeys(networkDetails).find((network) => this.getNetworkDetails(network).chain_id === Number(chainId));
                if (!blockchainNetwork || !this.blockchainNetworks.includes(blockchainNetwork)) {
                    if (autoSwitch && this.blockchainNetworks.length === 1) {
                        const enabledNetwork = this.blockchainNetworks[0];
                        const enabledNetworkDetails = this.getNetworkDetails(enabledNetwork);
                        if (enabledNetworkDetails.blockchain === 'Ethereum' && enabledNetworkDetails.chain_id) {
                            try {
                                await this.switchOrAddNetworkChecked(enabledNetworkDetails);
                            }
                            catch (e) {
                                if (this.isUserRejectError(e)) {
                                    throw e;
                                }
                                else {
                                    console.log('Automatic EVM network switching failed:', e);
                                    throw new StatusError('NetworkSwitchingFailed', 'Automatic EVM network switching failed: feature not supported by the wallet.');
                                }
                            }
                            blockchainNetwork = enabledNetwork;
                        }
                        else {
                            throw new InternalError('Network configuration error.');
                        }
                    }
                    else {
                        if (!blockchainNetwork) {
                            throw new StatusError('NetworkNotSupported', 'Selected EVM network in wallet is not supported by the SDK.');
                        }
                        else {
                            throw new StatusError('NetworkNotEnabled', `Selected EVM network in wallet (${chainId}) is not enabled in the SDK.`);
                        }
                    }
                }
                break;
            }
            case 'Near': {
                if (!this.near) {
                    throw new ConfigurationError('Near SDK not initialized.');
                }
                blockchainNetwork = this.near.blockchainNetwork;
                break;
            }
            case 'Solana': {
                if (!this.solana) {
                    throw new ConfigurationError('Solana support is not enabled.');
                }
                blockchainNetwork = this.solana.blockchainNetwork;
                break;
            }
            default:
                throw new UnreachableCaseError(blockchain);
        }
        return blockchainNetwork;
    }
    async checkProviderNetwork() {
        if (!this._chainAndAddress) {
            throw new StatusError('WalletNotConnected');
        }
        return this.ensureValidProviderNetwork(this._chainAndAddress.blockchain);
    }
    async switchProviderNetwork(blockchainNetwork) {
        if (!this._chainAndAddress) {
            throw new StatusError('WalletNotConnected');
        }
        if (!this.blockchainNetworks.includes(blockchainNetwork)) {
            throw new StatusError('NetworkNotEnabled');
        }
        const networkDetails = this.getNetworkDetails(blockchainNetwork);
        if (this._chainAndAddress.blockchain !== networkDetails.blockchain) {
            throw new StatusError('NetworkSwitchingFailed', 'Selected network has a different blockchain than the currently connected wallet.');
        }
        const blockchain = networkDetails.blockchain;
        switch (blockchain) {
            case 'Ethereum': {
                if (!this.evmProvider) {
                    throw new ConfigurationError('EVM provider not configured.');
                }
                const newChainId = networkDetails.chain_id;
                if (!newChainId) {
                    throw new InternalError('Network configuration error.');
                }
                const currentChainId = await this.evmProvider.getChainId();
                if (Number(currentChainId) !== newChainId) {
                    try {
                        await this.switchOrAddNetworkChecked(networkDetails);
                    }
                    catch (e) {
                        if (this.isUserRejectError(e)) {
                            throw e;
                        }
                        else {
                            console.log('EVM network switching failed:', e);
                            throw new StatusError('NetworkSwitchingFailed', 'EVM network switching failed: feature not supported by the wallet.');
                        }
                    }
                }
                break;
            }
            default:
                throw new InternalError(`Unsupported action for ${blockchain} blockchain.`);
        }
    }
    async connectWallet(blockchain) {
        this._mintingState = undefined;
        switch (blockchain) {
            case 'Ethereum': {
                if (!this.evmProvider) {
                    throw new ConfigurationError('EVM provider not configured.');
                }
                let addresses;
                if (this.evmProvider.isWalletConnect()) {
                    addresses = await this.evmProvider.walletConnectEnable();
                }
                else {
                    addresses = await this.evmProvider.getAccounts();
                    if (!addresses.length) {
                        addresses = await this.evmProvider.requestAccounts();
                    }
                }
                if (!addresses.length) {
                    throw new StatusError('WalletNotConnected', 'Failed to get user accounts/permissions from EVM provider (browser extension)');
                }
                const blockchainNetwork = await this.ensureValidProviderNetwork(blockchain, true);
                this._chainAndAddress = {
                    blockchain: 'Ethereum',
                    blockchainNetwork: blockchainNetwork,
                    address: addresses[0],
                };
                break;
            }
            case 'Near':
                if (!this.near) {
                    throw new ConfigurationError('Near SDK not initialized.');
                }
                if (!this.near.wallet.isSignedIn()) {
                    await this.near.wallet.requestSignIn({ contractId: this.near.contractName });
                    return new Promise(() => {
                        return;
                    });
                }
                else {
                    const address = this.near.wallet.getAccountId();
                    this._chainAndAddress = {
                        blockchain: 'Near',
                        blockchainNetwork: this.near.blockchainNetwork,
                        address,
                    };
                }
                break;
            case 'Solana': {
                if (!this.solana) {
                    throw new ConfigurationError('Solana support is not enabled.');
                }
                this.solana.adapter = new PhantomWalletAdapter();
                await this.solana.connect();
                const address = this.solana.address;
                if (!address) {
                    throw new InternalError('Wallet address not found.');
                }
                const blockchainNetwork = this.solana.blockchainNetwork;
                this._chainAndAddress = {
                    blockchain: 'Solana',
                    blockchainNetwork,
                    address,
                };
                break;
            }
            default:
                throw new UnreachableCaseError(blockchain);
        }
        await this.refreshSession();
    }
    async disconnectWallet() {
        if (this._chainAndAddress) {
            switch (this._chainAndAddress.blockchain) {
                case 'Ethereum':
                    if (!this.evmProvider) {
                        throw new ConfigurationError('EVM provider not configured.');
                    }
                    if (this.evmProvider.isWalletConnect()) {
                        await this.evmProvider.walletConnectDisconnect();
                    }
                    else {
                        throw new InternalError(`Unsupported blockchain: ${this._chainAndAddress.blockchain}.`);
                    }
                    break;
                case 'Near':
                    if (this.near) {
                        this.near.wallet.signOut();
                    }
                    else {
                        throw new ConfigurationError('Near SDK not initialized.');
                    }
                    break;
                case 'Solana': {
                    if (this.solana) {
                        await this.solana.disconnect();
                    }
                    else {
                        throw new ConfigurationError('Solana support is not enabled.');
                    }
                    break;
                }
                default:
                    throw new UnreachableCaseError(this._chainAndAddress.blockchain);
            }
            this._chainAndAddress = undefined;
            this.user = undefined;
            this.session = undefined;
            this._mintingState = undefined;
        }
    }
    async registerOrLogin() {
        if (this._chainAndAddress) {
            this.session = await this.post('session', this._chainAndAddress);
            if (!this.session.user) {
                let signature;
                switch (this._chainAndAddress.blockchain) {
                    case 'Near': {
                        if (!this.near) {
                            throw new ConfigurationError('Near SDK not initialized.');
                        }
                        const toSign = `kycDAO-login-${this.session.nonce}`;
                        const key = await this.near.keyStore.getKey(this.near.wallet.account().connection.networkId, this.near.wallet.getAccountId());
                        signature = key.sign(Buffer.from(toSign, 'utf-8'));
                        break;
                    }
                    case 'Ethereum': {
                        if (!this.evmProvider) {
                            throw new ConfigurationError('EVM provider not configured.');
                        }
                        const toSign = this.session.eip_4361_message;
                        signature = await this.evmProvider.personalSign(toSign, this._chainAndAddress.address);
                        break;
                    }
                    case 'Solana': {
                        if (!this.solana) {
                            throw new ConfigurationError('Solana support is not enabled..');
                        }
                        const toSign = `kycDAO-login-${this.session.nonce}`;
                        signature = await this.solana.signMessage(toSign);
                        break;
                    }
                    default:
                        throw new UnreachableCaseError(this._chainAndAddress.blockchain);
                }
                const payload = typeof signature === 'string'
                    ? { signature }
                    : {
                        signature: `ed25519:${base_encode(signature.signature)}`,
                        public_key: signature.publicKey.toString(),
                    };
                const user = await this.post('user', payload);
                this.user = user;
                return;
            }
            this.user = this.session.user;
            return;
        }
        throw new StatusError('WalletNotConnected');
    }
    async updateEmail(email) {
        this.validateEmail(email);
        const userUpdateRequest = { email };
        const user = await this.put('user', userUpdateRequest);
        this.user = user;
    }
    async checkEmailConfirmed() {
        var _a, _b, _c;
        if (!((_a = this.user) === null || _a === void 0 ? void 0 : _a.email_confirmed)) {
            await this.refreshSession();
            if (!this.session) {
                throw new StatusError('UserNotLoggedIn');
            }
        }
        return {
            address: (_b = this.user) === null || _b === void 0 ? void 0 : _b.email,
            isConfirmed: !!((_c = this.user) === null || _c === void 0 ? void 0 : _c.email_confirmed),
        };
    }
    async resendEmailConfirmationCode() {
        return await this.post('user/email_confirmation');
    }
    loadPersona(user, personaOptions) {
        var _a;
        if (!((_a = this.apiStatus) === null || _a === void 0 ? void 0 : _a.persona)) {
            throw new InternalError('Persona configuration not found.');
        }
        const clientOptions = {
            environment: this.apiStatus.persona.sandbox ? 'sandbox' : 'production',
            templateId: this.apiStatus.persona.template_id,
        };
        const sessionData = this.verificationStatus.personaSessionData;
        const shouldContinue = sessionData && sessionData.referenceId === user.ext_id;
        const sessionOptions = shouldContinue
            ? {
                inquiryId: sessionData.inquiryId,
                sessionToken: sessionData.sessionToken,
                templateId: undefined,
            }
            : { referenceId: user.ext_id };
        const { frameAncestors, messageTargetOrigin, onCancel, onComplete, onError } = personaOptions || {};
        const iframeOptions = { frameAncestors, messageTargetOrigin };
        const inquiryOptions = Object.assign(Object.assign(Object.assign(Object.assign({}, clientOptions), sessionOptions), iframeOptions), { onReady: () => client.open(), onComplete: (_args) => {
                this.verificationStatus.personaSessionData = undefined;
                typeof onComplete === 'function' ? onComplete() : null;
            }, onCancel: (args) => {
                if (args.inquiryId) {
                    this.verificationStatus.personaSessionData = {
                        referenceId: user.ext_id,
                        inquiryId: args.inquiryId,
                        sessionToken: args.sessionToken,
                    };
                }
                else {
                    this.verificationStatus.personaSessionData = undefined;
                }
                typeof onCancel === 'function' ? onCancel() : null;
            }, onError: (error) => {
                this.verificationStatus.personaSessionData = undefined;
                const errorMessage = `Persona verification error: ${error.code}`;
                console.error(errorMessage);
                typeof onError === 'function' ? onError(errorMessage) : null;
            } });
        const client = new PersonaClient(inquiryOptions);
    }
    async startVerification(verificationData, providerOptions) {
        verificationData = this.validateVerificationData(verificationData);
        const userUpdateRequest = {
            email: verificationData.email,
            legal_entity: verificationData.isLegalEntity,
            residency: verificationData.taxResidency,
        };
        const user = await this.put('user', userUpdateRequest);
        this.user = user;
        const allowVerification = this.demoMode || !this.isVerifiedForType(verificationData.verificationType);
        if (allowVerification) {
            if (verificationData.verificationType === 'KYC') {
                this.loadPersona(user, providerOptions === null || providerOptions === void 0 ? void 0 : providerOptions.personaOptions);
            }
        }
        else {
            throw new StatusError('UserAlreadyVerified');
        }
    }
    async checkVerificationStatus() {
        const status = this.getVerificationStatusByType();
        const allVerified = !Object.values(status).some((value) => !value);
        if (!allVerified) {
            await this.refreshSession();
            if (!this.session) {
                throw new StatusError('UserNotLoggedIn');
            }
            return this.getVerificationStatusByType();
        }
        return status;
    }
    getNftImageUrl() {
        return this.url('token/identicon');
    }
    async regenerateNftImage() {
        await this.request('token/identicon', { method: 'POST' });
    }
    async getNftImageOptions() {
        await this.refreshSession();
        if (!this.user) {
            throw new StatusError('UserNotLoggedIn');
        }
        return Object.fromEntries(Object.entries(this.user.available_images).map(([imageId, tokenImage]) => [
            imageId,
            tokenImage.url,
        ]));
    }
    async regenerateNftImageOptions() {
        await this.request('token/identicon', { method: 'POST' });
        return await this.getNftImageOptions();
    }
    async authorizeMinting(chainAndAddress, mintingData) {
        const network = chainAndAddress.blockchainNetwork;
        const subscriptionDuration = mintingData.subscriptionYears
            ? `P${mintingData.subscriptionYears}Y`
            : undefined;
        const blockchainAccount = this.getBlockchainAccount(chainAndAddress);
        const data = {
            blockchain_account_id: blockchainAccount.id,
            network,
            selected_image_id: mintingData.imageId,
            subscription_duration: subscriptionDuration,
        };
        try {
            const res = await this.post('authorize_minting', data);
            const txHash = res.token.authorization_tx_id;
            if (!txHash) {
                if (!res.transaction) {
                    throw new InternalError('Transaction ID not found');
                }
            }
            else {
                const transaction = await this.waitForTransaction(chainAndAddress, txHash);
                if (transaction.status === 'Failure') {
                    throw new TransactionError('TransactionFailed');
                }
            }
            return res;
        }
        catch (error) {
            if (error instanceof KycDaoApiError && error.errorCode === 'NetworkPriceTooHigh') {
                throw new StatusError('NetworkPriceTooHigh');
            }
            else {
                throw error;
            }
        }
    }
    async mint(chainAndAddress, mintAuthResponse, verificationType) {
        var _a;
        const contractAddress = this.getSmartContractAddress(chainAndAddress.blockchainNetwork, verificationType);
        const authorizationCode = mintAuthResponse.token.authorization_code;
        const tokenMetadataUrl = mintAuthResponse.metadata_url;
        let txHash;
        let tokenId;
        switch (chainAndAddress.blockchain) {
            case 'Near': {
                if (!this.near) {
                    throw new ConfigurationError('Near SDK not initialized.');
                }
                const contract = new Contract(this.near.wallet.account(), this.near.contractName, {
                    viewMethods: ['get_required_mint_cost_for_code'],
                    changeMethods: ['mint_with_code'],
                });
                const getRequiredCostFn = contract.get_required_mint_cost_for_code;
                if (!getRequiredCostFn) {
                    throw new InternalError('Mint cost function not callable');
                }
                const storageCost = new BN('100000000000000000000000');
                const result = await getRequiredCostFn({
                    auth_code: Number(authorizationCode),
                    dst: chainAndAddress.address,
                });
                const costWithSlippage = new BN(result).muln(1.1).add(storageCost);
                const connectorSign = window.location.search.startsWith('?') ? '&' : '?';
                const data = `${connectorSign}authCode=${authorizationCode}`;
                const callbackUrl = `${window.location.origin}${window.location.pathname}${window.location.search}${data}${window.location.hash}`;
                const mintFn = contract.mint_with_code;
                if (!mintFn) {
                    throw new InternalError('Mint function not callable');
                }
                await mintFn({
                    args: { auth_code: Number(authorizationCode) },
                    gas: '300000000000000',
                    amount: costWithSlippage.toString(),
                    callbackUrl,
                });
                return new Promise(() => {
                    return;
                });
            }
            case 'Ethereum': {
                if (!this.evmProvider) {
                    throw new ConfigurationError('EVM provider not configured.');
                }
                if (!contractAddress) {
                    throw new InternalError('Smart contract address not found');
                }
                txHash = await this.evmProvider.mint(contractAddress, chainAndAddress.address, authorizationCode);
                if (txHash) {
                    const transaction = await this.waitForTransaction(chainAndAddress, txHash);
                    if (transaction.status === 'Failure') {
                        throw new TransactionError('TransactionFailed');
                    }
                    const receipt = transaction.data;
                    tokenId = await this.evmProvider.getTokenIdFromReceipt(receipt);
                }
                else {
                }
                break;
            }
            case 'Solana': {
                if (!this.solana) {
                    throw new ConfigurationError('Solana support is not enabled.');
                }
                if (!contractAddress) {
                    throw new InternalError('Smart contract address not found');
                }
                if (!tokenMetadataUrl) {
                    throw new InternalError('Token metadata not found');
                }
                const tokenMetadataResponse = await fetch(tokenMetadataUrl);
                const isJson = (_a = tokenMetadataResponse.headers
                    .get('content-type')) === null || _a === void 0 ? void 0 : _a.includes('application/json');
                const tokenMetadata = isJson ? await tokenMetadataResponse.json() : null;
                if (!tokenMetadataResponse.ok ||
                    !isLike(tokenMetadata) ||
                    typeof tokenMetadata.name !== 'string' ||
                    typeof tokenMetadata.description !== 'string' ||
                    typeof tokenMetadata.image !== 'string') {
                    throw new InternalError('Token metadata is invalid');
                }
                if (mintAuthResponse.transaction) {
                    const mintTransaction = SolanaTransaction.from(Buffer.from(mintAuthResponse.transaction, 'hex'));
                    txHash = await this.solana.mint(chainAndAddress.address, mintTransaction);
                    const transaction = await this.waitForTransaction(chainAndAddress, txHash);
                    if (transaction.status === 'Failure') {
                        throw new TransactionError('TransactionFailed');
                    }
                    tokenId = transaction.data;
                }
                else {
                    throw new InternalError('Backend transaction not found');
                }
                break;
            }
            default:
                throw new UnreachableCaseError(chainAndAddress.blockchain);
        }
        if (txHash && tokenId) {
            const tokenDetails = await this.post('token', {
                authorization_code: authorizationCode,
                token_id: tokenId,
                minting_tx_id: txHash,
            });
            const networkDetails = this.getNetworkDetails(chainAndAddress.blockchainNetwork);
            return getMintingResult(networkDetails, txHash, tokenId, tokenDetails);
        }
        return;
    }
    async startMinting(mintingData) {
        var _a;
        let verificationType = mintingData.verificationType;
        if (!this._chainAndAddress) {
            throw new StatusError('WalletNotConnected');
        }
        if (!mintingData.disclaimerAccepted) {
            throw new StatusError('DisclaimerNotAccepted');
        }
        const chainAndAddress = Object.assign({}, this._chainAndAddress);
        chainAndAddress.blockchainNetwork = await this.ensureValidProviderNetwork(chainAndAddress.blockchain, true);
        await this.refreshSession();
        if (!verificationType) {
            verificationType = 'KYC';
        }
        if (!this.isVerifiedForType(verificationType)) {
            throw new StatusError('UserNotVerified');
        }
        if (!((_a = this.user) === null || _a === void 0 ? void 0 : _a.disclaimer_accepted)) {
            await this.post('disclaimer', { accept: true });
        }
        const getReusableMintAuthResponse = () => {
            if (!this._mintingState) {
                return;
            }
            const mintingState = Object.assign({}, this._mintingState);
            const isSameWallet = isEqual(mintingState.chainAndAddress, chainAndAddress);
            if (!isSameWallet) {
                this._mintingState = undefined;
                return;
            }
            if (isEqual(mintingState.mintingData, mintingData)) {
                return mintingState.mintAuthResponse;
            }
            else {
                return;
            }
        };
        let mintAuthResponse = getReusableMintAuthResponse();
        if (!mintAuthResponse) {
            mintAuthResponse = await this.authorizeMinting(chainAndAddress, mintingData);
            this._mintingState = {
                chainAndAddress,
                mintingData,
                mintAuthResponse,
            };
        }
        const mintingResult = await this.mint(chainAndAddress, mintAuthResponse, verificationType);
        this._mintingState = undefined;
        return mintingResult;
    }
}
__decorate([
    Catch(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], KycDao.prototype, "getServerStatus", null);
__decorate([
    Catch(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], KycDao.prototype, "hasValidNft", null);
__decorate([
    Catch(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], KycDao.prototype, "getValidNfts", null);
__decorate([
    Catch(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], KycDao.prototype, "checkVerifiedNetworks", null);
__decorate([
    Catch(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], KycDao.prototype, "switchOrAddNetworkChecked", null);
__decorate([
    Catch(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], KycDao.prototype, "checkProviderNetwork", null);
__decorate([
    Catch(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], KycDao.prototype, "switchProviderNetwork", null);
__decorate([
    Catch(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], KycDao.prototype, "connectWallet", null);
__decorate([
    Catch(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], KycDao.prototype, "disconnectWallet", null);
__decorate([
    Catch(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], KycDao.prototype, "registerOrLogin", null);
__decorate([
    Catch(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], KycDao.prototype, "updateEmail", null);
__decorate([
    Catch(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], KycDao.prototype, "checkEmailConfirmed", null);
__decorate([
    Catch(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], KycDao.prototype, "resendEmailConfirmationCode", null);
__decorate([
    Catch(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], KycDao.prototype, "startVerification", null);
__decorate([
    Catch(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], KycDao.prototype, "checkVerificationStatus", null);
__decorate([
    Catch(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", String)
], KycDao.prototype, "getNftImageUrl", null);
__decorate([
    Catch(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], KycDao.prototype, "regenerateNftImage", null);
__decorate([
    Catch(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], KycDao.prototype, "getNftImageOptions", null);
__decorate([
    Catch(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], KycDao.prototype, "regenerateNftImageOptions", null);
__decorate([
    Catch(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], KycDao.prototype, "startMinting", null);
__decorate([
    Catch(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], KycDao, "initialize", null);
//# sourceMappingURL=index.js.map