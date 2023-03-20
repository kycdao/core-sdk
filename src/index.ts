import { ConnectConfig, Contract, keyStores, Near, WalletConnection } from 'near-api-js';
import { Signature } from 'near-api-js/lib/utils/key_pair';
import { base_encode } from 'near-api-js/lib/utils/serialize';
import { Client as PersonaClient, ClientOptions } from 'persona';
import { InquiryOptions } from 'persona/dist/lib/interfaces';
import { ApiBase, KycDaoApiError } from './api-base';
import { BN } from 'bn.js';
import {
  BlockchainNetworks,
  EvmBlockchainNetworks,
  NEAR_MAINNET_ARCHIVAL,
  NEAR_MAINNET_CONFIG,
  NEAR_TESTNET_ARCHIVAL,
  NEAR_TESTNET_CONFIG,
  VerificationTypes,
} from './constants';
import {
  ApiStatus,
  Blockchain,
  BlockchainAccountDetails,
  BlockchainNetwork,
  ChainAndAddress,
  Country,
  EmailData,
  KycDaoContract,
  MintingAuthorizationRequest,
  MintingAuthorizationResponse,
  MintingData,
  MintingResult,
  MintingState,
  NearBlockchainNetwork,
  NearSdk,
  NetworkAndAddress,
  NetworkMetadata,
  NftCheckOptions,
  NftCheckResponse,
  PersonaOptions,
  RedirectEvent,
  RedirectResult,
  SdkConfiguration,
  SdkStatus,
  ServerStatus,
  Session,
  SolanaBlockchainNetwork,
  TokenDetails,
  TokenMetadata,
  Transaction,
  UserDetails,
  UserUpdateRequest,
  VerificationData,
  VerificationProviderOptions,
  VerificationStasusByType,
  VerificationStatus,
  VerificationType,
} from './types';
import { default as COUNTRIES } from './countries.list.json';
import { FinalExecutionOutcome, JsonRpcProvider } from 'near-api-js/lib/providers';
import {
  getMintingResult,
  isFulfilled,
  isLike,
  isEqual,
  partition,
  poll,
  typedKeys,
} from './utils';
import { EvmProviderWrapper } from './blockchains/evm/evm-provider-wrapper';
import { EvmProvider, EvmTransactionReceipt } from './blockchains/evm/types';
import { KycDaoJsonRpcProvider } from './blockchains/kycdao-json-rpc-provider';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { SolanaProviderWrapper } from './blockchains/solana/solana-provider-wrapper';
import { Transaction as SolanaTransaction } from '@solana/web3.js';
import {
  Catch,
  ConfigurationError,
  InternalError,
  SentryWrapper,
  StatusError,
  TransactionError,
  UnreachableCaseError,
  WalletError,
} from './errors';

export { ApiBase, KycDaoApiError } from './api-base';
export {
  Blockchains,
  BlockchainNetworks,
  EvmBlockchainNetworks,
  NearBlockchainNetworks,
  KycDaoEnvironments,
  SolanaBlockchainNetworks,
  VerificationTypes,
} from './constants';
export { ConnectConfig as NearConnectConfig } from 'near-api-js';
export {
  Blockchain,
  BlockchainNetwork,
  BlockchainNetworkConfiguration,
  ChainAndAddress,
  Country,
  EmailData,
  EvmBlockchainNetwork,
  MintingData,
  MintingResult,
  NearBlockchainNetwork,
  NetworkAndAddress,
  NftCheckOptions,
  NftCheckResponse,
  PersonaOptions,
  SdkConfiguration,
  SdkStatus,
  SentryConfiguration,
  ServerStatus,
  SolanaBlockchainNetwork,
  TokenMetadata,
  VerificationData,
  VerificationProvider,
  VerificationProviderOptions,
  VerificationStasusByType,
  VerificationType,
  RedirectEvent,
} from './types';
export {
  KycDaoSDKError,
  ConfigurationError,
  StatusError,
  WalletError,
  TransactionError,
  InternalError,
  UnknownError,
  ErrorCode,
  WalletErrorCode,
  StatusErrorCode,
  TransactionErrorCode,
  StatusErrors,
  WalletErrors,
  TransactionErrors,
} from './errors';

/**
 * The result of the SDK initialization process.
 *
 * @interface KycDaoInitializationResult
 * @typedef {KycDaoInitializationResult}
 */
export interface KycDaoInitializationResult {
  /**
   * The instance of the initialized {@link KycDao} class.
   *
   * @type {KycDao}
   */
  kycDao: KycDao;
  /**
   * The type of {@link RedirectEvent} that was detected and handled during the initialization, if there was one.
   *
   * @type {?RedirectEvent}
   */
  redirectEvent?: RedirectEvent;
  /**
   * The current status of the SDK.
   *
   * @type {SdkStatus}
   */
  sdkStatus: SdkStatus;
  /**
   * @deprecated since version 0.5.0, see {@link mintingResult}
   *
   * Chain explorer URL of the transaction related to the handled {@link redirectEvent}, if there is any.
   *
   * @type {?string}
   */
  transactionUrl?: string;
  /**
   * Data related to a successful mint transaction and the minted token, if the handled {@link redirectEvent} was a mint even.
   *
   * @type {MintingResult}
   */
  mintingResult?: MintingResult;
}

/**
 * The list of countries recognized by the SDK with their respective ISO codes.
 *
 * @type {Country[]}
 */
export const Countries: Country[] = Array.from(COUNTRIES);

/**
 * This class provides the connection to a kycDAO server,
 * initiates flows with third party providers (for wallet connection, verification, etc.)
 * and handles responses and redirects from them.
 *
 * @class KycDao
 * @typedef {KycDao}
 * @extends {ApiBase}
 */
export class KycDao extends ApiBase {
  private demoMode: boolean;
  private verificationTypes: VerificationType[];
  private blockchainNetworks: BlockchainNetwork[];

  private networkDetails: Partial<Record<BlockchainNetwork, NetworkMetadata>> = {};

  private getNetworkDetails(network: BlockchainNetwork): NetworkMetadata {
    const details = this.networkDetails[network];

    if (!details) {
      throw new InternalError(`Network details not found for ${network}`);
    }

    return details;
  }

  private apiStatus?: ApiStatus;

  private near?: NearSdk;
  private evmProvider?: EvmProviderWrapper;
  private solana?: SolanaProviderWrapper;

  private _chainAndAddress?: ChainAndAddress;

  private _mintingState?: MintingState;

  /**
   * Returns the current status of the SDK.
   *
   * @readonly
   * @type {SdkStatus}
   */
  get sdkStatus(): SdkStatus {
    return {
      baseUrl: this.baseUrl,
      demoMode: this.demoMode,
      availableBlockchainNetworks: this.blockchainNetworks,
      availableVerificationTypes: this.verificationTypes,
      evmProviderConfigured: !!this.evmProvider,
      nearNetworkConnected: this.near?.blockchainNetwork || null,
      solanaNetworkConnected: this.solana?.blockchainNetwork || null,
    };
  }

  /**
   * Returns the connected wallet if there is any.
   *
   * @readonly
   * @type {(ChainAndAddress | undefined)}
   */
  get connectedWallet(): ChainAndAddress | undefined {
    return this._chainAndAddress;
  }

  /**
   * Returns if there is a wallet currently connected.
   *
   * @readonly
   * @type {boolean}
   */
  get walletConnected(): boolean {
    return !!this._chainAndAddress;
  }

  private session?: Session;
  private user?: UserDetails;

  /**
   * Returns if there is a user currently logged in.
   *
   * @readonly
   * @type {boolean}
   */
  get loggedIn(): boolean {
    return !!this.user;
  }

  /**
   * Returns if the current user has a kycDAO subscription. Requires a logged in user.
   *
   * @readonly
   * @type {boolean}
   */
  get subscribed(): boolean {
    if (!this.user) {
      throw new StatusError('UserNotLoggedIn');
    }

    return !!this.user.subscription_expiry;
  }

  private verificationStatus: VerificationStatus;

  private isVerifiedForType(verificationType: VerificationType): boolean {
    return (
      this.user?.verification_requests.some(
        (req) => req.verification_type === verificationType && req.status === 'Verified',
      ) || false
    );
  }

  private getVerificationStatusByType(): VerificationStasusByType {
    const status: VerificationStasusByType = {};
    const allVerificationTypes = Object.values(VerificationTypes);
    for (const verificationType of allVerificationTypes) {
      status[verificationType] = this.isVerifiedForType(verificationType);
    }
    return status;
  }

  private getSmartContractAddress(
    blockchainNetwork: BlockchainNetwork,
    verificationType: VerificationType,
  ): string | undefined {
    return this.apiStatus?.smart_contracts_info[blockchainNetwork]?.[verificationType]?.address;
  }

  private getBlockchainAccount(chainAndAddress: ChainAndAddress): BlockchainAccountDetails {
    const accounts = this.user?.blockchain_accounts;

    if (!accounts?.length) {
      throw new InternalError('User has no blockchain accounts.');
    }

    const address =
      chainAndAddress.blockchain === 'Ethereum'
        ? chainAndAddress.address.toLowerCase()
        : chainAndAddress.address;

    const accountsFound = accounts.filter((acc) => acc.address === address);

    if (accountsFound.length > 1) {
      throw new InternalError('Multiple blockchain accounts found for the same wallet address.');
    }

    if (!accountsFound.length) {
      throw new InternalError('Wallet address is not registered to the current user.');
    }

    return accountsFound[0];
  }

  // unused for now, we may need it later
  private getValidAuthorizationCode(): string | undefined {
    if (this._chainAndAddress && this.user) {
      try {
        const account = this.getBlockchainAccount(this._chainAndAddress);

        return account.tokens.find((token) => {
          return token.authorization_tx_id && !token.minted_at;
        })?.authorization_code;
      } catch {
        return undefined;
      }
    }

    return undefined;
  }

  private async getTx(chainAndAddress: ChainAndAddress, txHash: string): Promise<Transaction> {
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
          } else {
            return {
              status: outcome.status,
              data: outcome,
            };
          }
        } catch (e) {
          // This should be a NEAR TypedError with a name and a cause but the only fix/working thing I found is the message at the moment so not rethrowing the error.
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
        } else {
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

  private async waitForTransaction(
    chainAndAddress: ChainAndAddress,
    txHash: string,
  ): Promise<Transaction> {
    try {
      // poll every 5 seconds for 3 minutes
      return await poll(() => this.getTx(chainAndAddress, txHash), 5000, 12 * 3, {
        resolvePredicate: (r) => {
          return r.status === 'Success' || r.status === 'Failure';
        },
        retryOnErrorPredicate: (e) => {
          if (e instanceof Error) {
            const txDoesNotExistPred = e.message.includes(`Transaction ${txHash} doesn't exist`);
            return txDoesNotExistPred;
          } else {
            return false;
          }
        },
        useExponentialBackoff: false,
      });
    } catch (e) {
      if (e instanceof Error && e.message === 'TIMEOUT') {
        throw new TransactionError('TransactionNotFound');
      } else {
        throw e;
      }
    }
  }

  private validateBlockchainNetworks(
    availableBlockchainNetworks: BlockchainNetwork[],
    enabledBlockchainNetworks: BlockchainNetwork[],
  ): BlockchainNetwork[] {
    const errorPrefix = 'kycDAO SDK';
    const allBlockchainNetworks = Object.values(BlockchainNetworks);

    const [validBlockchainNetworks, invalidBlockchainNetworks] = partition(
      [...new Set(enabledBlockchainNetworks)],
      (network) => allBlockchainNetworks.includes(network),
    );

    if (invalidBlockchainNetworks.length > 0) {
      console.warn(
        `Invalid network name(s) were found in configuration and will be ignored: ${invalidBlockchainNetworks.join(
          ', ',
        )}. Valid values are: ${allBlockchainNetworks.join(', ')}.`,
      );
    }

    if (!validBlockchainNetworks.length) {
      throw new ConfigurationError(
        `No valid network names were found in configuration. Valid values are: ${allBlockchainNetworks.join(
          ', ',
        )}.`,
      );
    }

    const [finalBlockchainNetworks, unavailableBlockchainNetworks] = partition(
      validBlockchainNetworks,
      (network) => availableBlockchainNetworks.includes(network),
    );

    if (unavailableBlockchainNetworks.length > 0) {
      console.warn(
        `${errorPrefix} - The following configured networks are unavailable on the connected server: ${unavailableBlockchainNetworks.join(
          ', ',
        )}. Avaliable networks are: ${availableBlockchainNetworks.join(', ')}.`,
      );
    }

    const ensureSingleChain = (): boolean => {
      let currentChain: Blockchain | undefined;

      for (const network of finalBlockchainNetworks) {
        const chain = this.getNetworkDetails(network).blockchain;

        if (!currentChain) {
          currentChain = chain;
        } else {
          if (chain !== currentChain) {
            return false;
          }
        }
      }

      return true;
    };

    if (!ensureSingleChain()) {
      throw new ConfigurationError(
        'Only networks of a single chain type/protocol can be enabled at a time.',
      );
    }

    if (!finalBlockchainNetworks.length) {
      throw new ConfigurationError(
        `No available networks were found in configuration. Available networks are: ${availableBlockchainNetworks.join(
          ', ',
        )}.`,
      );
    }

    const multipleNearNetworks =
      finalBlockchainNetworks.filter((network) => network.startsWith('Near')).length > 1;
    // This will probably never happen since the server will only have one enabled
    if (multipleNearNetworks) {
      throw new ConfigurationError('Only one Near network can be configured at a time.');
    }

    const multipleSolanaNetworks =
      finalBlockchainNetworks.filter((network) => network.startsWith('Solana')).length > 1;
    // This will probably never happen since the server will only have one enabled
    if (multipleSolanaNetworks) {
      throw new ConfigurationError('Only one Solana network can be configured at a time.');
    }

    return finalBlockchainNetworks;
  }

  private static validateVerificationTypes(
    verificationTypes: VerificationType[],
  ): VerificationType[] {
    const errorPrefix = 'kycDAO SDK';
    const allVerificationTypes = Object.values(VerificationTypes);
    const [validVerificationTypes, invalidVerificationTypes] = partition(
      [...new Set(verificationTypes)],
      (verificationType) => allVerificationTypes.includes(verificationType),
    );

    if (invalidVerificationTypes.length > 0) {
      console.warn(
        `${errorPrefix} - Invalid verification type(s) were found in configuration and will be ignored: ${invalidVerificationTypes.join(
          ', ',
        )}. Valid values are: ${allVerificationTypes.join(', ')}.`,
      );
    }

    if (!validVerificationTypes.length) {
      throw new ConfigurationError(
        `No valid verification types were found in configuration. Valid values are: ${allVerificationTypes.join(
          ', ',
        )}.`,
      );
    }

    return validVerificationTypes;
  }

  private static validateEvmProvider(
    blockchainNetworks: BlockchainNetwork[],
    evmProvider?: unknown,
  ): EvmProvider | undefined {
    const evmBlockchainNetworks = Object.values(EvmBlockchainNetworks);
    const hasEvmNetworkEnabled = evmBlockchainNetworks.some((network) =>
      blockchainNetworks.includes(network),
    );

    if (hasEvmNetworkEnabled) {
      if (evmProvider === undefined) {
        console.warn(
          'EVM provider is missing from the SDK configuration while at least one EVM network has been enabled',
        );

        return;
      }

      if (
        isLike<EvmProvider>(evmProvider) &&
        typeof evmProvider.request === 'function' &&
        typeof evmProvider.on === 'function'
      ) {
        return evmProvider as EvmProvider;
      }

      throw new ConfigurationError(
        'The configured EVM provider is not compliant with the required standards.',
      );
    }

    return;
  }

  private validateEmail(email: string): void {
    // email format validation
    const emailRegExp = new RegExp('^[^@]+@[a-z0-9-]+.[a-z]+$');
    if (!email.match(emailRegExp)) {
      throw new StatusError('InvalidEmailAddress');
    }
  }

  private validateVerificationData(verificationData: VerificationData): VerificationData {
    if (!verificationData.termsAccepted) {
      throw new StatusError('TermsAndConditionsNotAccepted');
    }

    const allVerificationTypes = Object.values(VerificationTypes);

    // verification type validation
    const verificationType = verificationData.verificationType;
    if (!allVerificationTypes.includes(verificationType)) {
      throw new ConfigurationError(
        `Invalid verificationType. Valid values are: ${allVerificationTypes.join(', ')}.`,
      );
    }

    if (!this.verificationTypes.includes(verificationType)) {
      throw new ConfigurationError(
        `Invalid verificationType. "${verificationType}" was not enabled during SDK initialization.`,
      );
    }

    this.validateEmail(verificationData.email);

    // tax residency validation
    const taxResidency = verificationData.taxResidency;
    const country = Countries.find(
      (country) =>
        country.iso_cca2.toUpperCase() === taxResidency.toUpperCase() ||
        country.name.toLowerCase() === taxResidency.toLowerCase(),
    );
    if (country) {
      const isNameMatch = country.name.toLowerCase() === taxResidency.toLowerCase();
      if (isNameMatch) {
        verificationData.taxResidency = country.iso_cca2;
      }
    } else {
      throw new StatusError('InvalidTaxResidency');
    }

    return verificationData;
  }

  // check the current session and user against the initialized chain + address
  // clear the session/user if they don't match the chain + address
  private syncUserAndSessionWithWallet(): void {
    if (this.user) {
      const isSameUser = this.user.blockchain_accounts.some(
        (account) =>
          account.blockchain === this._chainAndAddress?.blockchain &&
          account.address === this._chainAndAddress.address,
      );

      if (!isSameUser) {
        this.user = undefined;
        this.session = undefined;
      }
    } else if (this.session) {
      const isSameWallet = isEqual(this.session.chain_and_address, this._chainAndAddress);
      if (!isSameWallet) {
        this.session = undefined;
      }
    }
  }

  private async refreshSession(): Promise<Session | undefined> {
    const createSession = async (chainAndAddress: ChainAndAddress): Promise<void> => {
      const session = await this.post<Session>('session', chainAndAddress);
      this.session = session;
      this.user = session.user;
    };

    try {
      // try refreshing the session (using the stored session cookie for authentication)
      const session = await this.get<Session>('session');
      this.session = session;
      this.user = session.user;

      // check if the refreshed session/user matches the initialized wallet
      // if not try creating a new session for the wallet
      this.syncUserAndSessionWithWallet();
      if (!this.session && this._chainAndAddress) {
        await createSession(this._chainAndAddress);
      }

      return this.session;
    } catch (e) {
      // there were eithere no session cookie saved or it has expired
      if (e instanceof KycDaoApiError && e.statusCode === 401) {
        // if there is an initialized chain + address, try creating a new session
        if (this._chainAndAddress) {
          await createSession(this._chainAndAddress);
        }

        // if there is no valid cookie and no chain + address specified, there is no session/user we can speak of
        this.session = undefined;
        this.user = undefined;
        return this.session;
      }

      console.error(`Unexpected error during kycDAO session refresh: ${e}`);
      throw e;
    }
  }

  private initNear(blockchainNetwork: NearBlockchainNetwork): void {
    if (!blockchainNetwork.startsWith('Near')) {
      throw new InternalError(`Not a  Near network: ${blockchainNetwork}`);
    }

    // TODO remove this step and saving contract address to this.near when we want NEAR support for other verification types
    // this will also require a way for us to detect the verification type after a redirect (probably adding it to the callback URL)
    const contractName = this.getSmartContractAddress(blockchainNetwork, 'KYC');

    if (!contractName) {
      throw new InternalError('Smart contract name configuration missing.');
    }

    let config: ConnectConfig = NEAR_TESTNET_CONFIG;
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

  private async handleNearWalletCallback(
    event: RedirectEvent,
    queryParams: URLSearchParams,
    detectedValue: string,
  ): Promise<MintingResult | undefined> {
    if (!this.near) {
      throw new InternalError('Near callback detected but the Near SDK is  not initialized.');
    }

    if (this.near.wallet.isSignedIn()) {
      const address: string = this.near.wallet.getAccountId();
      this._chainAndAddress = {
        blockchain: 'Near',
        blockchainNetwork: this.near.blockchainNetwork,
        address,
      };

      await this.refreshSession();

      let mintingResult: MintingResult | undefined;

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

            const outcome = transaction.data as FinalExecutionOutcome;
            if (typeof outcome.status === 'string' || !outcome.status.SuccessValue) {
              throw new InternalError(
                'NearMint callback detected but transaction outcome does not have a SuccessValue (token ID).',
              );
            } else {
              const successValue = outcome.status.SuccessValue;

              const tokenId: string = JSON.parse(
                Buffer.from(successValue, 'base64').toString(),
              ).token_id;

              const tokenDetails = await this.post<TokenDetails>('token', {
                authorization_code: authCode,
                token_id: tokenId,
                minting_tx_id: detectedValue,
              });

              const networkDetails = this.getNetworkDetails(chainAndAddress.blockchainNetwork);

              mintingResult = getMintingResult(
                networkDetails,
                detectedValue,
                tokenId,
                tokenDetails,
              );
            }
          } else {
            throw new InternalError(
              'authCode parameter is empty or missing from NearMint callback URL.',
            );
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

  private async handleRedirect(): Promise<RedirectResult | undefined> {
    const errorPrefix = 'Wallet callback handling error';

    const knownQueryParams: Record<string, RedirectEvent> = {
      account_id: 'NearLogin',
      errorCode: 'NearUserRejectedError',
      transactionHashes: 'NearMint',
    };
    const knownQueryParamNames = Object.keys(knownQueryParams);

    const queryParams = new URLSearchParams(window.location.search);
    const queryParamsArray = [...queryParams];
    const matches = queryParamsArray.filter(([key, _]) => knownQueryParamNames.includes(key));

    // delete query parameters handled by this method (and other NEAR related ones) from the URL
    const url = new URL(window.location.href);
    knownQueryParamNames
      .concat(['authCode', 'errorMessage'])
      .forEach((param) => url.searchParams.delete(param));
    window.history.replaceState({}, document.title, url);

    if (matches.length > 1) {
      console.error(
        `${errorPrefix} - Multiple URL query parameters identified: ${matches.map(
          ([key, _]) => key,
        )}.`,
      );
      return;
    }

    if (matches.length === 1) {
      const match = matches[0];
      const key = match[0];
      const value = match[1];
      const event = knownQueryParams[key];

      let mintingResult: MintingResult | undefined;

      if (event.startsWith('Near')) {
        mintingResult = await this.handleNearWalletCallback(event, queryParams, value);
      }

      return { event, mintingResult };
    }

    return;
  }

  private constructor(config: SdkConfiguration) {
    if (config.environment) {
      console.warn(
        'The environment parameter in the kycDAO SDK configuration is deprecated, please use the demoMode switch instead!',
      );
    }

    config.enabledVerificationTypes = KycDao.validateVerificationTypes(
      config.enabledVerificationTypes,
    );

    super(config);

    this.demoMode = !!config.demoMode;
    this.verificationTypes = config.enabledVerificationTypes;
    this.blockchainNetworks = [];

    this.verificationStatus = {
      personaSessionData: undefined,
    };
  }

  /**
   * Connect to a kycDAO server and initialize the SDK using the provided configuration.
   *
   * @public
   * @static
   * @async
   * @param {SdkConfiguration} config
   * @returns {Promise<KycDaoInitializationResult>}
   */
  @Catch()
  public static async initialize(config: SdkConfiguration): Promise<KycDaoInitializationResult> {
    const kycDao = new KycDao(config);

    if (config.sentryConfiguration) {
      const sentry = new SentryWrapper(config.sentryConfiguration);
      void sentry.lazyLoad(); // don't wait for it to load, if it's configured properly and the CDN is available it should be quick
    }

    // TODO handle and return specific error
    kycDao.apiStatus = await kycDao.get<ApiStatus>('status');

    // query the network metadata/details from the server
    const networks = await kycDao.get<NetworkMetadata[]>('networks');

    // create a record from the list returned by the server and save it
    networks.forEach((network) => {
      kycDao.networkDetails[network.id] = network;
    });

    // update network details with values from the incoming config
    const networkConf = config.blockchainNetworkConfiguration;
    if (networkConf) {
      let network: BlockchainNetwork;
      for (network in networkConf) {
        const details = kycDao.getNetworkDetails(network);
        const config = networkConf[network];
        const rpcUrls = config?.rpcUrl ? [config.rpcUrl] : details.rpc_urls;

        kycDao.networkDetails[network] = {
          ...details,
          rpc_urls: rpcUrls,
        };
      }
    }

    kycDao.blockchainNetworks = kycDao.validateBlockchainNetworks(
      kycDao.apiStatus.enabled_networks,
      config.enabledBlockchainNetworks,
    );

    const evmProvider = KycDao.validateEvmProvider(kycDao.blockchainNetworks, config.evmProvider);

    // remove EVM networks from the available list if no evmProvider is set in the congfig
    if (!evmProvider) {
      kycDao.blockchainNetworks = kycDao.blockchainNetworks.filter(
        (network) => !Object.keys(EvmBlockchainNetworks).includes(network),
      );
    } else {
      evmProvider.on('chainChanged', (chainId: number) => {
        const networkDetails = kycDao.networkDetails;
        const blockchainNetwork = typedKeys(networkDetails).find(
          (network) => kycDao.getNetworkDetails(network).chain_id === chainId,
        );
        const isSupportedAndEnabled =
          blockchainNetwork && kycDao.blockchainNetworks.includes(blockchainNetwork);

        if (
          kycDao._chainAndAddress &&
          kycDao._chainAndAddress.blockchain === 'Ethereum' &&
          isSupportedAndEnabled
        ) {
          kycDao._chainAndAddress.blockchainNetwork = blockchainNetwork;
        }
      });

      kycDao.evmProvider = new EvmProviderWrapper(evmProvider);
    }

    // initialize NEAR if there is an available NEAR network
    const nearNetwork = kycDao.blockchainNetworks.find((network) =>
      network.startsWith('Near'),
    ) as NearBlockchainNetwork;
    if (nearNetwork) {
      kycDao.initNear(nearNetwork);
    }

    // initialize Solana if there is an available Solana network
    const solanaNetwork = kycDao.blockchainNetworks.find((network) =>
      network.startsWith('Solana'),
    ) as SolanaBlockchainNetwork;
    if (solanaNetwork) {
      kycDao.solana = new SolanaProviderWrapper(solanaNetwork);
    }

    const redirectResult = await kycDao.handleRedirect();

    return {
      kycDao,
      redirectEvent: redirectResult?.event,
      transactionUrl: redirectResult?.mintingResult?.transactionUrl, // deprecated
      mintingResult: redirectResult?.mintingResult,
      sdkStatus: kycDao.sdkStatus,
    };
  }

  /**
   * A test method to check configuration and kycDAO server access.
   *
   * @public
   * @async
   * @returns {Promise<ServerStatus>}
   */
  @Catch()
  public async getServerStatus(): Promise<ServerStatus> {
    let apiStatus: string;
    let isOk: boolean;

    try {
      const status = await this.get<ApiStatus>('status');
      isOk = true;
      apiStatus = `${status.current_time}`;
    } catch (e) {
      isOk = false;
      if (e instanceof Error) {
        apiStatus = e.message;
      } else {
        apiStatus = `Error: ${e}`;
      }
    }

    return {
      serverBaseUrl: this.baseUrl,
      apiStatus,
      isOk,
    };
  }

  private getChainAndAddressForNftCheck(options?: NftCheckOptions): ChainAndAddress {
    const networkAndAddress = options?.networkAndAddress;
    const chainAndAddress = networkAndAddress
      ? {
          ...networkAndAddress,
          blockchain: this.getNetworkDetails(networkAndAddress.blockchainNetwork).blockchain,
        }
      : this._chainAndAddress;

    if (!chainAndAddress) {
      throw new StatusError(
        'WalletNotConnected',
        'BlockchainNetwork and address not set yet. Either connect a wallet with kycDAO first or specify them in the parameters.',
      );
    }

    const address = chainAndAddress.address;

    if (!address) {
      throw new InternalError('Wallet address cannot be empty.');
    }

    return chainAndAddress;
  }

  private getRpcProviderForWallet(
    verificationType: VerificationType,
    chainAndAddress: ChainAndAddress,
  ): KycDaoJsonRpcProvider {
    const { blockchain, blockchainNetwork } = chainAndAddress;

    // TODO - Maybe we should start using multiple RPC endpoints and retry with a different one after a fail?
    const rpcUrl = this.getNetworkDetails(blockchainNetwork).rpc_urls[0];

    const contractAddress =
      this.apiStatus?.smart_contracts_info?.[blockchainNetwork]?.[verificationType]?.address;

    if (!contractAddress) {
      throw new InternalError('Smart contract address not found.');
    }

    return new KycDaoJsonRpcProvider(blockchain, contractAddress, rpcUrl);
  }

  private async checkValidNft(
    verificationType: VerificationType,
    chainAndAddress: ChainAndAddress,
  ): Promise<boolean> {
    const provider = this.getRpcProviderForWallet(verificationType, chainAndAddress);

    return provider.hasValidNft(chainAndAddress.address);
  }

  /**
   * Checks on chain if the provided (or the currently connected) wallet has a valid kycNFT.
   *
   * @remarks
   * **Security note:**\
   * The result of this request is prone to client side manipulation.\
   * For maximum security add the verification check directly to your smart contract or use server side verification.
   * @public
   * @async
   * @param {VerificationType} verificationType
   * @param {?NftCheckOptions} [options]
   * @returns {Promise<boolean>}
   */
  @Catch()
  public async hasValidNft(
    verificationType: VerificationType,
    options?: NftCheckOptions,
  ): Promise<boolean> {
    const chainAndAddress = this.getChainAndAddressForNftCheck(options);

    return await this.checkValidNft(verificationType, chainAndAddress);
  }

  /**
   * Queries the valid tokens of the provided (or the currently connected) wallet.
   *
   * @remarks
   * **Security note:**\
   * The result of this request is prone to client side manipulation.\
   * For maximum security add the verification check directly to your smart contract or use server side verification.
   * @public
   * @async
   * @param {VerificationType} verificationType
   * @param {?NftCheckOptions} [options]
   * @returns {Promise<NftCheckResponse>}
   */
  @Catch()
  public async getValidNfts(
    verificationType: VerificationType,
    options?: NftCheckOptions,
  ): Promise<NftCheckResponse> {
    const chainAndAddress = this.getChainAndAddressForNftCheck(options);
    const provider = this.getRpcProviderForWallet(verificationType, chainAndAddress);

    return await provider.getValidNfts(chainAndAddress);
  }

  /**
   * Returns a list of NFT check responses where each element of the list is the response to a check performed on a different {@link BlockchainNetworks | blockchain network}.
   * The list of networks is selected from the {@link SdkStatus.availableBlockchainNetworks | available networks} with the {@link Blockchains | blockchain} of the provided (or the currently connected) wallet.
   * If the provided/connected wallet is on a main network the resulting list will only include main networks and if it's on a dev/test network the list will only include dev/test networks.
   *
   * @remarks
   * **Security note:**\
   * The result of this request is prone to client side manipulation.\
   * For maximum security add the verification check directly to your smart contract or use server side verification.
   * @public
   * @async
   * @returns {Promise<NftCheckResponse[]>}
   */
  @Catch()
  public async checkVerifiedNetworks(
    verificationType: VerificationType,
    options?: NftCheckOptions,
  ): Promise<NftCheckResponse[]> {
    const chainAndAddress = this.getChainAndAddressForNftCheck(options);
    const selectedNetworkDetails = this.getNetworkDetails(chainAndAddress.blockchainNetwork);

    const networksToCheck: BlockchainNetwork[] = typedKeys(this.networkDetails).filter(
      (blockchainNetwork) => {
        const details = this.getNetworkDetails(blockchainNetwork);
        return (
          this.blockchainNetworks.includes(blockchainNetwork) &&
          details.blockchain === selectedNetworkDetails.blockchain &&
          details.testnet === selectedNetworkDetails.testnet
        );
      },
    );

    const promises: Promise<NftCheckResponse>[] = networksToCheck.map((blockchainNetwork) => {
      const networkAndAddress: NetworkAndAddress = {
        blockchainNetwork,
        address: chainAndAddress.address,
      };

      return new Promise((resolve, _) => {
        this.checkValidNft(verificationType, {
          ...chainAndAddress,
          blockchainNetwork,
        })
          .then((hasValidNft) => {
            resolve({ networkAndAddress, hasValidNft });
          })
          .catch((reason) => {
            // TODO these errors are not reported, should be handled better. See EvmJsonRpcProvider.getValidNfts.
            resolve({ networkAndAddress, error: String(reason) });
          });
      });
    });

    const results = await Promise.allSettled(promises);
    const fulfilled = results.filter(isFulfilled);

    return fulfilled.map((fulfilled) => fulfilled.value);
  }

  @Catch()
  private async switchOrAddNetworkChecked(newChainDetails: NetworkMetadata) {
    if (!this.evmProvider) {
      throw new InternalError('EVM provider not found.');
    }

    await this.evmProvider.switchOrAddNetwork(newChainDetails);

    // Note: WalletConnect returns chainId as a number
    const updatedChainId = await this.evmProvider.getChainId();
    if (Number(updatedChainId) !== newChainDetails.chain_id) {
      throw new InternalError(
        `EVM network switching failed: switchNetwork call did not throw an error, but wallet returns wrong chainId (${updatedChainId}), expected ${newChainDetails.chain_id}.`,
      );
    }
  }

  private isUserRejectError(e: unknown): boolean {
    return e instanceof WalletError && e.errorCode === 'RejectedByUser';
  }

  // TODO split this up and move parts to provider wrappers
  private async ensureValidProviderNetwork(
    blockchain: Blockchain,
    autoSwitch = false,
  ): Promise<BlockchainNetwork> {
    const networkDetails = this.networkDetails;
    let blockchainNetwork: BlockchainNetwork | undefined;

    switch (blockchain) {
      case 'Ethereum': {
        if (!this.evmProvider) {
          throw new ConfigurationError('EVM provider not configured.');
        }

        const chainId = await this.evmProvider.getChainId();

        blockchainNetwork = typedKeys(networkDetails).find(
          // Note: WalletConnect returns chainId as a number
          (network) => this.getNetworkDetails(network).chain_id === Number(chainId),
        );

        // selected network is not enabled
        if (!blockchainNetwork || !this.blockchainNetworks.includes(blockchainNetwork)) {
          // automatic network switching is enabled and there is only one enabled network
          if (autoSwitch && this.blockchainNetworks.length === 1) {
            const enabledNetwork = this.blockchainNetworks[0];
            const enabledNetworkDetails = this.getNetworkDetails(enabledNetwork);

            // the enabled network has 'Ethereum' chain and it has a chain ID
            if (enabledNetworkDetails.blockchain === 'Ethereum' && enabledNetworkDetails.chain_id) {
              try {
                await this.switchOrAddNetworkChecked(enabledNetworkDetails);
              } catch (e) {
                if (this.isUserRejectError(e)) {
                  throw e;
                } else {
                  console.log('Automatic EVM network switching failed:', e);
                  throw new StatusError(
                    'NetworkSwitchingFailed',
                    'Automatic EVM network switching failed: feature not supported by the wallet.',
                  );
                }
              }
              blockchainNetwork = enabledNetwork;
            } else {
              throw new InternalError('Network configuration error.');
            }
          } else {
            if (!blockchainNetwork) {
              throw new StatusError(
                'NetworkNotSupported',
                'Selected EVM network in wallet is not supported by the SDK.',
              );
            } else {
              throw new StatusError(
                'NetworkNotEnabled',
                `Selected EVM network in wallet (${chainId}) is not enabled in the SDK.`,
              );
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

  /**
   * Checks if the currently connected wallet's provider has a supported and enabled network selected as active.
   * If yes, it returns the active network, otherwise it throws an error.
   *
   * @public
   * @async
   * @returns {Promise<BlockchainNetwork>}
   */
  @Catch()
  public async checkProviderNetwork(): Promise<BlockchainNetwork> {
    if (!this._chainAndAddress) {
      throw new StatusError('WalletNotConnected');
    }

    return this.ensureValidProviderNetwork(this._chainAndAddress.blockchain);
  }

  /**
   * Tries to switch the active network in the connected wallet's provider. This will usually porompt the user to authorize the switch.
   * Returns an error if the switch was unsuccessful.
   *
   * @public
   * @async
   * @param {BlockchainNetwork} blockchainNetwork
   * @returns {Promise<void>}
   */
  @Catch()
  public async switchProviderNetwork(blockchainNetwork: BlockchainNetwork): Promise<void> {
    if (!this._chainAndAddress) {
      throw new StatusError('WalletNotConnected');
    }

    if (!this.blockchainNetworks.includes(blockchainNetwork)) {
      throw new StatusError('NetworkNotEnabled');
    }

    const networkDetails = this.getNetworkDetails(blockchainNetwork);

    if (this._chainAndAddress.blockchain !== networkDetails.blockchain) {
      throw new StatusError(
        'NetworkSwitchingFailed',
        'Selected network has a different blockchain than the currently connected wallet.',
      );
    }

    const blockchain = networkDetails.blockchain;

    // TODO split this up and move parts to provider wrappers
    switch (blockchain) {
      case 'Ethereum': {
        if (!this.evmProvider) {
          throw new ConfigurationError('EVM provider not configured.');
        }

        const newChainId = networkDetails.chain_id;

        if (!newChainId) {
          throw new InternalError('Network configuration error.');
        }

        // Note: WalletConnect returns chainId as a number
        const currentChainId = await this.evmProvider.getChainId();
        if (Number(currentChainId) !== newChainId) {
          try {
            await this.switchOrAddNetworkChecked(networkDetails);
          } catch (e) {
            if (this.isUserRejectError(e)) {
              throw e;
            } else {
              console.log('EVM network switching failed:', e);
              throw new StatusError(
                'NetworkSwitchingFailed',
                'EVM network switching failed: feature not supported by the wallet.',
              );
            }
          }
        }
        break;
      }
      default:
        throw new InternalError(`Unsupported action for ${blockchain} blockchain.`);
    }
  }

  /**
   * Initiates wallet connection with a third party wallet provider.
   *
   * @public
   * @async
   * @see {@link Blockchains}
   * @param {Blockchain} blockchain
   * @returns {Promise<void>}
   */
  @Catch()
  public async connectWallet(blockchain: Blockchain): Promise<void> {
    // clear saved minting state on wallet connection
    // maybe we could do this after successful connection but this way will not hurt either
    this._mintingState = undefined;

    switch (blockchain) {
      case 'Ethereum': {
        if (!this.evmProvider) {
          throw new ConfigurationError('EVM provider not configured.');
        }
        let addresses: string[];

        if (this.evmProvider.isWalletConnect()) {
          addresses = await this.evmProvider.walletConnectEnable();
        } else {
          addresses = await this.evmProvider.getAccounts();
          if (!addresses.length) {
            addresses = await this.evmProvider.requestAccounts();
          }
        }

        if (!addresses.length) {
          console.error('No connected EVM networks detected');
          throw new StatusError('WalletNotConnected');
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
          // redirects to the wallet
          await this.near.wallet.requestSignIn({ contractId: this.near.contractName });
          // the redirect is non-blocking, so we return a promise that never resolves
          // to stop code executing until the redirect happens
          return new Promise(() => {
            return;
          });
        } else {
          const address: string = this.near.wallet.getAccountId();
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

  /**
   * Disconnects the currently connected wallet (from the current domain).\
   * Only works with NEAR wallets, can be used before {@link KycDao.connectWallet} to allow connecting a new NEAR wallet instead of a previously connected one.
   *
   * @public
   * @async
   * @returns {Promise<void>}
   */
  @Catch()
  public async disconnectWallet(): Promise<void> {
    if (this._chainAndAddress) {
      switch (this._chainAndAddress.blockchain) {
        case 'Ethereum':
          if (!this.evmProvider) {
            throw new ConfigurationError('EVM provider not configured.');
          }
          if (this.evmProvider.isWalletConnect()) {
            await this.evmProvider.walletConnectDisconnect();
          } else {
            throw new InternalError(`Unsupported blockchain: ${this._chainAndAddress.blockchain}.`);
          }
          break;
        case 'Near':
          if (this.near) {
            this.near.wallet.signOut();
          } else {
            throw new ConfigurationError('Near SDK not initialized.');
          }
          break;
        case 'Solana': {
          if (this.solana) {
            await this.solana.disconnect();
          } else {
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

  /**
   * This method creates a session and user for the connected wallet, or log them in. A session cookie will be saved in the browser.
   *
   * @remarks \
   * Ideally this method shouldn't be called repeatedly in quick succession (before the previous call got resolved) because in case of new wallets/users
   * the registration logic will be triggered multiple times and every call after the first one will result in an error. For the same reason, error handling is advised.
   *
   * @public
   * @async
   * @returns {Promise<void>}
   */
  @Catch()
  public async registerOrLogin(): Promise<void> {
    if (this._chainAndAddress) {
      this.session = await this.post<Session>('session', this._chainAndAddress);

      if (!this.session.user) {
        let signature: Signature | string;

        switch (this._chainAndAddress.blockchain) {
          case 'Near': {
            if (!this.near) {
              throw new ConfigurationError('Near SDK not initialized.');
            }

            const toSign = `kycDAO-login-${this.session.nonce}`;

            const key = await this.near.keyStore.getKey(
              this.near.wallet.account().connection.networkId,
              this.near.wallet.getAccountId(),
            );
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

        const payload =
          typeof signature === 'string'
            ? { signature }
            : {
                signature: `ed25519:${base_encode(signature.signature)}`,
                public_key: signature.publicKey.toString(),
              };

        const user = await this.post<UserDetails>('user', payload);
        this.user = user;
        return;
      }

      this.user = this.session.user;

      return;
    }

    throw new StatusError('WalletNotConnected');
  }

  /**
   * This method updates the active email address of the current user.
   *
   * @public
   * @async
   * @param {string} email
   * @returns {Promise<void>}
   */
  @Catch()
  public async updateEmail(email: string): Promise<void> {
    this.validateEmail(email);

    const userUpdateRequest: UserUpdateRequest = { email };
    const user = await this.put<UserDetails>('user', userUpdateRequest);
    this.user = user;
  }

  /**
   * This method can be used to poll the server, refreshing the user session and checking for the user's email verification status.
   * Requires a logged in user.
   *
   * @public
   * @async
   * @returns {Promise<boolean>}
   */
  @Catch()
  public async checkEmailConfirmed(): Promise<EmailData> {
    if (!this.user?.email_confirmed) {
      await this.refreshSession();

      if (!this.session) {
        throw new StatusError('UserNotLoggedIn');
      }
    }

    return {
      address: this.user?.email,
      isConfirmed: !!this.user?.email_confirmed,
    };
  }

  /**
   * This method will resend the email verification code to the email address that was last set for the user.
   *
   * **Note:**\
   * This call is limited to 1 per minute and 5 per address for every user to avoid spamming. When these limits are reached the method will throw an error.
   * It will also throw an error if an email address is not set yet or if it has been already verified.
   *
   * @public
   * @async
   * @returns {Promise<void>}
   */
  @Catch()
  public async resendEmailConfirmationCode(): Promise<void> {
    return await this.post('user/email_confirmation');
  }

  private loadPersona(user: UserDetails, personaOptions?: PersonaOptions): void {
    if (!this.apiStatus?.persona) {
      throw new InternalError('Persona configuration not found.');
    }

    const clientOptions: ClientOptions = {
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

    const { frameAncestors, messageTargetOrigin, onCancel, onComplete, onError } =
      personaOptions || {};
    const iframeOptions = { frameAncestors, messageTargetOrigin };

    const inquiryOptions: InquiryOptions = {
      ...clientOptions,
      ...sessionOptions,
      ...iframeOptions,
      onReady: () => client.open(),
      onComplete: (_args: { inquiryId: string; status: string; fields: object }) => {
        this.verificationStatus.personaSessionData = undefined;
        typeof onComplete === 'function' ? onComplete() : null;
      },
      onCancel: (args: { inquiryId?: string; sessionToken?: string }) => {
        if (args.inquiryId) {
          this.verificationStatus.personaSessionData = {
            referenceId: user.ext_id,
            inquiryId: args.inquiryId,
            sessionToken: args.sessionToken,
          };
        } else {
          this.verificationStatus.personaSessionData = undefined;
        }
        typeof onCancel === 'function' ? onCancel() : null;
      },
      onError: (error: { status: number; code: string }) => {
        this.verificationStatus.personaSessionData = undefined;
        const errorMessage = `Persona verification error: ${error.code}`;
        console.error(errorMessage);
        typeof onError === 'function' ? onError(errorMessage) : null;
      },
    };

    const client = new PersonaClient(inquiryOptions);
  }

  // VERIFICATION DATA
  // TODO backend support for already confirmed emails.
  // TODO Add tier level later as optional.

  // VERIFICATION PROCESS
  // The provider will be configurable/different later (e.g. based on verificationy type).
  /**
   * This method updates the user with data provided in {@link VerificationData} and then starts a verification flow with the approrpiate third party provider.
   *
   * @public
   * @async
   * @param {VerificationData} verificationData
   * @param {?VerificationProviderOptions} [providerOptions]
   * @returns {Promise<void>}
   */
  @Catch()
  public async startVerification(
    verificationData: VerificationData,
    providerOptions?: VerificationProviderOptions,
  ): Promise<void> {
    verificationData = this.validateVerificationData(verificationData);

    const userUpdateRequest: UserUpdateRequest = {
      email: verificationData.email,
      legal_entity: verificationData.isLegalEntity,
      residency: verificationData.taxResidency,
    };
    const user = await this.put<UserDetails>('user', userUpdateRequest);
    this.user = user;

    const allowVerification =
      this.demoMode || !this.isVerifiedForType(verificationData.verificationType);
    if (allowVerification) {
      if (verificationData.verificationType === 'KYC') {
        this.loadPersona(user, providerOptions?.personaOptions);
      }
    } else {
      throw new StatusError('UserAlreadyVerified');
    }
  }

  /**
   * This method can be used to poll the server, refreshing the user session and checking for the user's verification status.
   * Requires a logged in user.
   *
   * @public
   * @async
   * @see {@link VerificationTypes}
   * @returns {Promise<VerificationStasusByType>}
   */
  @Catch()
  public async checkVerificationStatus(): Promise<VerificationStasusByType> {
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

  /**
   * Returns the URL of the identicon that will be saved into the next minted NFT for the current user.\
   * The URL is static and always returns the currently generated image for the user.
   *
   * @deprecated since version 0.3.8, use {@link getNftImageOptions} instead to get multiple NFT image options to select from.
   * @public
   * @returns {string}
   */
  @Catch()
  public getNftImageUrl(): string {
    return this.url('token/identicon');
  }

  /**
   * This method generates a new identicon for the user.
   *
   * @deprecated since version 0.3.8, use {@link regenerateNftImageOptions} instead to regenerate and all NFT image options.
   * @remark The image URL is static so it has to be force-reloaded after the change.
   * @public
   * @async
   * @returns {Promise<void>}
   */
  @Catch()
  public async regenerateNftImage(): Promise<void> {
    await this.request<string>('token/identicon', { method: 'POST' });
  }

  /**
   * This method returns multiple NFT image options currently available for the logged in user. The keys of the returned object are the image IDs.
   * One of these can be passed in as part of the {@link MintingData} parameter of the {@link startMinting} method to select the desired NFT image.
   *
   * @public
   * @returns {Promise<{ [imageId: string]: string }>}
   */
  @Catch()
  public async getNftImageOptions(): Promise<{ [imageId: string]: string }> {
    await this.refreshSession();

    if (!this.user) {
      throw new StatusError('UserNotLoggedIn');
    }

    return Object.fromEntries(
      Object.entries(this.user.available_images).map(([imageId, tokenImage]) => [
        imageId,
        tokenImage.url,
      ]),
    );
  }

  /**
   * This method regenerates and returns a new set of NFT image options currently available for the logged in user.
   * For more information see the {@link getNftImageOptions} method.
   *
   * @public
   * @async
   * @returns {Promise<{ [imageId: string]: string }>}
   */
  @Catch()
  public async regenerateNftImageOptions(): Promise<{ [imageId: string]: string }> {
    await this.request<string>('token/identicon', { method: 'POST' });
    return await this.getNftImageOptions();
  }

  private async authorizeMinting(
    chainAndAddress: ChainAndAddress,
    mintingData: MintingData,
  ): Promise<MintingAuthorizationResponse> {
    const network = chainAndAddress.blockchainNetwork;

    const subscriptionDuration = mintingData.subscriptionYears
      ? `P${mintingData.subscriptionYears}Y`
      : undefined;

    const blockchainAccount = this.getBlockchainAccount(chainAndAddress);

    const data: MintingAuthorizationRequest = {
      blockchain_account_id: blockchainAccount.id,
      network,
      selected_image_id: mintingData.imageId,
      subscription_duration: subscriptionDuration,
    };

    const res = await this.post<MintingAuthorizationResponse>('authorize_minting', data);
    const txHash = res.token.authorization_tx_id;

    if (!txHash) {
      // Either txHash or transaction is required
      if (!res.transaction) {
        throw new InternalError('Transaction ID not found');
      }
    } else {
      const transaction = await this.waitForTransaction(chainAndAddress, txHash);
      if (transaction.status === 'Failure') {
        throw new TransactionError('TransactionFailed');
      }
    }
    return res;
  }

  private async mint(
    chainAndAddress: ChainAndAddress,
    mintAuthResponse: MintingAuthorizationResponse,
    verificationType: VerificationType,
  ): Promise<MintingResult | undefined> {
    const contractAddress = this.getSmartContractAddress(
      chainAndAddress.blockchainNetwork,
      verificationType,
    );

    const authorizationCode = mintAuthResponse.token.authorization_code;
    const tokenMetadataUrl = mintAuthResponse.metadata_url;

    let txHash: string | undefined;
    let tokenId: string | undefined;

    switch (chainAndAddress.blockchain) {
      case 'Near': {
        if (!this.near) {
          throw new ConfigurationError('Near SDK not initialized.');
        }

        const contract: KycDaoContract = new Contract(
          this.near.wallet.account(),
          this.near.contractName,
          {
            viewMethods: ['get_required_mint_cost_for_code'],
            changeMethods: ['mint_with_code'],
          },
        ) as KycDaoContract;

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
        // redirects to the wallet
        await mintFn({
          args: { auth_code: Number(authorizationCode) },
          gas: '300000000000000',
          amount: costWithSlippage.toString(),
          callbackUrl,
        });
        // the redirect is non-blocking, so we return a promise that never resolves
        // to stop code executing until the redirect happens
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

        txHash = await this.evmProvider.mint(
          contractAddress,
          chainAndAddress.address,
          authorizationCode,
        );

        if (txHash) {
          const transaction = await this.waitForTransaction(chainAndAddress, txHash);

          if (transaction.status === 'Failure') {
            throw new TransactionError('TransactionFailed');
          }

          const receipt = transaction.data as EvmTransactionReceipt;
          tokenId = await this.evmProvider.getTokenIdFromReceipt(receipt);
        } else {
          // TODO throw error that transaction cannot be verified? Can we do anything else?
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
        const isJson = tokenMetadataResponse.headers
          .get('content-type')
          ?.includes('application/json');
        const tokenMetadata = isJson ? await tokenMetadataResponse.json() : null;

        if (
          !tokenMetadataResponse.ok ||
          !isLike<TokenMetadata>(tokenMetadata) ||
          typeof tokenMetadata.name !== 'string' ||
          typeof tokenMetadata.description !== 'string' ||
          typeof tokenMetadata.image !== 'string'
        ) {
          throw new InternalError('Token metadata is invalid');
        }

        if (mintAuthResponse.transaction) {
          const mintTransaction = SolanaTransaction.from(
            Buffer.from(mintAuthResponse.transaction, 'hex'),
          );
          txHash = await this.solana.mint(chainAndAddress.address, mintTransaction);
          const transaction = await this.waitForTransaction(chainAndAddress, txHash);
          if (transaction.status === 'Failure') {
            throw new TransactionError('TransactionFailed');
          }

          tokenId = transaction.data as string;
        } else {
          throw new InternalError('Backend transaction not found');
        }
        break;
      }
      default:
        throw new UnreachableCaseError(chainAndAddress.blockchain);
    }

    if (txHash && tokenId) {
      const tokenDetails = await this.post<TokenDetails>('token', {
        authorization_code: authorizationCode,
        token_id: tokenId,
        minting_tx_id: txHash,
      });

      const networkDetails = this.getNetworkDetails(chainAndAddress.blockchainNetwork);

      return getMintingResult(networkDetails, txHash, tokenId, tokenDetails);
    }

    return;
  }

  /**
   * This step updates the user based on the {@link MintingData} provided and checks if the user is eligible to mint a token.
   * Then calls the server to authorize minting for the current wallet and waits for the transaction to succeed (but max about 2 minutes).
   * After an authorization code is acquired it initiates the minting.
   *
   * Returns data related to the successful mint transaction and the minted token, if it's possible.
   * In general it should always return this data unless an error occured or the site got redirected by the provider (e.g. NEAR).
   *
   * In case of an error, based on the type of the error `startMinting` can be called again with the same {@link MintingData} to retry minting
   * or it can be used to start a completely new minting flow with new values.
   * Some properties of {@link MintingData} like the {@link MintingData.imageId | imageId} need to be unique for every minting flow,
   * so when a non-retriable error occurs make sure to call `startMinting` with new unique values.
   *
   * @public
   * @async
   * @param {MintingData} mintingData
   * @returns {Promise<MintingResult | undefined>}
   */
  @Catch()
  public async startMinting(mintingData: MintingData): Promise<MintingResult | undefined> {
    let verificationType = mintingData.verificationType;

    if (!this._chainAndAddress) {
      throw new StatusError('WalletNotConnected');
    }

    // validate minting data
    if (!mintingData.disclaimerAccepted) {
      throw new StatusError('DisclaimerNotAccepted');
    }

    const chainAndAddress = Object.assign({}, this._chainAndAddress);

    // ensure that the selected network in the provider/wallet is supported and enabled
    chainAndAddress.blockchainNetwork = await this.ensureValidProviderNetwork(
      chainAndAddress.blockchain,
      true,
    );

    await this.refreshSession();

    if (!verificationType) {
      verificationType = 'KYC';
    }

    // check if user is verified
    if (!this.isVerifiedForType(verificationType)) {
      throw new StatusError('UserNotVerified');
    }

    // Update disclaimer accepted
    if (!this.user?.disclaimer_accepted) {
      await this.post('disclaimer', { accept: true });
    }

    const getReusableMintAuthResponse = (): MintingAuthorizationResponse | undefined => {
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
      } else {
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

    // start minting
    // in case of Near, this will redirect and our page will get a callback so any further steps are need to be handled in the SDK init phase
    // in case of EVM, this will wait for the transaction to succeed before returning
    const mintingResult = await this.mint(chainAndAddress, mintAuthResponse, verificationType);

    // if the minting was successful, clear the stored minting state so no retry will be possible
    this._mintingState = undefined;

    return mintingResult;
  }
}
