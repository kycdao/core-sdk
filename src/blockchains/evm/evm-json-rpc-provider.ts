import { IKycDaoJsonRpcProvider } from '../kycdao-json-rpc-provider';
import { EvmRequestArguments } from './types';

export class EvmJsonRpcProvider implements IKycDaoJsonRpcProvider {
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  public async fetchJsonRpc<T>(args: EvmRequestArguments): Promise<T> {
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

    const response = await fetch(this.url, request);
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : null;

    // TODO error handling

    return data?.result;
  }

  public async hasValidToken(contractAddress: string, targetAddress: string): Promise<boolean> {
    // signature hash of 'hasValidToken(address)' contract method signature (first 4 bytes of the keccak256 hash of the signature, prefixed with 0x)
    const sigHash = '0x9d267630';

    // as per the Solidity contract ABI specification, the hexadecimal address, without the 0x prefix, padded to 32 bytes with zeros
    const addressPart = (
      targetAddress.startsWith('0x') ? targetAddress.slice(2) : targetAddress
    ).padStart(64, '0');

    // the method signature hash followed by the encoded parameter values, concatenated into a single string
    const data = sigHash + addressPart;

    const result = await this.fetchJsonRpc<string>({
      method: 'eth_call',
      params: [{ to: contractAddress, data }, 'latest'],
    });

    // TODO error handling

    return !!parseInt(result, 16);
  }
}
