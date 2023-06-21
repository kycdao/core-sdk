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
import { Program, web3, BN, } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as SPLToken from "@solana/spl-token";
import { Connection, PublicKey } from '@solana/web3.js';
import * as idl from './ntnft.json';
import { getStatusId, getMetadata } from './utils';
import { Metadata } from "@metaplex-foundation/mpl-token-metadata";
export class SolanaJsonRpcProvider {
    constructor(contractAddress, url) {
        this.contractAddress = contractAddress;
        const connection = new Connection(url, 'confirmed');
        this.connection = connection;
        this.program = new Program(idl, contractAddress, { connection });
    }
    async getValidNftsCore(targetAddress) {
        if (await this.hasValidNft(targetAddress.address)) {
            return {
                networkAndAddress: targetAddress,
                hasValidNft: true,
                tokens: [await this.getTokenMetadata(targetAddress.address)],
            };
        }
        else {
            return {
                networkAndAddress: targetAddress,
                hasValidNft: false,
            };
        }
    }
    async getTokenMetadata(targetAddress) {
        const targetPubKey = new web3.PublicKey(targetAddress);
        const allTokens = await this.connection.getTokenAccountsByOwner(targetPubKey, {
            programId: TOKEN_PROGRAM_ID,
        });
        for (const t of allTokens.value) {
            const accountInfo = SPLToken.AccountLayout.decode(t.account.data);
            if (Number(accountInfo.amount) == 1 && accountInfo.state == SPLToken.AccountState.Frozen) {
                const mint = new PublicKey(accountInfo.mint);
                const metadataAcct = await getMetadata(mint);
                const mplMeta = await Metadata.fromAccountAddress(this.connection, metadataAcct);
                if (mplMeta.data.name.replace(/\0/g, '') == 'KYCDAO NFT') {
                    const metaResp = await fetch(mplMeta.data.uri);
                    const tokenMeta = await metaResp.json();
                    return tokenMeta;
                }
            }
        }
        throw new Error(`No valid NFT found for ${targetAddress}`);
    }
    async hasValidNft(targetAddress) {
        const targetPubKey = new web3.PublicKey(targetAddress);
        const programPubKey = new web3.PublicKey(this.contractAddress);
        const [statusId, _bump] = await getStatusId(targetPubKey, programPubKey);
        const statusAcct = await this.connection.getAccountInfo(statusId);
        if (!statusAcct) {
            return false;
        }
        const statusInfo = await this.program.account.kycDaoNftStatus.fetch(statusId);
        return (statusInfo.data.isValid && statusInfo.data.expiry > new BN(Date.now() / 1000));
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
], SolanaJsonRpcProvider.prototype, "getValidNftsCore", null);
//# sourceMappingURL=solana-json-rpc-provider.js.map