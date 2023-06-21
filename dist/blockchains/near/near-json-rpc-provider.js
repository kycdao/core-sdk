var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { JsonRpcProvider } from 'near-api-js/lib/providers';
import { Catch, InternalError, KycDaoSDKError } from '../../errors';
import { ipfsToHttps } from '../../utils';
export class NearJsonRpcProvider {
    constructor(contractAddress, url) {
        this.contractAddress = contractAddress;
        this.url = url;
        this.provider = new JsonRpcProvider({ url });
    }
    async callFunction(methodName, args) {
        const argsBase64 = Buffer.from(JSON.stringify(args)).toString('base64');
        try {
            const rawResult = await this.provider.query({
                request_type: 'call_function',
                account_id: this.contractAddress,
                method_name: methodName,
                args_base64: argsBase64,
                finality: 'final',
            });
            return JSON.parse(Buffer.from(rawResult.result).toString());
        }
        catch (e) {
            console.error(e);
            throw new InternalError('NEAR RPC query error');
        }
    }
    async hasValidNft(targetAddress) {
        const args = { address: targetAddress };
        return this.callFunction('has_valid_token', args);
    }
    async ntnftTokensForOwner(targetAddress) {
        const args = { account_id: targetAddress, from_index: '0', limit: 1 };
        return this.callFunction('ntnft_tokens_for_owner', args);
    }
    validateTokenMetadata(token) {
        const metadata = token.metadata;
        if (!metadata || !metadata.title || !metadata.description || !metadata.media) {
            throw new InternalError('NEAR token metadata is invalid');
        }
        return {
            name: metadata.title,
            description: metadata.description,
            image: ipfsToHttps(metadata.media),
        };
    }
    async getValidNftsCore(targetAddress) {
        const hasValidNft = await this.hasValidNft(targetAddress.address);
        if (hasValidNft) {
            const tokens = await this.ntnftTokensForOwner(targetAddress.address);
            if (!tokens.length) {
                throw new InternalError('NEAR account has no tokens while it should have at least one.');
            }
            const metadata = this.validateTokenMetadata(tokens[0]);
            return {
                networkAndAddress: targetAddress,
                hasValidNft: true,
                tokens: [metadata],
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
}
__decorate([
    Catch(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NearJsonRpcProvider.prototype, "getValidNftsCore", null);
//# sourceMappingURL=near-json-rpc-provider.js.map