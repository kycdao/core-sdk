import { Catch, InternalError, KycDaoSDKError } from '../../errors';
import { IKycDaoJsonRpcProvider } from '../kycdao-json-rpc-provider';
import { NetworkAndAddress, NftCheckResponse } from '../../types';
import { ipfsToHttps } from '../../utils';
import { EvmRequestArguments } from './types';
import { hexDecodeToString, hexEncodeAddress, hexEncodeUint } from './utils';

interface EVMTokenMetadata {
  name: string;
  description: string;
  image: string;
}

export class EvmJsonRpcProvider implements IKycDaoJsonRpcProvider {
  private contractAddress: string;
  private url: string;

  constructor(contractAddress: string, url: string) {
    this.contractAddress = contractAddress;
    this.url = url;
  }

  private async fetchJsonRpc<T>(args: EvmRequestArguments): Promise<T> {
    const payload = {
      jsonrpc: '2.0',
      id: 0,
      ...args,
    };

    const headers = new Headers({
      'Content-type': 'application/json',
    });

    const request: RequestInit = {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    };

    try {
      const response = await fetch(this.url, request);
      const isJson = response.headers.get('content-type')?.includes('application/json');

      if (!isJson) {
        throw new InternalError(
          `EVM RPC response is not JSON; url: ${this.url}; request: ${JSON.stringify(
            request,
          )}; response: ${response}`,
        );
      }

      const data = await response.json();

      if (data.error) {
        throw new InternalError(
          `EVM RPC response error; url: ${this.url}; request: ${JSON.stringify(
            request,
          )}; error: ${JSON.stringify(data.error)}`,
        );
      }

      return data.result;
    } catch (e) {
      throw new InternalError(
        `EVM RPC fetch error; url: ${this.url}; request: ${JSON.stringify(request)}; error: ${e}`,
      );
    }
  }

  private ethCall(data: string): Promise<string> {
    const to = this.contractAddress;
    return this.fetchJsonRpc<string>({
      method: 'eth_call',
      params: [{ to, data }, 'latest'],
    });
  }

  public async hasValidNft(targetAddress: string): Promise<boolean> {
    // signature hash of 'hasValidToken(address)' contract method signature (first 4 bytes of the keccak256 hash of the signature, prefixed with 0x)
    const sigHash = '0x9d267630';

    // as per the Solidity contract ABI specification, the hexadecimal address, without the 0x prefix, padded to 32 bytes with zeros
    const addressPart = hexEncodeAddress(targetAddress, { padToBytes: 32 });

    // the method signature hash followed by the encoded parameter values, concatenated into a single string
    const data = sigHash + addressPart;

    const result = await this.ethCall(data);

    return !!parseInt(result, 16);
  }

  private async tokenOfOwnerByIndex(targetAddress: string, index: number): Promise<number> {
    // signature hash of 'tokenOfOwnerByIndex(address,uint256)' contract method signature (first 4 bytes of the keccak256 hash of the signature, prefixed with 0x)
    const sigHash = '0x2f745c59';

    const addressPart = hexEncodeAddress(targetAddress, { padToBytes: 32 });
    const indexPart = hexEncodeUint(index, { padToBytes: 32 });

    // the method signature hash followed by the encoded parameter values, concatenated into a single string
    const data = sigHash + addressPart + indexPart;

    const result = await this.ethCall(data);

    return parseInt(result, 16);
  }

  private async tokenUri(tokenId: number): Promise<string> {
    // signature hash of 'tokenURI(uint256)' contract method signature (first 4 bytes of the keccak256 hash of the signature, prefixed with 0x)
    const sigHash = '0xc87b56dd';

    const idPart = hexEncodeUint(tokenId, { padToBytes: 32 });

    // the method signature hash followed by the encoded parameter values, concatenated into a single string
    const data = sigHash + idPart;

    const result = await this.ethCall(data);

    return hexDecodeToString(result);
  }

  @Catch()
  private async getValidNftsCore(targetAddress: NetworkAndAddress): Promise<NftCheckResponse> {
    const hasValidNft = await this.hasValidNft(targetAddress.address);

    if (hasValidNft) {
      // get the ID of the first token of the user
      const tokenId = await this.tokenOfOwnerByIndex(targetAddress.address, 0);
      // get the URI pointing to the metadata of the token
      const tokenUri = await this.tokenUri(tokenId);
      // fetch the metadata
      const response = await fetch(ipfsToHttps(tokenUri));
      const isJson = response.headers.get('content-type')?.includes('application/json');

      if (!isJson) {
        console.error(response);
        throw new InternalError('EVM token metadata is not JSON');
      }

      const data: EVMTokenMetadata = await response.json();
      // convert the image URL to HTTPS in case it's IPFS
      data.image = ipfsToHttps(data.image);

      return {
        networkAndAddress: targetAddress,
        hasValidNft: true,
        tokens: [data],
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

  public async getGasPrice(): Promise<number> {
    return parseInt(
      await this.fetchJsonRpc<string>({
        method: 'eth_gasPrice',
      }),
      16,
    );
  }

  public async getMaxPriorityFeePerGas(): Promise<number> {
    return parseInt(
      await this.fetchJsonRpc<string>({
        method: 'eth_maxPriorityFeePerGas',
      }),
      16,
    );
  }

  public async getBaseFeePerGas(): Promise<number> {
    const block = await this.fetchJsonRpc<{ baseFeePerGas: string }>({
      method: 'eth_getBlockByNumber',
      params: ['latest', false],
    });
    return parseInt(block['baseFeePerGas'], 16);
  }
}
