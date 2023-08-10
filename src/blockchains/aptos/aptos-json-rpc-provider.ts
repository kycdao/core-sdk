import { Catch, InternalError, KycDaoSDKError } from '../../errors';
import {
  AptosBlockchainNetwork,
  NetworkAndAddress,
  NftCheckResponse,
  TokenMetadata,
  Transaction,
} from '../../types';
import { ipfsToHttps } from '../../utils';
import { IKycDaoJsonRpcProvider } from '../kycdao-json-rpc-provider';
import { Provider, Types } from 'aptos';
import { NetworkMapping } from './aptos-provider-wrapper';

export class AptosJsonRpcProvider implements IKycDaoJsonRpcProvider {
  private contractAddress: string;
  private provider: Provider;
  constructor(contractAddress: string, network: AptosBlockchainNetwork) {
    this.contractAddress = contractAddress;
    this.provider = new Provider(NetworkMapping[network]);
  }

  public async getTransaction(txHash: string): Promise<Transaction> {
    try {
      if (await this.provider.transactionPending(txHash)) {
        return {
          status: 'Started',
        };
      }

      const tx = (await this.provider.getTransactionByHash(txHash)) as Types.UserTransaction;
      if (tx.success) {
        const event = tx.events.find((event) => event.type === '0x4::collection::MintEvent');

        return {
          status: 'Success',
          data: event ? event.data.token : null,
        };
      } else {
        return {
          status: 'Failure',
        };
      }
    } catch (e) {
      // TODO: Is an error thrown when the tx doesn't exist yet?
      throw new InternalError(`Transaction ${txHash} doesn't exist`);
    }
  }

  public async hasValidNft(targetAddress: string): Promise<boolean> {
    const resp = await this.provider.view({
      function: this.contractAddress + '::kycdao_sbt::has_valid_token',
      type_arguments: [],
      arguments: [targetAddress],
    });

    return resp[0] as boolean;
  }

  public async tokenAddrForOwner(targetAddress: string): Promise<string> {
    const resp = await this.provider.view({
      function: this.contractAddress + '::kycdao_sbt::get_token_addr_from_acct',
      type_arguments: [],
      arguments: [targetAddress],
    });

    return resp[0] as string;
  }

  private async getTokenData(tokenAddr: string): Promise<TokenMetadata> {
    const tokenDataResp = await this.provider.getTokenData(tokenAddr, { tokenStandard: 'v2' });
    const tokenData = tokenDataResp.current_token_datas_v2[0];

    const resp = await fetch(tokenData.token_uri);
    const metadata = await resp.json();

    return {
      name: metadata.name,
      description: metadata.description,
      image: ipfsToHttps(metadata.image),
    };
  }

  @Catch()
  private async getValidNftsCore(targetAddress: NetworkAndAddress): Promise<NftCheckResponse> {
    const hasValidNft = await this.hasValidNft(targetAddress.address);

    if (hasValidNft) {
      const tokenAddr = await this.tokenAddrForOwner(targetAddress.address);
      const tokenData = await this.getTokenData(tokenAddr);

      return {
        networkAndAddress: targetAddress,
        hasValidNft: true,
        tokens: [tokenData],
      };
    } else {
      return {
        networkAndAddress: targetAddress,
        hasValidNft: false,
      };
    }
  }

  public async getValidNfts(targetAddress: NetworkAndAddress): Promise<NftCheckResponse> {
    try {
      return this.getValidNftsCore(targetAddress);
    } catch (e) {
      let error;

      if (e instanceof KycDaoSDKError) {
        error = e;
      } else {
        error = new InternalError(String(e));
      }
      const errorMessage = error.toString();

      return {
        networkAndAddress: targetAddress,
        error: errorMessage,
      };
    }
  }
}
