var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Catch, InternalError, KycDaoSDKError } from '../../errors';
import { ipfsToHttps } from '../../utils';
import { hexDecodeToString, hexEncodeAddress, hexEncodeUint } from './utils';
export class EvmJsonRpcProvider {
    constructor(contractAddress, url) {
        this.contractAddress = contractAddress;
        this.url = url;
    }
    async fetchJsonRpc(args) {
        var _a;
        const payload = Object.assign({ jsonrpc: '2.0', id: 0 }, args);
        const headers = new Headers({
            'Content-type': 'application/json',
        });
        const request = {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        };
        try {
            const response = await fetch(this.url, request);
            const isJson = (_a = response.headers.get('content-type')) === null || _a === void 0 ? void 0 : _a.includes('application/json');
            if (!isJson) {
                throw new InternalError(`EVM RPC response is not JSON; url: ${this.url}; request: ${JSON.stringify(request)}; response: ${response}`);
            }
            const data = await response.json();
            if (data.error) {
                throw new InternalError(`EVM RPC response error; url: ${this.url}; request: ${JSON.stringify(request)}; error: ${JSON.stringify(data.error)}`);
            }
            return data.result;
        }
        catch (e) {
            throw new InternalError(`EVM RPC fetch error; url: ${this.url}; request: ${JSON.stringify(request)}; error: ${e}`);
        }
    }
    ethCall(data) {
        const to = this.contractAddress;
        return this.fetchJsonRpc({
            method: 'eth_call',
            params: [{ to, data }, 'latest'],
        });
    }
    async hasValidNft(targetAddress) {
        const sigHash = '0x9d267630';
        const addressPart = hexEncodeAddress(targetAddress, { padToBytes: 32 });
        const data = sigHash + addressPart;
        const result = await this.ethCall(data);
        return !!parseInt(result, 16);
    }
    async tokenOfOwnerByIndex(targetAddress, index) {
        const sigHash = '0x2f745c59';
        const addressPart = hexEncodeAddress(targetAddress, { padToBytes: 32 });
        const indexPart = hexEncodeUint(index, { padToBytes: 32 });
        const data = sigHash + addressPart + indexPart;
        const result = await this.ethCall(data);
        return parseInt(result, 16);
    }
    async tokenUri(tokenId) {
        const sigHash = '0xc87b56dd';
        const idPart = hexEncodeUint(tokenId, { padToBytes: 32 });
        const data = sigHash + idPart;
        const result = await this.ethCall(data);
        return hexDecodeToString(result);
    }
    async getValidNftsCore(targetAddress) {
        var _a;
        const hasValidNft = await this.hasValidNft(targetAddress.address);
        if (hasValidNft) {
            const tokenId = await this.tokenOfOwnerByIndex(targetAddress.address, 0);
            const tokenUri = await this.tokenUri(tokenId);
            const response = await fetch(ipfsToHttps(tokenUri));
            const isJson = (_a = response.headers.get('content-type')) === null || _a === void 0 ? void 0 : _a.includes('application/json');
            if (!isJson) {
                console.error(response);
                throw new InternalError('EVM token metadata is not JSON');
            }
            const data = await response.json();
            data.image = ipfsToHttps(data.image);
            return {
                networkAndAddress: targetAddress,
                hasValidNft: true,
                tokens: [data],
            };
        }
        else {
            return {
                networkAndAddress: targetAddress,
                hasValidNft: false,
            };
        }
    }
    async getValidNfts(targetAddress) {
        try {
            return this.getValidNftsCore(targetAddress);
        }
        catch (e) {
            let error;
            if (e instanceof KycDaoSDKError) {
                error = e;
            }
            else {
                error = new InternalError(String(e));
            }
            const errorMessage = error.toString();
            return {
                networkAndAddress: targetAddress,
                error: errorMessage,
            };
        }
    }
    async getGasPrice() {
        return parseInt(await this.fetchJsonRpc({
            method: 'eth_gasPrice',
        }), 16);
    }
    async getMaxPriorityFeePerGas() {
        return parseInt(await this.fetchJsonRpc({
            method: 'eth_maxPriorityFeePerGas',
        }), 16);
    }
    async getBaseFeePerGas() {
        const block = await this.fetchJsonRpc({
            method: 'eth_getBlockByNumber',
            params: ['latest', false],
        });
        return parseInt(block['baseFeePerGas'], 16);
    }
}
__decorate([
    Catch(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EvmJsonRpcProvider.prototype, "getValidNftsCore", null);
//# sourceMappingURL=evm-json-rpc-provider.js.map