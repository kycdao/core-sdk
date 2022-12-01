import { EvmResponseDecoder } from './evm-response-decoder';
import {
  EvmProvider,
  EvmRequestArguments,
  EvmTransactionReceipt,
  EvmTransactionReceiptResponse,
} from './types';
import {
  hexEncodeAddress,
  hexEncodeString,
  hexEncodeUint,
  parseUnits,
  removeHexPrefix,
} from './utils';
import BN from 'bn.js';

export class EvmProviderWrapper {
  private provider: EvmProvider;
  private decoder: EvmResponseDecoder;

  private tokenTransferEventHash?: string;

  constructor(provider: EvmProvider) {
    this.provider = provider;
    this.decoder = new EvmResponseDecoder();
  }

  public isWalletConnect(): boolean {
    return !!this.provider.isWalletConnect;
  }

  public async walletConnectEnable(): Promise<string[]> {
    if (this.provider.isWalletConnect) {
      return await this.provider.enable();
    } else {
      throw new Error('Provider is not WalletConnect');
    }
  }

  public async walletConnectDisconnect(): Promise<void> {
    if (this.provider.isWalletConnect) {
      return await this.provider.disconnect();
    } else {
      throw new Error('Provider is not WalletConnect');
    }
  }

  private async getTokenTransferEventHash(): Promise<string> {
    if (!this.tokenTransferEventHash) {
      this.tokenTransferEventHash = await this.web3Sha3('Transfer(address,address,uint256)');
    }

    return this.tokenTransferEventHash;
  }

  public request<T>(args: EvmRequestArguments): Promise<T> {
    return this.provider.request(args);
  }

  public on<T>(event: string, callback: (data: T) => void): void {
    this.provider.on(event, callback);
  }

  public async getAccounts(): Promise<string[]> {
    return await this.provider.request<string[]>({
      method: 'eth_accounts',
    });
  }

  public async requestAccounts(): Promise<string[]> {
    return await this.provider.request<string[]>({
      method: 'eth_requestAccounts',
    });
  }

  public async getChainId(): Promise<string> {
    return await this.provider.request<string>({
      method: 'eth_chainId',
    });
  }

  public async personalSign(message: string, address: string): Promise<string> {
    return this.provider.request<string>({
      method: 'personal_sign',
      params: [hexEncodeString(message, { addPrefix: true }), address],
    });
  }

  public async getGasPrice(): Promise<string> {
    return await this.provider.request<string>({
      method: 'eth_gasPrice',
    });
  }

  public async web3Sha3(input: string): Promise<string> {
    return this.provider.request<string>({
      method: 'web3_sha3',
      params: [hexEncodeString(input, { addPrefix: true })],
    });
  }

  // functionSignature must be: the function name with the parenthesised list of parameter types, parameter types are split by a single comma, without any spaces
  // e.g.: foo(uint32,bool)
  public async getSighash(functionSignature: string): Promise<string> {
    const web3Sha3 = await this.web3Sha3(functionSignature);
    return web3Sha3.substring(0, 10); // the first 4 bytes of the Keccak hash of the ASCII form of the signature
  }

  public async estimateGas(data: string, toAddress: string, fromAddress: string, value: string) {
    return await this.provider.request<string>({
      method: 'eth_estimateGas',
      params: [
        {
          data: data,
          to: toAddress,
          from: fromAddress,
          value: value,
        },
      ],
    });
  }

  public async sendTransaction(
    data: string,
    toAddress: string,
    fromAddress: string,
    gasPrice: string,
    gasLimit: string,
    value?: string,
  ): Promise<string> {
    return await this.provider.request<string>({
      method: 'eth_sendTransaction',
      params: [
        {
          data: data,
          to: toAddress,
          from: fromAddress,
          gasPrice: gasPrice,
          gas: gasLimit,
          value,
        },
      ],
    });
  }

  public async getTransactionReceipt(txHash: string): Promise<EvmTransactionReceipt | null> {
    const response = await this.provider.request<EvmTransactionReceiptResponse | null>({
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    });

    return response ? this.decoder.transactionReceipt(response) : null;
  }

  public async getMintingCostForCode(
    toAddress: string,
    fromAddress: string,
    authCode: string,
  ): Promise<string> {
    const authCodeEncoded = hexEncodeUint(parseInt(authCode), { padToBytes: 32 });
    const addressEncoded = hexEncodeAddress(fromAddress, { padToBytes: 32 });

    const sighash = await this.getSighash('getRequiredMintCostForCode(uint32,address)');
    const data = sighash + authCodeEncoded + addressEncoded;
    const mintCostRaw = await this.provider.request<string>({
      method: 'eth_call',
      params: [
        {
          data: data,
          to: toAddress,
        },
        'latest',
      ],
    });
    return mintCostRaw;
  }

  public async mint(
    toAddress: string,
    fromAddress: string,
    authCode: string,
  ): Promise<string | undefined> {
    const authCodeEncoded = hexEncodeUint(parseInt(authCode), { padToBytes: 32 });

    const mintCostHex = await this.getMintingCostForCode(toAddress, fromAddress, authCode);
    const mintCost = new BN(removeHexPrefix(mintCostHex), 'hex');

    // assume +10% slippage
    const mintCostWithSlippage = mintCost.muln(1.1);
    const mintCostWithSlippageHex = '0x' + mintCostWithSlippage.toString('hex');

    const sighash = await this.getSighash('mintWithCode(uint32)');
    const data = sighash + authCodeEncoded;

    const gasLimitHex = await this.estimateGas(
      data,
      toAddress,
      fromAddress,
      mintCostWithSlippageHex,
    );

    const providerGasPriceHex = await this.getGasPrice();
    const providerGasPriceDec = parseInt(providerGasPriceHex, 16);
    const minGasPriceDec = parseUnits(50, 'gwei');
    const gasPriceDec = Math.max(providerGasPriceDec, minGasPriceDec);
    const gasPriceHex = hexEncodeUint(gasPriceDec, {
      addPrefix: true,
    });

    const txHash = await this.sendTransaction(
      data,
      toAddress,
      fromAddress,
      gasPriceHex,
      gasLimitHex,
      mintCostWithSlippageHex,
    );

    if (txHash !== hexEncodeUint(0, { addPrefix: true, padToBytes: 32 })) {
      return txHash;
    } else {
      return undefined;
    }
  }

  public async getTokenIdFromReceipt(receipt: EvmTransactionReceipt): Promise<string | undefined> {
    const tokenTransferEventHash = await this.getTokenTransferEventHash();
    const tokenTransferLog = receipt.logs.find((log) => log.topics[0] === tokenTransferEventHash);

    if (tokenTransferLog) {
      const tokenIdRaw = tokenTransferLog.topics[3];
      return parseInt(tokenIdRaw).toString();
    }

    return;
  }
}
