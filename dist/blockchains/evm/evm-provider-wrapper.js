var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { EvmResponseDecoder } from './evm-response-decoder';
import { hexEncodeAddress, hexEncodeString, hexEncodeUint, removeHexPrefix } from './utils';
import { Catch, InternalError, TransactionError, WalletError, unwrapEVMError, } from '../../errors';
import { poll, TimeOutError } from '../../utils';
import BN from 'bn.js';
import { EvmJsonRpcProvider } from './evm-json-rpc-provider';
export class EvmProviderWrapper {
    constructor(provider, networkMetadata) {
        this.provider = provider;
        this.decoder = new EvmResponseDecoder();
        this.networkMetadata = networkMetadata;
    }
    isWalletConnect() {
        return !!this.provider.isWalletConnect;
    }
    async walletConnectEnable() {
        if (this.provider.isWalletConnect) {
            return await this.provider.enable();
        }
        else {
            throw new InternalError('Provider is not WalletConnect');
        }
    }
    async walletConnectDisconnect() {
        if (this.provider.isWalletConnect) {
            return await this.provider.disconnect();
        }
        else {
            throw new InternalError('Provider is not WalletConnect');
        }
    }
    async getTokenTransferEventHash() {
        if (!this.tokenTransferEventHash) {
            this.tokenTransferEventHash = await this.web3Sha3('Transfer(address,address,uint256)');
        }
        return this.tokenTransferEventHash;
    }
    async request(args, isNullable = false) {
        return this.provider.request(args).then((value) => {
            if (!isNullable && value == null) {
                throw new InternalError(`EVM provider request method '${args.method}' returned no value. This can indicate an unsupported Ethereum wallet browser extension or multiple conflicting extensions. Please make sure that you are only using a single, supported extension and try again.`);
            }
            return value;
        });
    }
    on(event, callback) {
        this.provider.on(event, callback);
    }
    async getAccounts() {
        return this.request({
            method: 'eth_accounts',
        });
    }
    async requestAccounts() {
        return this.request({
            method: 'eth_requestAccounts',
        });
    }
    async getChainId() {
        return this.request({
            method: 'eth_chainId',
        });
    }
    async switchNetwork(chainId) {
        return this.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId }],
        }, true);
    }
    async switchOrAddNetwork(networkDetails) {
        if (!networkDetails.chain_id) {
            throw new InternalError('switchOrAddNetwork error: chain ID for requested network is null');
        }
        try {
            await this.switchNetwork(hexEncodeUint(networkDetails.chain_id, { addPrefix: true }));
        }
        catch (error) {
            if (this.isChainMissingError(error)) {
                await this.addNetwork(networkDetails);
            }
            else {
                throw error;
            }
        }
    }
    isChainMissingError(e) {
        return e instanceof WalletError && e.errorCode === 'ChainMissing';
    }
    async addNetwork(networkDetails) {
        if (!networkDetails.chain_id) {
            throw new InternalError('addNetwork error: chain ID for requested network is null');
        }
        return this.request({
            method: 'wallet_addEthereumChain',
            params: [
                {
                    chainId: hexEncodeUint(networkDetails.chain_id, { addPrefix: true }),
                    blockExplorerUrls: [networkDetails.explorer.url],
                    chainName: networkDetails.name,
                    nativeCurrency: networkDetails.native_currency,
                    rpcUrls: networkDetails.rpc_urls,
                },
            ],
        }, true);
    }
    async personalSign(message, address) {
        return this.request({
            method: 'personal_sign',
            params: [hexEncodeString(message, { addPrefix: true }), address],
        });
    }
    async getGasPrice() {
        return this.request({
            method: 'eth_gasPrice',
        });
    }
    async web3Sha3(input) {
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
    isRepeatableError(error) {
        const err = unwrapEVMError(error);
        if (!err) {
            return false;
        }
        const { code, message } = err;
        const repeatableErrors = [
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
    async getSighash(functionSignature) {
        const web3Sha3 = await this.web3Sha3(functionSignature);
        return web3Sha3.substring(0, 10);
    }
    async estimateGas(data, toAddress, fromAddress, value) {
        return this.request({
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
    async sendTransaction(data, toAddress, fromAddress, maxFeePerGas, maxPriorityFeePerGas, gasLimit, value) {
        return this.request({
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
    async getTransactionReceipt(txHash) {
        const response = await this.request({
            method: 'eth_getTransactionReceipt',
            params: [txHash],
        }, true);
        return response ? this.decoder.transactionReceipt(response) : null;
    }
    async getMintingCostForCode(toAddress, fromAddress, authCode) {
        var _a;
        const authCodeEncoded = hexEncodeUint(parseInt(authCode), { padToBytes: 32 });
        const addressEncoded = hexEncodeAddress(fromAddress, { padToBytes: 32 });
        const sighash = await this.getSighash('getRequiredMintCostForCode(uint32,address)');
        const data = sighash + authCodeEncoded + addressEncoded;
        try {
            return await poll(() => this.request({
                method: 'eth_call',
                params: [
                    {
                        data: data,
                        to: toAddress,
                    },
                    'latest',
                ],
            }), 5000, 16, {
                retryOnErrorPredicate: (e) => this.isRepeatableError(e),
                useExponentialBackoff: false,
            });
        }
        catch (e) {
            if (e instanceof TimeOutError) {
                throw new TransactionError('MintingCostCalculationError', 'Timeout while calculating minting costs: ' + ((_a = e.wrappedError) === null || _a === void 0 ? void 0 : _a.message));
            }
            else {
                throw e;
            }
        }
    }
    async mint(toAddress, fromAddress, authCode) {
        var _a;
        const authCodeEncoded = hexEncodeUint(parseInt(authCode), { padToBytes: 32 });
        const mintCostHex = await this.getMintingCostForCode(toAddress, fromAddress, authCode);
        const mintCost = new BN(removeHexPrefix(mintCostHex), 'hex');
        const mintCostWithSlippage = mintCost.muln(1.1);
        const mintCostWithSlippageHex = '0x' + mintCostWithSlippage.toString('hex');
        const sighash = await this.getSighash('mintWithCode(uint32)');
        const data = sighash + authCodeEncoded;
        let gasLimitHex = null;
        try {
            gasLimitHex = await poll(() => this.estimateGas(data, toAddress, fromAddress, mintCostWithSlippageHex), 5000, 8, {
                retryOnErrorPredicate: (e) => this.isRepeatableError(e),
                useExponentialBackoff: false,
            });
        }
        catch (e) {
            if (e instanceof TimeOutError) {
                throw new TransactionError('GasEstimationError', 'Timeout while estimating gas' + ((_a = e.wrappedError) === null || _a === void 0 ? void 0 : _a.message));
            }
            else {
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
                }
                catch (e) {
                    if (i > 0) {
                        console.log(`Error while fetching fee: ${e}`);
                    }
                    else {
                        throw e;
                    }
                }
            }
        }
        else {
            throw new InternalError('Unable to load network metadata');
        }
        if (maxFee && maxPrioFee) {
            const maxFeeHex = hexEncodeUint(maxFee, {
                addPrefix: true,
            });
            const maxPrioFeeHex = hexEncodeUint(maxPrioFee, {
                addPrefix: true,
            });
            const txHash = await this.sendTransaction(data, toAddress, fromAddress, maxFeeHex, maxPrioFeeHex, gasLimitHex, mintCostWithSlippageHex);
            if (txHash !== hexEncodeUint(0, { addPrefix: true, padToBytes: 32 })) {
                return txHash;
            }
            else {
                return undefined;
            }
        }
        else {
            throw new InternalError('Unable to estimate gas');
        }
    }
    async getTokenIdFromReceipt(receipt) {
        const tokenTransferEventHash = await this.getTokenTransferEventHash();
        const tokenTransferLog = receipt.logs.find((log) => log.topics[0] === tokenTransferEventHash);
        if (tokenTransferLog) {
            const tokenIdRaw = tokenTransferLog.topics[3];
            return parseInt(tokenIdRaw).toString();
        }
        return;
    }
}
__decorate([
    Catch(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EvmProviderWrapper.prototype, "switchNetwork", null);
//# sourceMappingURL=evm-provider-wrapper.js.map