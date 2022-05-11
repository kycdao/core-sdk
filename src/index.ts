import { ApiBase } from './api-base';
import { ApiStatus, ChainAndAddress, ServerStatus, VerificationData } from './types';

export { Configuration } from './api-base';
export { Blockchain, ServerStatus, VerificationData, VerificationType } from './types';

export class KycDao extends ApiBase {
  private _chainAndAddress: ChainAndAddress | undefined;

  get chainAndAddress(): ChainAndAddress | undefined {
    return this._chainAndAddress;
  }

  // We will probably need to store Session/User data received from backend.

  // A test method to check configuration and backend access.
  public async getServerStatus(): Promise<ServerStatus> {
    let apiStatus: string;

    try {
      const status = await this.get<ApiStatus>('status');
      apiStatus = `OK - current server time: ${status.current_time}`;
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

  // This should create a session for the provided chain + address.
  // Response should be saved in this object probably + cookie will be created.
  // Return type depends on what we want to share with the integrating party (probably not much).
  // TODO should we do the verification and user creation as well in one step?
  public async connect(chainAdnAddress: ChainAndAddress): Promise<unknown> {
    this._chainAndAddress = chainAdnAddress;
    return;
  }

  /*
   * TODO figure out connected address signing/verification
   */

  // This step should update the User in the backend with the data we require before verification/minting which are:
  // email, tax residency (we should provide a list), legal entity or not, privacy policy + terms accepted (either ours or as part of the 3rd party's), verification type (KYC or KYB)
  // ToS+PP and verification type are not sent to backend currently
  // Other things:
  // Email confirmed or not? If not, SDK can initiate verification. If we accept already verified we need a way to tell it to our backend.
  // What about tiering? We can probably add it later as optional, and our tokens will have a default tier verification.
  public async updateVerificationData(verificationData: VerificationData): Promise<void> {
    return;
  }

  // This should (re)send email confirmation code for the user's email address.
  // I don't know if we need this as a public separate method, maybe for resending? We need a verified email to proceed in the flow.
  public async sendEmailConfirmationCode(): Promise<void> {
    return;
  }

  // Start Persona (or other 3rd party verification provider) flow.
  // The provider could be configurable later.
  // For Persona: we need to load their script, initialize the client with a template id (is it a secret? per env?) and we will need the User ext_id.
  // Is the modal open until the verification is complete? Do we have to poll the backend for the successful callback?
  // After successful verification we have to call the backend to authorize minting for the wallet.
  public async startVerification(): Promise<void> {
    return;
  }

  /*
   * We may need image getter/regenerator methods.
   */

  // We need an NFT image in some way. URL? File upload? We use the default we generate? We provide options the 3rd party site can implement a selector for?
  // We also need confirmation that our disclaimer got signed for liability management.
  // Maybe we can merge this into the minting method below?
  public async updateMintingData(): Promise<void> {
    return;
  }

  // Mint through wallet
  public async startMinting(): Promise<void> {
    return;
  }

  /*
   * We need to receive the transaction id from the 3rd party site and return it to the backend? That sounds like a risk.
   */
}
