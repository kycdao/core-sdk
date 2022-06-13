import { ConnectConfig, keyStores, Near, WalletConnection } from 'near-api-js';
import { Signature } from 'near-api-js/lib/utils/key_pair';
import { base_encode } from 'near-api-js/lib/utils/serialize';
import { Client as PersonaClient } from 'persona';
import { ApiBase, HttpError } from './api-base';
import {
  BlockchainNetworks,
  KycDaoEnvironments,
  NEAR_TESTNET_CONFIG,
  PERSONA_SANDBOX_OPTIONS,
  VerificationTypes,
} from './constants';
import {
  ApiStatus,
  Blockchain,
  BlockchainNetwork,
  ChainAndAddress,
  Country,
  KycDaoEnvironment,
  MintingData,
  NearSdk,
  PersonaOptions,
  SdkConfiguration,
  ServerStatus,
  Session,
  UserDetails,
  VerificationData,
  VerificationProviderOptions,
  VerificationStasusByType,
  VerificationStatus,
  VerificationType,
} from './types';
import { default as COUNTRIES } from './countries.list.json';

export { ConnectConfig as NearConnectConfig } from 'near-api-js';
export {
  Blockchain,
  BlockchainNetwork,
  Country,
  MintingData,
  SdkConfiguration,
  ServerStatus,
  VerificationData,
  VerificationProvider,
  VerificationStasusByType,
  VerificationType,
  WalletProvider,
} from './types';

const countries: Country[] = Array.from(COUNTRIES);

function partition<T>(arr: T[], predicate: (_: T) => boolean): [T[], T[]] {
  const partitioned: [T[], T[]] = [[], []];
  arr.forEach((val: T) => {
    partitioned[predicate(val) ? 0 : 1].push(val);
  });
  return partitioned;
}

export class KycDao extends ApiBase {
  private environment: KycDaoEnvironment;
  private verificationTypes: VerificationType[];
  private blockchainNetworks: BlockchainNetwork[];

  private near?: NearSdk;
  get nearConfig(): ConnectConfig | undefined {
    return this.near?.config;
  }

  private _chainAndAddress?: ChainAndAddress;
  get connectedChainAndAddress(): ChainAndAddress | undefined {
    return this._chainAndAddress;
  }
  get walletConnected(): boolean {
    return !!this._chainAndAddress;
  }

  private session?: Session;
  private user?: UserDetails;
  get loggedIn(): boolean {
    return !!this.user;
  }

  private isVerifiedForType(verificationType: VerificationType): boolean {
    return (
      this.user?.verification_requests.some(
        (req) => req.verification_type === verificationType && req.status === 'Verified',
      ) || false
    );
  }

  private getVerificationStatusByType(): VerificationStasusByType {
    const status: VerificationStasusByType = {};
    for (const verificationType of VerificationTypes) {
      status[verificationType] = this.isVerifiedForType(verificationType);
    }
    return status;
  }

  private isVerified(): boolean {
    for (const verificationType of VerificationTypes) {
      if (this.isVerifiedForType(verificationType)) {
        return true;
      }
    }
    return false;
  }

  private verificationStatus: VerificationStatus;

  private static validateBlockchainNetworks(
    blockchainNetworks: BlockchainNetwork[],
  ): BlockchainNetwork[] {
    const errorPrefix = 'kycDAO SDK';
    const [validBlockchainNetworks, invalidBlockchainNetworks] = partition(
      [...new Set(blockchainNetworks)],
      (network) => BlockchainNetworks.includes(network),
    );

    if (invalidBlockchainNetworks.length > 0) {
      throw new Error(
        `${errorPrefix} - Invalid network(s) found in configuration: ${invalidBlockchainNetworks.join(
          ', ',
        )}. Valid values are: ${BlockchainNetworks.join(', ')}.`,
      );
    }

    if (!validBlockchainNetworks.length) {
      throw new Error(
        `${errorPrefix} - No valid networks found in configuration. Valid values are: ${BlockchainNetworks.join(
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
    const [validVerificationTypes, invalidVerificationTypes] = partition(
      [...new Set(verificationTypes)],
      (verificationType) => VerificationTypes.includes(verificationType),
    );

    if (invalidVerificationTypes.length > 0) {
      throw new Error(
        `${errorPrefix} - Invalid verification type(s) found in configuration: ${invalidVerificationTypes.join(
          ', ',
        )}. Valid values are: ${VerificationTypes.join(', ')}.`,
      );
    }

    if (!validVerificationTypes.length) {
      throw new Error(
        `${errorPrefix} - No valid verification type found in configuration. Valid values are: ${VerificationTypes.join(
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

    // verification type validation
    const verificationType = verificationData.verificationType;
    if (!VerificationTypes.includes(verificationType)) {
      throw new Error(
        `Invalid verificationType. Valid values are: ${VerificationTypes.join(', ')}.`,
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
    const country = countries.find(
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
      contractName,
    };

    // there can be only one Near network, so if lenght > 1 there is something else, do not load the Near wallet automatically
    if (this.blockchainNetworks.length === 1 && this.near.wallet.isSignedIn()) {
      const address: string = this.near.wallet.getAccountId();
      this._chainAndAddress = {
        blockchain: 'Near',
        address,
      };
    }
  }

  constructor(config: SdkConfiguration) {
    if (!KycDaoEnvironments.includes(config.environment)) {
      throw new Error(
        `kycDAO SDK - Invalid environment value found in configuration: ${
          config.environment
        }. Valid values are: ${KycDaoEnvironments.join(', ')}.`,
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

  // A test method to check configuration and backend access.
  public async getServerStatus(): Promise<ServerStatus> {
    let apiStatus: string;

    try {
      const status = await this.get<ApiStatus>('status');
      apiStatus = `${this.baseUrl} - current server time: ${status.current_time}`;
    } catch (e) {
      if (e instanceof Error) {
        apiStatus = e.message;
      } else {
        apiStatus = `Error: ${e}`;
      }
    }

    return {
      serverBaseUrl: this.baseUrl,
      apiStatus,
    };
  }

  // Method for checking NFT directly on chain with RPC.
  // !!! We have to document that it is not a safe check on the frontend and has to be verified on their backend to be sure !!!
  // Needs chain (selected from supported list) and wallet address - from method params or the current session, either works.
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

  // this method or init after redirect should create session and user in backend
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

  // This creates a session and user for the connected wallet, or log them in.
  // A session cookie will be saved.
  // TODO maybe split this up?
  public async registerOrLogin(): Promise<void> {
    if (this._chainAndAddress) {
      this.session = await this.post<Session>('session', this._chainAndAddress);

      if (!this.session.user) {
        const errorPrefix = 'kycDAO registration error';
        const toSign = `kycDAO-login-${this.session.nonce}`;
        let signature: Signature;

        switch (this._chainAndAddress.blockchain) {
          case 'Near':
            if (this.near) {
              const key = await this.near.keyStore.getKey(
                this.near.wallet.account().connection.networkId,
                this.near.wallet.getAccountId(),
              );
              signature = key.sign(Buffer.from(toSign));
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
  // This step updates the User in the backend with the data we require before verification/minting which are:
  // email, tax residency (from provided list), legal entity or not, privacy policy + terms accepted, verification type (KYC or KYB)
  // TODO backend support for already confirmed emails.
  // TODO backend support for verification type? Probably not, but we will use it for provider selection/configuration.
  // TODO Add tier level later as optional.

  // VERIFICATION PROCESS
  // Start Persona (or other 3rd party verification provider) flow.
  // The provider will be configurable later.
  public async startVerification(
    verificationData: VerificationData,
    providerOptions?: VerificationProviderOptions,
  ): Promise<void> {
    verificationData = this.validateVerificationData(verificationData);

    const user = await this.put<UserDetails>('user', verificationData);
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

  // this method can be used to poll the backend, refreshing the user session and checking for the verification status
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

  // get the URL of the identicon that will be saved into the next minted NFT for the current user
  // the URL is static and always returns the currently generated image for the user
  public getNftImageUrl(): string {
    return this.url('token/identicon');
  }

  // generate a new identicon for the user, the image has to be force-reloaded after the change
  public async regenerateNftImage(): Promise<void> {
    await this.request<string>('token/identicon', { method: 'POST' });
  }

  // TODO later: more NFT image selection options: URL? File upload? We provide options the 3rd party site can implement a selector for?

  // TODO extract account to a class property?
  private getValidAuthorizationCode(): string | undefined {
    if (this._chainAndAddress && this.user) {
      const account = this.user.blockchain_accounts.find(
        (account) =>
          this._chainAndAddress &&
          account.blockchain === this._chainAndAddress.blockchain &&
          account.address === this._chainAndAddress?.address,
      );

      return account?.tokens.find((token) => {
        token.authorization_tx_id && !token.minted_at;
      })?.authorization_code;
    }

    return undefined;
  }

  // We have to call the backend to authorize minting for the wallet, wait/poll for the result
  // Mint through wallet
  public async startMinting(mintingData: MintingData): Promise<void> {
    if (!mintingData.disclaimerAccepted) {
      throw new Error('Disclaimer must be accepted.');
    }

    if (!this.isVerified()) {
      throw new Error('User must be verified to be able to mint an NFT.');
    }

    // TODO
    // 1.  Update disclaimer accepted
    // 2.  check account for an existing valid auth code
    // 3.a if there is no valid code call authorize minting
    // 3.b poll NEAR transaction status, wait until done
    // 4.  Mint (handle callback?)

    return;
  }

  /*
   * We need to receive the transaction id from the 3rd party site and return it to the backend? That sounds like a risk.
   */
}
