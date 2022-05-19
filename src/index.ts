import { ConnectConfig, keyStores, Near, WalletConnection } from 'near-api-js';
import { Signature } from 'near-api-js/lib/utils/key_pair';
import { base_encode } from 'near-api-js/lib/utils/serialize';
import { ApiBase } from './api-base';
import { BlockchainNetworks, NEAR_TESTNET_CONFIG, VerificationTypes } from './constants';
import {
  ApiStatus,
  Blockchain,
  BlockchainNetwork,
  ChainAndAddress,
  MintingData,
  NearSdk,
  NftImage,
  SdkConfiguration,
  ServerStatus,
  Session,
  UserDetails,
  VerificationData,
  VerificationType,
} from './types';

export { ConnectConfig as NearConnectConfig } from 'near-api-js';
export {
  Blockchain,
  BlockchainNetwork,
  Country,
  NftImage,
  MintingData,
  SdkConfiguration,
  ServerStatus,
  VerificationData,
  VerificationProvider,
  VerificationType,
  WalletProvider,
} from './types';

function partition<T>(arr: T[], predicate: (_: T) => boolean): [T[], T[]] {
  const partitioned: [T[], T[]] = [[], []];
  arr.forEach((val: T) => {
    partitioned[predicate(val) ? 0 : 1].push(val);
  });
  return partitioned;
}

export class KycDao extends ApiBase {
  private verificationTypes: VerificationType[];
  private blockchainNetworks: BlockchainNetwork[];

  private near?: NearSdk;
  get nearConfig(): ConnectConfig | undefined {
    return this.near?.config;
  }

  private _chainAndAddress: ChainAndAddress | undefined;
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
        )}. Valid values are: ${BlockchainNetworks.join(', ')}.`,
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

  // we will need something like this when using wallet connections without redirect
  private syncWalletWithUserAndSession(): void {
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
    config.enbaledBlockchainNetworks = KycDao.validateBlockchainNetworks(
      config.enbaledBlockchainNetworks,
    );

    config.enbaledVerificationTypes = KycDao.validateVerificationTypes(
      config.enbaledVerificationTypes,
    );

    super(config);

    this.blockchainNetworks = config.enbaledBlockchainNetworks;
    this.verificationTypes = config.enbaledVerificationTypes;

    const nearNetwork = this.blockchainNetworks.find((network) => network.startsWith('Near'));
    if (nearNetwork) {
      this.initNear(nearNetwork);
    }
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

  // This creates a session and user for the connected wallet, or log them in.
  // A session cookie will be saved.
  // TODO maybe split this up?
  public async registerOrLogin(): Promise<void> {
    if (this._chainAndAddress) {
      try {
        this.session = await this.post<Session>('session', this._chainAndAddress);
      } catch (e) {
        console.log(`kycDAO session creation error: ${e}`);
        throw e;
      }
      console.log('kycDAO Session created: \n' + JSON.stringify(this.session, null, 2));

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
        return console.log(
          'kycDAO User after registration/login: \n' + JSON.stringify(user, null, 2),
        );
      }

      return console.log(
        'kycDAO User already in session: \n' + JSON.stringify(this.session.user, null, 2),
      );
    }

    return console.log(
      'Cannot register or log in to kycDAO: blockchain and address is not specified (no connected wallet).',
    );
  }

  // we can ask the backend to send the email but verification is not currently required for minting (but probably will be in the future)
  private async sendEmailConfirmationCode(): Promise<void> {
    return;
  }

  // VERIFICATION DATA
  // TODO add validation to the beginning
  // This step should update the User in the backend with the data we require before verification/minting which are:
  // email, tax residency (we should provide a list), legal entity or not, privacy policy + terms accepted, verification type (KYC or KYB)
  // Other things:
  // TODO Email already confirmed -> needs backend support.
  // TODO Add tier level later as optional.

  // VERIFICATION PROCESS
  // Start Persona (or other 3rd party verification provider) flow.
  // The provider could be configurable later.
  // For Persona: we need to load their script, initialize the client with a Persona template id and we will need the User ext_id.
  // We have to poll the backend for the Persona callback.
  // After successful verification we have to call the backend to authorize minting for the wallet.
  public async startVerification(verificationData: VerificationData): Promise<void> {
    return;
  }

  public async getNftImageOptions(): Promise<NftImage[]> {
    return [];
  }

  /*
   * We may want an NFT image regenerator method later. Or getter can return a new set every time.
   */

  // We need an NFT image in some way.
  // First: use the default generated one.
  // Later: URL? File upload? We provide options the 3rd party site can implement a selector for?
  // !!! We also need confirmation that our disclaimer got signed for liability management. !!!
  // Mint through wallet
  public async startMinting(mintingData: MintingData): Promise<void> {
    return;
  }

  /*
   * We need to receive the transaction id from the 3rd party site and return it to the backend? That sounds like a risk.
   */
}
