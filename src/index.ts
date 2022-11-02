import { ConnectConfig, Contract, keyStores, Near, WalletConnection } from 'near-api-js';
import { Signature } from 'near-api-js/lib/utils/key_pair';
import { base_encode } from 'near-api-js/lib/utils/serialize';
import { Client as PersonaClient, ClientOptions } from 'persona';
import { InquiryOptions } from 'persona/dist/lib/interfaces';
import { ApiBase, HttpError } from './api-base';
import {
  BlockchainNetworkDetails,
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
  KycDaoContract,
  MintingAuthorizationRequest,
  MintingAuthorizationResponse,
  MintingData,
  NearBlockchainNetwork,
  NearSdk,
  NftCheckOptions,
  PersonaOptions,
  RedirectEvent,
  SdkConfiguration,
  SdkStatus,
  ServerStatus,
  Session,
  SolanaBlockchainNetwork,
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
import { isLike, partition, poll } from './utils';
import { EvmProviderWrapper } from './blockchains/evm/evm-provider-wrapper';
import { EvmProvider, EvmTransactionReceipt, ProviderRpcError } from './blockchains/evm/types';
import { KycDaoJsonRpcProvider } from './blockchains/kycdao-json-rpc-provider';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { SolanaProviderWrapper } from './blockchains/solana/solana-provider-wrapper';

export { ApiBase, HttpError } from './api-base';
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
  ChainAndAddress,
  Country,
  EvmBlockchainNetwork,
  MintingData,
  NearBlockchainNetwork,
  NetworkAndAddress,
  NftCheckOptions,
  PersonaOptions,
  SdkConfiguration,
  SdkStatus,
  ServerStatus,
  SolanaBlockchainNetwork,
  VerificationData,
  VerificationProvider,
  VerificationProviderOptions,
  VerificationStasusByType,
  VerificationType,
  RedirectEvent,
} from './types';

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
  private blockchainNetworks?: BlockchainNetwork[];
  private evmProvider?: EvmProviderWrapper;

  private apiStatus?: ApiStatus;

  private near?: NearSdk;

  private solana?: SolanaProviderWrapper;

  private _chainAndAddress?: ChainAndAddress;

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
      availableBlockchainNetworks: this.blockchainNetworks || [],
      availableVerificationTypes: this.verificationTypes || [],
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
      throw new Error('User has no blockchain accounts.');
    }

    const address =
      chainAndAddress.blockchain === 'Ethereum'
        ? chainAndAddress.address.toLowerCase()
        : chainAndAddress.address;

    const accountsFound = accounts.filter((acc) => acc.address === address);

    if (accountsFound.length > 1) {
      throw new Error('Multiple blockchain accounts found for the same wallet address.');
    }

    if (!accountsFound.length) {
      throw new Error('Wallet address is not registered to the current user.');
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
          throw new Error('Near SDK not initialized.');
        }

        const provider = new JsonRpcProvider(this.near.archival);
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
          throw new Error(`Unexpected error while checking Near transaction: ${e}.`);
        }
      }
      case 'Ethereum': {
        if (!this.evmProvider) {
          throw new Error('EVM provider not configured.');
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
          throw new Error('Solana support is not enabled.');
        }

        return await this.solana.getTransaction(txHash);
      default:
        throw new Error(`Unsupported blockchain: ${chainAndAddress.blockchain}.`);
    }
  }

  private async waitForTransaction(
    chainAndAddress: ChainAndAddress,
    txHash: string,
  ): Promise<Transaction> {
    try {
      // poll with exponential backoff, 10 queries total, last is about 128 seconds after the first
      return await poll(() => this.getTx(chainAndAddress, txHash), 250, 9, {
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
        useExponentialBackoff: true,
      });
    } catch (e) {
      if (e instanceof Error && e.message === 'TIMEOUT') {
        throw new Error('Transaction could not be verified in time.');
      } else {
        throw e;
      }
    }
  }

  private static validateBlockchainNetworks(
    availableBlockchainNetworks: BlockchainNetwork[],
    enabledBlockchainNetworks?: BlockchainNetwork[],
  ): BlockchainNetwork[] {
    const errorPrefix = 'kycDAO SDK';
    const allBlockchainNetworks = Object.values(BlockchainNetworks);

    if (enabledBlockchainNetworks) {
      const [validBlockchainNetworks, invalidBlockchainNetworks] = partition(
        [...new Set(enabledBlockchainNetworks)],
        (network) => allBlockchainNetworks.includes(network),
      );

      if (invalidBlockchainNetworks.length > 0) {
        console.warn(
          `${errorPrefix} - Invalid network name(s) were found in configuration and will be ignored: ${invalidBlockchainNetworks.join(
            ', ',
          )}. Valid values are: ${allBlockchainNetworks.join(', ')}.`,
        );
      }

      if (!validBlockchainNetworks.length) {
        throw new Error(
          `${errorPrefix} - No valid network names were found in configuration. Valid values are: ${allBlockchainNetworks.join(
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

      if (!finalBlockchainNetworks.length) {
        throw new Error(
          `${errorPrefix} - No available networks were found in configuration. Available networks are: ${allBlockchainNetworks.join(
            ', ',
          )}.`,
        );
      }

      const multipleNearNetworks =
        finalBlockchainNetworks.filter((network) => network.startsWith('Near')).length > 1;
      // This will probably never happen since the server will only have one enabled
      if (multipleNearNetworks) {
        throw new Error(`${errorPrefix} - Only one Near network can be configured at a time.`);
      }

      const multipleSolanaNetworks =
        finalBlockchainNetworks.filter((network) => network.startsWith('Solana')).length > 1;
      // This will probably never happen since the server will only have one enabled
      if (multipleSolanaNetworks) {
        throw new Error(`${errorPrefix} - Only one Solana network can be configured at a time.`);
      }

      return finalBlockchainNetworks;
    }

    return availableBlockchainNetworks.filter((network) => allBlockchainNetworks.includes(network));
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
      throw new Error(
        `${errorPrefix} - No valid verification types were found in configuration. Valid values are: ${allVerificationTypes.join(
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
    const errorPrefix = 'kycDAO SDK';
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

      throw new Error(
        `${errorPrefix} - The configured EVM provider is not compliant with the required standards.`,
      );
    }

    return;
  }

  private validateVerificationData(verificationData: VerificationData): VerificationData {
    if (!verificationData.termsAccepted) {
      throw new Error(
        'Terms and Conditions and Privacy Policy must be accepted to start verification.',
      );
    }

    const allVerificationTypes = Object.values(VerificationTypes);

    // verification type validation
    const verificationType = verificationData.verificationType;
    if (!allVerificationTypes.includes(verificationType)) {
      throw new Error(
        `Invalid verificationType. Valid values are: ${allVerificationTypes.join(', ')}.`,
      );
    }

    if (!this.verificationTypes.includes(verificationType)) {
      throw new Error(
        `Invalid verificationType. "${verificationType}" was not enabled during SDK initialization.`,
      );
    }

    // email format validation
    const emailRegExp = new RegExp('^[^@]+@[a-z0-9-]+.[a-z]+$');
    if (!verificationData.email.match(emailRegExp)) {
      throw new Error('Invalid email address format.');
    }

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
      throw new Error('Invalid taxResidency. Please use the country list provided by the SDK.');
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
      const isSameWallet = this.session.chain_and_address === this._chainAndAddress;
      if (!isSameWallet) {
        this.session = undefined;
      }
    }
  }

  private async refreshSession(): Promise<Session | undefined> {
    const createSession = async (chainAndAddress: ChainAndAddress): Promise<void> => {
      try {
        const session = await this.post<Session>('session', chainAndAddress);
        this.session = session;
        this.user = session.user;
      } catch (e) {
        console.error(`Unexpected error during kycDAO session refresh: ${e}`);
        throw e;
      }
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
      if (e instanceof HttpError && e.statusCode === 401) {
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
    const errorPrefix = 'Cannot initialize Near SDK';
    if (!blockchainNetwork.startsWith('Near')) {
      throw new Error(`${errorPrefix} - Not a  Near network: ${blockchainNetwork}`);
    }

    // TODO remove this step and saving contract address to this.near when we want NEAR support for other verification types
    // this will also require a way for us to detect the verification type after a redirect (probably adding it to the callback URL)
    const contractName = this.getSmartContractAddress(blockchainNetwork, 'KYC');

    if (!contractName) {
      throw new Error(`${errorPrefix} - Smart contract name configuration missing.`);
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
  ): Promise<void> {
    if (!this.near) {
      throw new Error('Near callback detected but the Near SDK is  not initialized.');
    } else {
      if (this.near.wallet.isSignedIn()) {
        const address: string = this.near.wallet.getAccountId();
        this._chainAndAddress = {
          blockchain: 'Near',
          blockchainNetwork: this.near.blockchainNetwork,
          address,
        };

        await this.refreshSession();

        switch (event) {
          case 'NearLogin':
            break;
          case 'NearMint': {
            const authCode = queryParams.get('authCode');
            if (authCode) {
              const transaction = await this.getTx(this._chainAndAddress, detectedValue);

              if (transaction.status !== 'Success') {
                throw new Error(
                  `NearMint callback detected but minting transaction is not successful. Status: ${transaction}.`,
                );
              }

              const outcome = transaction.data as FinalExecutionOutcome;
              if (typeof outcome.status === 'string' || !outcome.status.SuccessValue) {
                throw new Error(
                  'NearMint callback detected but transaction outcome does not have a SuccessValue (token ID).',
                );
              } else {
                const successValue = outcome.status.SuccessValue;

                try {
                  const tokenId: string = JSON.parse(
                    Buffer.from(successValue, 'base64').toString(),
                  ).token_id;

                  await this.post('token', {
                    authorization_code: authCode,
                    token_id: tokenId,
                    minting_tx_id: detectedValue,
                  });
                } catch {
                  throw new Error(
                    'Failed to send Near minting transaction status update to kycDAO server.',
                  );
                }
              }
            } else {
              throw new Error('authCode parameter is empty or missing from NearMint callback URL.');
            }
            break;
          }
          case 'NearUserRejectedError':
            break;
          default:
            throw new Error(`Unhandled Near wallet redirect event: ${event}.`);
        }
      }
    }
  }

  private async handleRedirect(): Promise<RedirectEvent | undefined> {
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

      if (event.startsWith('Near')) {
        try {
          await this.handleNearWalletCallback(event, queryParams, value);
        } catch (e) {
          if (e instanceof Error) {
            console.error(`${errorPrefix} - ${e.message}`);
          } else {
            console.error(`${errorPrefix} - ${e}`);
          }

          return;
        }
      }

      return event;
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
  public static async initialize(config: SdkConfiguration): Promise<KycDaoInitializationResult> {
    const kycDao = new KycDao(config);
    kycDao.apiStatus = await kycDao.get<ApiStatus>('status');

    kycDao.blockchainNetworks = KycDao.validateBlockchainNetworks(
      kycDao.apiStatus.enabled_networks,
      config.enabledBlockchainNetworks,
    );

    const evmProvider = KycDao.validateEvmProvider(kycDao.blockchainNetworks, config.evmProvider);
    kycDao.evmProvider = evmProvider ? new EvmProviderWrapper(evmProvider) : undefined;

    if (!evmProvider) {
      kycDao.blockchainNetworks = kycDao.blockchainNetworks.filter(
        (network) => !Object.keys(EvmBlockchainNetworks).includes(network),
      );
    }

    // add EVM provider event handlers here with the `on` method (accountsChanged, chainChanged) if needed

    const nearNetwork = kycDao.blockchainNetworks.find((network) =>
      network.startsWith('Near'),
    ) as NearBlockchainNetwork;
    if (nearNetwork) {
      kycDao.initNear(nearNetwork);
    }

    const solanaNetwork = kycDao.blockchainNetworks.find((network) =>
      network.startsWith('Solana'),
    ) as SolanaBlockchainNetwork;
    if (solanaNetwork) {
      kycDao.solana = new SolanaProviderWrapper(solanaNetwork);
    }

    const redirectEvent = await kycDao.handleRedirect();

    return {
      kycDao,
      redirectEvent,
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

  /**
   * Checks on chain if the provided (or the currently connected) wallet has a valid kycNFT.
   *
   * @remarks \
   * **IMPORTANT!** \
   * The result of this request can be manipulated on the client side so make sure to verify this on the server side as well.
   * @alpha
   * @public
   * @async
   * @returns {Promise<boolean>}
   */
  public async hasValidNft(
    verificationType: VerificationType,
    options?: NftCheckOptions,
  ): Promise<boolean> {
    const networkAndAddress = options?.networkAndAddress;
    const chainAndAddress = networkAndAddress
      ? {
          ...networkAndAddress,
          blockchain: BlockchainNetworkDetails[networkAndAddress.blockchainNetwork].blockchain,
        }
      : this._chainAndAddress;

    if (!chainAndAddress) {
      throw new Error(
        'BlockchainNetwork and address not set yet. Either connect a wallet with kycDAO first or specify them in the parameters.',
      );
    }

    const { address, blockchain, blockchainNetwork } = chainAndAddress;

    if (!address) {
      throw new Error('Wallet address cannot be empty.');
    }

    const rpcUrl =
      options?.rpcUrl || BlockchainNetworkDetails[chainAndAddress.blockchainNetwork].rpcUrl;

    const contractAddress =
      this.apiStatus?.smart_contracts_info?.[blockchainNetwork]?.[verificationType]?.address;

    if (!contractAddress) {
      throw new Error('Smart contract address not found.');
    }

    const rpcProvider = new KycDaoJsonRpcProvider(blockchain, rpcUrl);

    return await rpcProvider.hasValidToken(contractAddress, address);
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
  public async connectWallet(blockchain: Blockchain): Promise<void> {
    const errorPrefix = 'Cannot connect wallet';

    switch (blockchain) {
      case 'Ethereum': {
        if (!this.evmProvider) {
          console.error('EVM provider not configured');
          throw new Error(`${errorPrefix} - EVM provider not configured.`);
        }

        let addresses = await this.evmProvider.getAccounts();

        if (!addresses.length) {
          try {
            addresses = await this.evmProvider.requestAccounts();
          } catch (error) {
            if (isLike<ProviderRpcError>(error) && error.code === 4001) {
              throw new Error(`${errorPrefix} - User cancelled account connection request.`);
            }
          }
        }

        if (!addresses.length) {
          console.error('No connected EVM networks detected');
          throw new Error(`${errorPrefix} - No connected EVM networks detected.`);
        }

        const chainId = await this.evmProvider.getChainId();

        const blockchainNetwork = (
          Object.keys(BlockchainNetworkDetails) as Array<BlockchainNetwork>
        ).find((network) => BlockchainNetworkDetails[network].chainId === chainId);

        if (!blockchainNetwork) {
          throw new Error(`${errorPrefix} - Connected EVM network is not supported.`);
        }

        if (!this.blockchainNetworks?.includes(blockchainNetwork)) {
          throw new Error(`${errorPrefix} - Connected EVM network is not enabled.`);
        }

        this._chainAndAddress = {
          blockchain: 'Ethereum',
          blockchainNetwork: blockchainNetwork,
          address: addresses[0],
        };
        break;
      }
      case 'Near':
        if (!this.near) {
          throw new Error(`${errorPrefix} - Near SDK not initialized.`);
        }

        if (!this.near.wallet.isSignedIn()) {
          try {
            await this.near.wallet.requestSignIn(this.near.contractName, 'kycDAO');
          } catch (e) {
            throw new Error(`${errorPrefix} - ${(e as Error).message}`);
          }
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
          throw new Error(`${errorPrefix} - Solana support is not enabled.`);
        }

        this.solana.adapter = new PhantomWalletAdapter();

        try {
          await this.solana.connect();
        } catch (e) {
          let message = '';
          if (typeof e === 'string') {
            message = e;
          } else if (e instanceof Error) {
            message = e.message || e.name;
          }
          message = message || 'Unknown error';

          throw new Error(`${errorPrefix} - ${message}`);
        }

        const address = this.solana.address;

        if (!address) {
          throw new Error(`${errorPrefix} - Wallet address not found.`);
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
        throw new Error(`${errorPrefix} - Unsupported blockchain: ${blockchain}.`);
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
  public async disconnectWallet(): Promise<void> {
    const errorPrefix = 'Cannot disconnect wallet';
    if (this._chainAndAddress) {
      switch (this._chainAndAddress.blockchain) {
        case 'Near':
          if (this.near) {
            this.near.wallet.signOut();
          } else {
            throw new Error(`${errorPrefix} - Near SDK not initialized.`);
          }
          break;
        case 'Solana': {
          if (this.solana) {
            await this.solana.disconnect();
          } else {
            throw new Error(`${errorPrefix} - Solana support is not enabled.`);
          }
          break;
        }
        // there is no corresponding logic for 'Ethereum':
        default:
          throw new Error(
            `${errorPrefix} - Unsupported blockchain: ${this._chainAndAddress.blockchain}.`,
          );
      }

      this._chainAndAddress = undefined;
      this.user = undefined;
      this.session = undefined;
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
  public async registerOrLogin(): Promise<void> {
    if (this._chainAndAddress) {
      this.session = await this.post<Session>('session', this._chainAndAddress);

      if (!this.session.user) {
        const errorPrefix = 'kycDAO login error';
        let signature: Signature | string;

        switch (this._chainAndAddress.blockchain) {
          case 'Near': {
            if (!this.near) {
              throw new Error(`${errorPrefix} - Near SDK not initialized.`);
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
              throw new Error(`${errorPrefix} - EVM provider not configured.`);
            }

            const toSign = this.session.eip_4361_message;

            try {
              signature = await this.evmProvider.personalSign(
                toSign,
                this._chainAndAddress.address,
              );
            } catch (error) {
              if (isLike<ProviderRpcError>(error) && error.code === 4001) {
                throw new Error(`${errorPrefix} - User cancelled signature request.`);
              } else {
                throw error;
              }
            }
            break;
          }
          case 'Solana': {
            if (!this.solana) {
              throw new Error(`${errorPrefix} - Solana support is not enabled.`);
            }

            const toSign = `kycDAO-login-${this.session.nonce}`;

            try {
              signature = await this.solana.signMessage(toSign);
            } catch (e) {
              console.error(e);
              throw new Error(`${errorPrefix} - ${e}`);
            }
            break;
          }
          default:
            throw new Error(
              `${errorPrefix} - Unsupported blockchain: ${this._chainAndAddress.blockchain}.`,
            );
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

    throw new Error(
      'Cannot register or log in to kycDAO: blockchain and address is not specified (no connected wallet).',
    );
  }

  // we can ask the backend to send the email but verification is not currently required for minting (but probably will be in the future)
  private async sendEmailConfirmationCode(): Promise<void> {
    return;
  }

  private loadPersona(user: UserDetails, personaOptions?: PersonaOptions): void {
    if (!this.apiStatus?.persona) {
      throw new Error('Persona configuration not found.');
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
      throw new Error('User already verified.');
    }
  }

  /**
   * This method can be used to poll the backend, refreshing the user session and checking for the verification status.
   *
   * @public
   * @async
   * @see {@link VerificationTypes}
   * @returns {Promise<VerificationStasusByType>}
   */
  public async checkVerificationStatus(): Promise<VerificationStasusByType> {
    const status = this.getVerificationStatusByType();
    const allVerified = !Object.values(status).some((value) => !value);
    if (!allVerified) {
      await this.refreshSession();

      if (!this.session) {
        throw new Error('Cannot check kycDAO verification status without an initialized wallet.');
      }

      return this.getVerificationStatusByType();
    }

    return status;
  }

  /**
   * Returns the URL of the identicon that will be saved into the next minted NFT for the current user.\
   * The URL is static and always returns the currently generated image for the user.
   *
   * @public
   * @returns {string}
   */
  public getNftImageUrl(): string {
    return this.url('token/identicon');
  }

  /**
   * This method generates a new identicon for the user.
   *
   * @remark The image URL is static so it has to be force-reloaded after the change.
   * @public
   * @async
   * @returns {Promise<void>}
   */
  public async regenerateNftImage(): Promise<void> {
    await this.request<string>('token/identicon', { method: 'POST' });
  }

  // TODO later: more NFT image selection options: URL? File upload? We provide options the 3rd party site can implement a selector for?

  private async authorizeMinting(
    chainAndAddress: ChainAndAddress,
  ): Promise<MintingAuthorizationResponse> {
    const errorPrefix = 'Cannot authorize minting';

    const network = chainAndAddress.blockchainNetwork;

    try {
      const blockchainAccount = this.getBlockchainAccount(chainAndAddress);

      const data: MintingAuthorizationRequest = {
        blockchain_account_id: blockchainAccount.id,
        network,
      };

      const res = await this.post<MintingAuthorizationResponse>('authorize_minting', data);
      const txHash = res.token.authorization_tx_id;

      if (!txHash) {
        throw new Error(`${errorPrefix} - Transaction ID not found`);
      }

      const transaction = await this.waitForTransaction(chainAndAddress, txHash);
      if (transaction.status === 'Failure') {
        throw new Error('Transaction failed');
      }

      return res;
    } catch (e) {
      if (e instanceof Error) {
        throw new Error(`${errorPrefix} - ${e.message}`);
      } else {
        throw e;
      }
    }
  }

  private async mint(
    chainAndAddress: ChainAndAddress,
    mintAuthResponse: MintingAuthorizationResponse,
    verificationType: VerificationType,
  ): Promise<void> {
    const errorPrefix = 'Cannot mint';

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
          throw new Error(`${errorPrefix} - Near SDK not initialized`);
        }

        const contract: KycDaoContract = new Contract(
          this.near.wallet.account(),
          this.near.contractName,
          {
            viewMethods: [],
            changeMethods: ['mint'],
          },
        ) as KycDaoContract;

        const connectorSign = window.location.search.startsWith('?') ? '&' : '?';
        const data = `${connectorSign}authCode=${authorizationCode}`;
        const callbackUrl = `${window.location.origin}${window.location.pathname}${window.location.search}${data}${window.location.hash}`;

        const mintFn = contract.mint;
        if (!mintFn) {
          throw new Error('Mint function not callable');
        }

        await mintFn({
          args: { auth_code: Number(authorizationCode) },
          gas: '300000000000000',
          amount: '100000000000000000000000', // in yoctoNEAR
          callbackUrl,
        });

        break;
      }
      case 'Ethereum': {
        if (!this.evmProvider) {
          throw new Error(`${errorPrefix} - EVM provider not configured`);
        }

        if (!contractAddress) {
          throw new Error(`${errorPrefix} - Smart contract address not found`);
        }

        txHash = await this.evmProvider.mint(
          contractAddress,
          chainAndAddress.address,
          authorizationCode,
        );

        if (txHash) {
          const transaction = await this.waitForTransaction(chainAndAddress, txHash);

          if (transaction.status === 'Failure') {
            throw new Error(`${errorPrefix} - Transaction failed`);
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
          throw new Error(`${errorPrefix} - Solana support is not enabled`);
        }

        if (!contractAddress) {
          throw new Error(`${errorPrefix} - Smart contract address not found`);
        }

        if (!tokenMetadataUrl) {
          throw new Error(`${errorPrefix} - Token metadata not found`);
        }

        txHash = await this.solana.mint(contractAddress, chainAndAddress.address, tokenMetadataUrl);

        if (txHash) {
          const transaction = await this.waitForTransaction(chainAndAddress, txHash);

          if (transaction.status === 'Failure') {
            throw new Error(`${errorPrefix} - Transaction failed`);
          }

          tokenId = transaction.data as string;
        } else {
          // TODO throw error that transaction cannot be verified? Can we do anything else?
        }

        break;
      }
      default:
        throw new Error(`${errorPrefix} - Unsupported blockchain: ${chainAndAddress.blockchain}`);
    }

    if (txHash && tokenId) {
      await this.post('token', {
        authorization_code: authorizationCode,
        token_id: tokenId,
        minting_tx_id: txHash,
      });
    }
  }

  /**
   * This step updates the user based on the {@link MintingData} provided and checks if the user is eligible to mint a token.
   * Then calls the server to authorize minting for the current wallet and waits for the transaction to succeed (but max about 2 minutes).
   * After an authorization code is acquired it initiates the minting.
   *
   * @public
   * @async
   * @param {MintingData} mintingData
   * @returns {Promise<void>}
   */
  public async startMinting(mintingData: MintingData): Promise<void> {
    const errorPrefix = 'Cannot start minting';
    let verificationType = mintingData.verificationType;

    if (!this._chainAndAddress) {
      throw new Error(
        `${errorPrefix} - Blockchain and address is not specified (no connected wallet).`,
      );
    }

    const chainAndAddress = this._chainAndAddress;

    // validate minting data
    if (!mintingData.disclaimerAccepted) {
      throw new Error(`${errorPrefix} - Disclaimer must be accepted.`);
    }

    await this.refreshSession();

    if (!verificationType) {
      verificationType = 'KYC';
    }

    // check if user is verified
    if (!this.isVerifiedForType(verificationType)) {
      throw new Error(`${errorPrefix} - User must be verified to be able to mint an NFT.`);
    }

    // Update disclaimer accepted
    if (!this.user?.disclaimer_accepted) {
      await this.post('disclaimer', { accept: true });
    }

    // check if there is a valid authorization code already that can be used for minting
    // if there is no valid authorization code yet, authorize minting through backend and wait for the transaction to finish
    // const authCode = this.getValidAuthorizationCode() || (await this.authorizeMinting(chainAndAddress));

    // always get new authorization code for now, trying to save money/time by using an existing one can cause issues
    const authCode = await this.authorizeMinting(chainAndAddress);

    // start minting
    // in case of Near, this will redirect and our page will get a callback so any further steps are need to be handled in the SDK init phase
    // in case of EVM, this will wait for the transaction to succeed before returning
    await this.mint(chainAndAddress, authCode, verificationType);
  }
}
