import { WalletAdapterNetwork, WalletReadyState, } from '@solana/wallet-adapter-base';
import { clusterApiUrl, Connection } from '@solana/web3.js';
import bs58 from 'bs58';
import { InternalError } from '../../errors';
import { isLike } from '../../utils';
const WalletAdapterNetworkMapping = {
    SolanaDevnet: WalletAdapterNetwork.Devnet,
    SolanaMainnet: WalletAdapterNetwork.Mainnet,
    SolanaTestnet: WalletAdapterNetwork.Testnet,
};
export class SolanaProviderWrapper {
    get blockchainNetwork() {
        return this._blockchainNetwork;
    }
    set adapter(adapter) {
        this._adapter = adapter;
    }
    get address() {
        var _a, _b;
        return (_b = (_a = this._adapter) === null || _a === void 0 ? void 0 : _a.publicKey) === null || _b === void 0 ? void 0 : _b.toBase58();
    }
    constructor(blockchainNetwork) {
        this._blockchainNetwork = blockchainNetwork;
        this._network = WalletAdapterNetworkMapping[blockchainNetwork];
        this._connection = new Connection(clusterApiUrl(this._network), 'processed');
    }
    get ready() {
        return (!!this._adapter &&
            (this._adapter.readyState === WalletReadyState.Installed ||
                this._adapter.readyState === WalletReadyState.Loadable));
    }
    get connected() {
        var _a;
        return !!((_a = this._adapter) === null || _a === void 0 ? void 0 : _a.connected);
    }
    async connect() {
        var _a;
        if (this.ready && !this.connected) {
            return (_a = this._adapter) === null || _a === void 0 ? void 0 : _a.connect();
        }
    }
    async disconnect() {
        var _a;
        if (this.ready && this.connected) {
            return (_a = this._adapter) === null || _a === void 0 ? void 0 : _a.disconnect();
        }
    }
    async signMessage(message) {
        if (!isLike(this._adapter)) {
            throw new InternalError('Solana wallet adapter not initialized');
        }
        if (!(typeof this._adapter.signMessage === 'function')) {
            throw new InternalError('Initialized wallet provider is unable to sign messages');
        }
        const signature = await this._adapter.signMessage(Buffer.from(message, 'utf-8'));
        return bs58.encode(signature);
    }
    async mint(toAddress, mintTransaction) {
        if (!this._adapter) {
            throw new InternalError('Solana wallet adapter not initialized');
        }
        if (toAddress.startsWith('0x')) {
            toAddress = toAddress.slice(2);
        }
        return await this._adapter.sendTransaction(mintTransaction, this._connection);
    }
    async getTransaction(txHash) {
        var _a, _b;
        try {
            const receipt = await this._connection.getTransaction(txHash, {
                commitment: 'finalized',
                maxSupportedTransactionVersion: 0,
            });
            if (receipt === null) {
                throw new InternalError(`Transaction ${txHash} doesn't exist`);
            }
            else {
                const postTokenBalances = (_a = receipt.meta) === null || _a === void 0 ? void 0 : _a.postTokenBalances;
                const status = ((_b = receipt.meta) === null || _b === void 0 ? void 0 : _b.err) === null ? 'Success' : 'Unknown';
                if (postTokenBalances && postTokenBalances.length === 1) {
                    const tokenAmount = postTokenBalances[0].uiTokenAmount;
                    if (tokenAmount.uiAmount === 1 && tokenAmount.decimals === 0) {
                        const tokenId = postTokenBalances[0].mint;
                        return {
                            status: status,
                            data: tokenId.toString(),
                        };
                    }
                    else {
                        return {
                            status: status,
                        };
                    }
                }
                else {
                    return {
                        status: status,
                    };
                }
            }
        }
        catch (e) {
            throw new InternalError(`Unexpected error while checking Solana transaction: ${e}`);
        }
    }
}
//# sourceMappingURL=solana-provider-wrapper.js.map