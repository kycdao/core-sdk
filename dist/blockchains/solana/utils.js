import { blob, Layout, offset, struct, u32 } from '@solana/buffer-layout';
import { PublicKey } from '@solana/web3.js';
import { web3 } from '@coral-xyz/anchor';
import { KYCDAO_STATUS_KYC_SEED, TOKEN_METADATA_PROGRAM_ID, } from './constants';
export function str(property) {
    return new WrappedLayout(vecU8(property), (data) => data.toString('utf-8'), (s) => Buffer.from(s, 'utf-8'), property);
}
export function publicKey(property) {
    return new WrappedLayout(blob(32), (b) => new PublicKey(b), (key) => key.toBuffer(), property);
}
export const getStatusId = async (receiver, programId) => {
    return (web3.PublicKey.findProgramAddressSync([Buffer.from(KYCDAO_STATUS_KYC_SEED), receiver.toBuffer()], programId));
};
export const getMetadata = async (mint) => {
    return (web3.PublicKey.findProgramAddressSync([
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
    ], TOKEN_METADATA_PROGRAM_ID))[0];
};
function vecU8(property) {
    const length = u32('length');
    const layout = struct([
        length,
        blob(offset(length, -length.span), 'data'),
    ]);
    return new WrappedLayout(layout, ({ data }) => Buffer.from(data), (data) => ({ data, length: data.length }), property);
}
class WrappedLayout extends Layout {
    constructor(layout, decoder, encoder, property) {
        super(layout.span, property);
        this.layout = layout;
        this.decoder = decoder;
        this.encoder = encoder;
        this.decoder = decoder;
        this.encoder = encoder;
    }
    decode(b, offset = 0) {
        return this.decoder(this.layout.decode(b, offset));
    }
    encode(src, b, offset = 0) {
        return this.layout.encode(this.encoder(src), b, offset);
    }
    getSpan(b, offset = 0) {
        return this.layout.getSpan(b, offset);
    }
}
//# sourceMappingURL=utils.js.map