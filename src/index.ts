import { ConnectConfig, Contract, keyStores, Near, WalletConnection } from 'near-api-js';
import { Signature } from 'near-api-js/lib/utils/key_pair';
import { base_encode } from 'near-api-js/lib/utils/serialize';
import { Client as PersonaClient } from 'persona';
import { ApiBase, HttpError } from './api-base';
import {
  BlockchainNetworks,
  KycDaoEnvironments,
  NEAR_TESTNET_ARCHIVAL,
  NEAR_TESTNET_CONFIG,
  PERSONA_SANDBOX_OPTIONS,
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
  KycDaoEnvironment,
  MintingAuthorizationRequest,
  MintingAuthorizationResponse,
  MintingData,
  NearSdk,
  PersonaOptions,
  SdkConfiguration,
  ServerStatus,
  Session,
  Transaction,
  UserDetails,
  UserUpdateRequest,
  VerificationData,
  VerificationProviderOptions,
  VerificationStasusByType,
  VerificationStatus,
  VerificationType,
  RedirectEvent,
} from './types';
import { default as COUNTRIES } from './countries.list.json';
import { FinalExecutionOutcome, JsonRpcProvider } from 'near-api-js/lib/providers';
import { partition, poll } from './utils';

export { ApiBase, HttpError } from './api-base';
export {
  Blockchains,
  BlockchainNetworks,
  KycDaoEnvironments,
  VerificationTypes,
} from './constants';
export { ConnectConfig as NearConnectConfig } from 'near-api-js';
export {
  Blockchain,
  BlockchainNetwork,
  ChainAndAddress,
  Country,
  MintingData,
  PersonaOptions,
  SdkConfiguration,
  ServerStatus,
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
  private environment: KycDaoEnvironment;
  private verificationTypes: VerificationType[];
  private blockchainNetworks: BlockchainNetwork[];

  private near?: NearSdk;

  private _chainAndAddress?: ChainAndAddress;

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

  private isVerified(): boolean {
    const allVerificationTypes = Object.values(VerificationTypes);
    for (const verificationType of allVerificationTypes) {
      if (this.isVerifiedForType(verificationType)) {
        return true;
      }
    }
    return false;
  }

  private getBlockchainAccount(address: string): BlockchainAccountDetails {
    const accounts = this.user?.blockchain_accounts;

    if (!accounts?.length) {
      throw new Error('User has no blockchain accounts.');
    }

    const accountsFound = accounts.filter((acc) => acc.address === address.toLowerCase());

    if (accountsFound.length > 1) {
      throw new Error('Multiple blockchain accounts found for the same wallet address.');
    }

    if (!accountsFound.length) {
      throw new Error('Wallet address is not registered to the current user.');
    }

    return accountsFound[0];
  }

  private getValidAuthorizationCode(): string | undefined {
    if (this._chainAndAddress && this.user) {
      try {
        const account = this.getBlockchainAccount(this._chainAndAddress.address);

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
      case 'Near':
        if (this.near) {
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
            throw new Error(`Unexpected error while checking Near transaction: ${e}.`);
          }
        } else {
          throw new Error('Near SDK not initialized.');
        }
      // TODO case 'Ethereum':
      default:
        throw new Error(`Unsupported blockchain: ${chainAndAddress.blockchain}.`);
    }
  }

  private async waitForTransaction(
    chainAndAddress: ChainAndAddress,
    txHash: string,
  ): Promise<void> {
    await poll(
      () => this.getTx(chainAndAddress, txHash),
      (r) => {
        return r.status === 'Success';
      },
      1000,
      60,
    );
  }

  private static validateBlockchainNetworks(
    blockchainNetworks: BlockchainNetwork[],
  ): BlockchainNetwork[] {
    const errorPrefix = 'kycDAO SDK';
    const allBlockchainNetworks = Object.values(BlockchainNetworks);
    const [validBlockchainNetworks, invalidBlockchainNetworks] = partition(
      [...new Set(blockchainNetworks)],
      (network) => allBlockchainNetworks.includes(network),
    );

    if (invalidBlockchainNetworks.length > 0) {
      throw new Error(
        `${errorPrefix} - Invalid network(s) found in configuration: ${invalidBlockchainNetworks.join(
          ', ',
        )}. Valid values are: ${allBlockchainNetworks.join(', ')}.`,
      );
    }

    if (!validBlockchainNetworks.length) {
      throw new Error(
        `${errorPrefix} - No valid networks found in configuration. Valid values are: ${allBlockchainNetworks.join(
          ', ',
        )}.`,
      );
    }

    const multipleNearNetworks =
      validBlockchainNetworks.filter((network) => network.startsWith('Near')).length > 1;
    if (multipleNearNetworks) {
      throw new Error(`${errorPrefix} - Only one Near network can be configured at a time.`);
    }

    return validBlockchainNetworks;
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
      throw new Error(
        `${errorPrefix} - Invalid verification type(s) found in configuration: ${invalidVerificationTypes.join(
          ', ',
        )}. Valid values are: ${allVerificationTypes.join(', ')}.`,
      );
    }

    if (!validVerificationTypes.length) {
      throw new Error(
        `${errorPrefix} - No valid verification type found in configuration. Valid values are: ${allVerificationTypes.join(
          ', ',
        )}.`,
      );
    }

    return validVerificationTypes;
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
        console.log(`Unexpected error during kycDAO session refresh: ${e}`);
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

      console.log(`Unexpected error during kycDAO session refresh: ${e}`);
      throw e;
    }
  }

  private initNear(network: BlockchainNetwork): void {
    const errorPrefix = 'Cannot initialize Near SDK';
    if (!network.startsWith('Near')) {
      throw new Error(`${errorPrefix} - Not a  Near network: ${network}`);
    }

    const keyStore = new keyStores.BrowserLocalStorageKeyStore();
    const config: ConnectConfig = NEAR_TESTNET_CONFIG;
    config.keyStore = keyStore;
    const contractName = 'app.kycdao.testnet';
    const archival = NEAR_TESTNET_ARCHIVAL;

    if (network === 'NearMainnet') {
      // TODO overwrite testnet values
      throw new Error(`${errorPrefix} - Unsupported Near network: ${network}`);
    }

    const nearApi = new Near(config);
    const wallet = new WalletConnection(nearApi, 'kycDAO');

    this.near = {
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
    const queryParams = new URLSearchParams(window.location.search);
    const queryParamsArray = [...queryParams];
    const matches = queryParamsArray.filter(([key, _]) =>
      Object.keys(knownQueryParams).includes(key),
    );

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
    const kycDaoEnvironments = Object.values(KycDaoEnvironments);
    if (!kycDaoEnvironments.includes(config.environment)) {
      throw new Error(
        `kycDAO SDK - Invalid environment value found in configuration: ${
          config.environment
        }. Valid values are: ${kycDaoEnvironments.join(', ')}.`,
      );
    }

    config.enabledBlockchainNetworks = KycDao.validateBlockchainNetworks(
      config.enabledBlockchainNetworks,
    );

    config.enabledVerificationTypes = KycDao.validateVerificationTypes(
      config.enabledVerificationTypes,
    );

    super(config);

    this.environment = config.environment;
    this.blockchainNetworks = config.enabledBlockchainNetworks;
    this.verificationTypes = config.enabledVerificationTypes;

    const nearNetwork = this.blockchainNetworks.find((network) => network.startsWith('Near'));
    if (nearNetwork) {
      this.initNear(nearNetwork);
    }

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
    const redirectEvent = await kycDao.handleRedirect();
    return { kycDao, redirectEvent: redirectEvent };
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

  // Method for checking NFT directly on chain with RPC.
  // !!! We have to document that it is not a safe check on the frontend and has to be verified on their backend to be sure !!!

  /**
   * NOT IMPLEMENTED \
   * Checks on chain if the provided (or the currently connected) wallet has a kycNFT.
   *
   * @remarks \
   * **IMPORTANT!** \
   * The result of this request can be manipulated on the client side so make sure to verify this on the server side as well.
   * @alpha
   * @public
   * @async
   * @returns {Promise<boolean>}
   */
  public async walletHasKycNft(): Promise<boolean>;
  public async walletHasKycNft(chainAndAddress?: ChainAndAddress): Promise<boolean> {
    if (!chainAndAddress) {
      if (!this._chainAndAddress) {
        throw new Error(
          'Blockchain and address not set yet. Either connect a wallet with kycDAO first or specify them in the parameters.',
        );
      }

      chainAndAddress = this._chainAndAddress;
    }

    return false;
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
    if (blockchain === 'Near') {
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
          address,
        };
      }

      return;
    }

    throw new Error(`${errorPrefix} - Unsupported blockchain: ${blockchain}.`);
  }

  /**
   * Disconnects the currently connected wallet (from the current domain).
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
        // TODO case 'Ethereum':
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
   * @public
   * @async
   * @returns {Promise<void>}
   */
  public async registerOrLogin(): Promise<void> {
    if (this._chainAndAddress) {
      this.session = await this.post<Session>('session', this._chainAndAddress);

      if (!this.session.user) {
        const errorPrefix = 'kycDAO registration error';
        const toSign = `kycDAO-login-${this.session.nonce}`;
        let signature: Signature;

        switch (this._chainAndAddress.blockchain) {
          case 'Near': {
            if (!this.near) {
              throw new Error(`${errorPrefix} - Near SDK not initialized.`);
            }

            const key = await this.near.keyStore.getKey(
              this.near.wallet.account().connection.networkId,
              this.near.wallet.getAccountId(),
            );
            signature = key.sign(Buffer.from(toSign));
            break;
          }
          // TODO case 'Ethereum':
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
    const sessionData = this.verificationStatus.personaSessionData;
    const shouldContinue = sessionData && sessionData.referenceId === user.ext_id;
    const options = shouldContinue
      ? {
          inquiryId: sessionData.inquiryId,
          sessionToken: sessionData.sessionToken,
          templateId: undefined,
        }
      : { referenceId: user.ext_id };

    const client: PersonaClient = new PersonaClient({
      ...PERSONA_SANDBOX_OPTIONS, // TODO make this configurable for production release
      ...options,
      onReady: () => client.open(),
      onComplete: (_args: { inquiryId: string; status: string; fields: object }) => {
        this.verificationStatus.personaSessionData = undefined;
        typeof personaOptions?.onComplete === 'function' ? personaOptions.onComplete() : null;
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
        typeof personaOptions?.onCancel === 'function' ? personaOptions.onCancel() : null;
      },
      onError: (error: { status: number; code: string }) => {
        this.verificationStatus.personaSessionData = undefined;
        const errorMessage = `Persona verification error: ${error.code}`;
        console.error(errorMessage);
        typeof personaOptions?.onError === 'function' ? personaOptions.onError(errorMessage) : null;
      },
    });
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
      this.environment === 'demo' || !this.isVerifiedForType(verificationData.verificationType);
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

  private async authorizeMinting(chainAndAddress: ChainAndAddress): Promise<string> {
    const errorPrefix = 'Cannot authorize minting';

    let network: BlockchainNetwork | undefined;

    switch (chainAndAddress.blockchain) {
      case 'Near':
        network = this.blockchainNetworks.find((network) => network.startsWith('Near'));

        if (!network) {
          throw new Error(`${errorPrefix} - Configured NEAR network not found.`);
        }

        break;
      // TODO case 'Ethereum':
      default:
        throw new Error(`${errorPrefix} - Unsupported blockchain: ${chainAndAddress.blockchain}.`);
    }

    try {
      const blockchainAccount = this.getBlockchainAccount(chainAndAddress.address);

      const data: MintingAuthorizationRequest = {
        blockchain_account_id: blockchainAccount.id,
        network,
      };

      const res = await this.post<MintingAuthorizationResponse>('authorize_minting', data);
      try {
        await this.waitForTransaction(chainAndAddress, res.tx_hash);
        return res.code;
      } catch (e) {
        if (e instanceof Error && e.message === 'TIMEOUT') {
          throw new Error('Authorization transaction could not be verified in 1 minute.');
        } else {
          throw new Error(`Unexpected error: ${e}`);
        }
      }
    } catch (e) {
      if (e instanceof Error) {
        throw new Error(`${errorPrefix} - ${e.message}`);
      } else {
        throw e;
      }
    }
  }

  private async mint(chainAndAddress: ChainAndAddress, authorizationCode: string): Promise<void> {
    const errorPrefix = 'Cannot mint';

    switch (chainAndAddress.blockchain) {
      case 'Near': {
        if (!this.near) {
          throw new Error(`${errorPrefix} - Near SDK not initialized.`);
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
          throw new Error('Mint function not callable.');
        }

        await mintFn({
          args: { auth_code: Number(authorizationCode) },
          gas: '300000000000000',
          amount: '100000000000000000000000', // in yoctoNEAR
          callbackUrl,
        });
        break;
      }
      // TODO case 'Ethereum':
      default:
        throw new Error(`${errorPrefix} - Unsupported blockchain: ${chainAndAddress.blockchain}.`);
    }
    return;
  }

  /**
   * This step updates the user based on the {@link MintingData} provided and checks for an existing valid authorization code.\
   * If none exixsts calls the sarcer to authorize minting for the current wallet and waits for the transaction to succeed (but max 1 minute).\
   * After an authorization code is acquired it initiates the minting.
   *
   * @public
   * @async
   * @param {MintingData} mintingData
   * @returns {Promise<void>}
   */
  public async startMinting(mintingData: MintingData): Promise<void> {
    const errorPrefix = 'Cannot start minting';

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

    // check if user is verified
    if (!this.isVerified()) {
      throw new Error(`${errorPrefix} - User must be verified to be able to mint an NFT.`);
    }

    // Update disclaimer accepted
    if (!this.user?.disclaimer_accepted) {
      await this.post('disclaimer', { accept: true });
    }

    // check if there is a valid authorization code already that can be used for minting
    // if there is no valid authorization code yet, authorize minting through backend and wait for the transaction to finish
    const authCode =
      this.getValidAuthorizationCode() || (await this.authorizeMinting(chainAndAddress));

    // start minting
    // in case of Near, this will redirect and our page will get a callback so any further steps are need to be handled in the SDK init phase
    await this.mint(chainAndAddress, authCode);

    // we will need to handle things here for providers without a redirect
  }
}
