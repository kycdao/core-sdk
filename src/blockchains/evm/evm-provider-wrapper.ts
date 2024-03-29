import { EvmResponseDecoder } from './evm-response-decoder';
import {
  EvmProvider,
  EvmRequestArguments,
  EvmTransactionReceipt,
  EvmTransactionReceiptResponse,
} from './types';
import { hexEncodeAddress, hexEncodeString, hexEncodeUint, removeHexPrefix } from './utils';
import {
  Catch,
  EVMError,
  InternalError,
  TransactionError,
  WalletError,
  unwrapEVMError,
} from '../../errors';
import { NetworkMetadata } from '../../types';
import { poll, TimeOutError } from '../../utils';
import BN from 'bn.js';
import { EvmJsonRpcProvider } from './evm-json-rpc-provider';

export class EvmProviderWrapper {
  private provider: EvmProvider;
  private decoder: EvmResponseDecoder;
  private networkMetadata: NetworkMetadata[];

  private tokenTransferEventHash?: string;

  constructor(provider: EvmProvider, networkMetadata: NetworkMetadata[]) {
    this.provider = provider;
    this.decoder = new EvmResponseDecoder();
    this.networkMetadata = networkMetadata;
  }

  public isWalletConnect(): boolean {
    return !!this.provider.isWalletConnect;
  }

  public async walletConnectEnable(): Promise<string[]> {
    if (this.provider.isWalletConnect) {
      return await this.provider.enable();
    } else {
      throw new InternalError('Provider is not WalletConnect');
    }
  }

  public async walletConnectDisconnect(): Promise<void> {
    if (this.provider.isWalletConnect) {
      return await this.provider.disconnect();
    } else {
      throw new InternalError('Provider is not WalletConnect');
    }
  }

  private async getTokenTransferEventHash(): Promise<string> {
    if (!this.tokenTransferEventHash) {
      this.tokenTransferEventHash = await this.web3Sha3('Transfer(address,address,uint256)');
    }

    return this.tokenTransferEventHash;
  }

  public async request<T>(args: EvmRequestArguments, isNullable = false): Promise<T> {
    return this.provider.request<T>(args).then((value) => {
      if (!isNullable && value == null) {
        throw new InternalError(
          `EVM provider request method '${args.method}' returned no value. This can indicate an unsupported Ethereum wallet browser extension or multiple conflicting extensions. Please make sure that you are only using a single, supported extension and try again.`,
        );
      }

      return value;
    });
  }

  public on<T>(event: string, callback: (data: T) => void): void {
    this.provider.on(event, callback);
  }

  public async getAccounts(): Promise<string[]> {
    return this.request<string[]>({
      method: 'eth_accounts',
    });
  }

  public async requestAccounts(): Promise<string[]> {
    return this.request<string[]>({
      method: 'eth_requestAccounts',
    });
  }

  public async getChainId(): Promise<string> {
    return this.request<string>({
      method: 'eth_chainId',
    });
  }

  @Catch()
  public async switchNetwork(chainId: string): Promise<void> {
    return this.request(
      {
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }],
      },
      true,
    );
  }

  public async switchOrAddNetwork(networkDetails: NetworkMetadata): Promise<void> {
    // throw error if chainId is not provided
    if (!networkDetails.chain_id) {
      throw new InternalError('switchOrAddNetwork error: chain ID for requested network is null');
    }

    try {
      await this.switchNetwork(hexEncodeUint(networkDetails.chain_id, { addPrefix: true }));
    } catch (error) {
      if (this.isChainMissingError(error)) {
        await this.addNetwork(networkDetails);
      } else {
        throw error;
      }
    }
  }

  private isChainMissingError(e: unknown): boolean {
    return e instanceof WalletError && e.errorCode === 'ChainMissing';
  }

  public async addNetwork(networkDetails: NetworkMetadata): Promise<void> {
    if (!networkDetails.chain_id) {
      throw new InternalError('addNetwork error: chain ID for requested network is null');
    }

    return this.request(
      {
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: hexEncodeUint(networkDetails.chain_id, { addPrefix: true }),
            blockExplorerUrls: [networkDetails.explorer.url],
            chainName: networkDetails.name,
            // iconUrls: [], //?string[];
            nativeCurrency: networkDetails.native_currency,
            rpcUrls: networkDetails.rpc_urls,
          },
        ],
      },
      true,
    );
  }

  public async personalSign(message: string, address: string): Promise<string> {
    return this.request<string>({
      method: 'personal_sign',
      params: [hexEncodeString(message, { addPrefix: true }), address],
    });
  }

  public async getGasPrice(): Promise<number> {
    return this.request<number>({
      method: 'eth_gasPrice',
    });
  }

  public async web3Sha3(input: string): Promise<string> {
    switch (input) {
      case 'Transfer(address,address,uint256)':
        return '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      case 'mintWithCode(uint32)':
        return '0x71bff8e43607461eaf68af7b7bb306a32cbb13c4cdfe9a9f1a64f7832b050ae8';
      case 'getRequiredMintCostForCode(uint32,address)':
        return '0xf82bacf04f8cc3e49b7c065af00ec174710a0d8d0514c21a7c4cdffb661ce0f2';
      default:
        throw new InternalError('Unknown input.');
    }
  }

  private isRepeatableError(error: unknown): boolean {
    const err = unwrapEVMError(error);

    if (!err) {
      return false;
    }

    const { code, message } = err;

    const repeatableErrors: EVMError[] = [
      { code: 3, message: 'Unauthorized code' },
      { code: -32000, message: 'header not found' },
      { code: -32005, message: 'Try again after some time' },
    ];

    for (const err of repeatableErrors) {
      if (code === err.code && message.includes(err.message)) {
        console.log(`Repeatable error: ${message} (code: ${code})`);
        return true;
      }
    }

    console.log(`Non-repeatable error: ${message} (code: ${code})`);
    return false;
  }

  // functionSignature must be: the function name with the parenthesised list of parameter types, parameter types are split by a single comma, without any spaces
  // e.g.: foo(uint32,bool)
  public async getSighash(functionSignature: string): Promise<string> {
    const web3Sha3 = await this.web3Sha3(functionSignature);
    return web3Sha3.substring(0, 10); // the first 4 bytes of the Keccak hash of the ASCII form of the signature
  }

  public async estimateGas(data: string, toAddress: string, fromAddress: string, value: string) {
    return this.request<string>({
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
    maxFeePerGas: string,
    maxPriorityFeePerGas: string,
    gasLimit: string,
    value?: string,
  ): Promise<string> {
    return this.request<string>({
      method: 'eth_sendTransaction',
      params: [
        {
          data: data,
          to: toAddress,
          from: fromAddress,
          maxFeePerGas,
          maxPriorityFeePerGas,
          gas: gasLimit,
          value,
        },
      ],
    });
  }

  public async getTransactionReceipt(txHash: string): Promise<EvmTransactionReceipt | null> {
    const response = await this.request<EvmTransactionReceiptResponse | null>(
      {
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      },
      true,
    );

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

    try {
      return await poll(
        () =>
          this.request<string>({
            method: 'eth_call',
            params: [
              {
                data: data,
                to: toAddress,
              },
              'latest',
            ],
          }),
        5000,
        16,
        {
          retryOnErrorPredicate: (e) => this.isRepeatableError(e),
          useExponentialBackoff: false,
        },
      );
    } catch (e) {
      if (e instanceof TimeOutError) {
        throw new TransactionError(
          'MintingCostCalculationError',
          'Timeout while calculating minting costs: ' + e.wrappedError?.message,
        );
      } else {
        throw e;
      }
    }
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

    let gasLimitHex = null;

    try {
      gasLimitHex = await poll(
        () => this.estimateGas(data, toAddress, fromAddress, mintCostWithSlippageHex),
        5000,
        8,
        {
          retryOnErrorPredicate: (e) => this.isRepeatableError(e),
          useExponentialBackoff: false,
        },
      );
    } catch (e) {
      if (e instanceof TimeOutError) {
        throw new TransactionError(
          'GasEstimationError',
          'Timeout while estimating gas' + e.wrappedError?.message,
        );
      } else {
        throw e;
      }
    }
    const chainId = await this.getChainId();
    const networkMeta = this.networkMetadata.find((n) => n.chain_id === Number(chainId));

    let maxFee, maxPrioFee;
    if (networkMeta) {
      const jsonRpcProvider = new EvmJsonRpcProvider(toAddress, networkMeta.rpc_urls[0]);
      for (let i = 4; i >= 0; i--) {
        try {
          const baseFeePerGas = await jsonRpcProvider.getBaseFeePerGas();
          const prioFeePerGas = await jsonRpcProvider.getMaxPriorityFeePerGas();
          maxFee = baseFeePerGas * 2 + prioFeePerGas;
          maxPrioFee = prioFeePerGas;
          break;
        } catch (e) {
          if (i > 0) {
            console.log(`Error while fetching fee: ${e}`);
          } else {
            throw e;
          }
        }
      }
    } else {
      throw new InternalError('Unable to load network metadata');
    }

    if (maxFee && maxPrioFee) {
      const maxFeeHex = hexEncodeUint(maxFee, {
        addPrefix: true,
      });
      const maxPrioFeeHex = hexEncodeUint(maxPrioFee, {
        addPrefix: true,
      });

      const txHash = await this.sendTransaction(
        data,
        toAddress,
        fromAddress,
        maxFeeHex,
        maxPrioFeeHex,
        gasLimitHex,
        mintCostWithSlippageHex,
      );

      if (txHash !== hexEncodeUint(0, { addPrefix: true, padToBytes: 32 })) {
        return txHash;
      } else {
        return undefined;
      }
    } else {
      throw new InternalError('Unable to estimate gas');
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
