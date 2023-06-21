/// <reference types="node" />
import { Layout } from '@solana/buffer-layout';
import { PublicKey } from '@solana/web3.js';
import { web3 } from '@coral-xyz/anchor';
export declare function str(property: string): WrappedLayout<string, Buffer>;
export declare function publicKey(property: string): WrappedLayout<PublicKey, Uint8Array>;
export declare const getStatusId: (receiver: web3.PublicKey, programId: web3.PublicKey) => Promise<[PublicKey, number]>;
export declare const getMetadata: (mint: web3.PublicKey) => Promise<web3.PublicKey>;
declare class WrappedLayout<T, B> extends Layout<T> {
    private readonly layout;
    private readonly decoder;
    private readonly encoder;
    constructor(layout: Layout<B>, decoder: (b: B) => T, encoder: (t: T) => B, property: string);
    decode(b: Buffer, offset?: number): T;
    encode(src: T, b: Buffer, offset?: number): number;
    getSpan(b: Buffer, offset?: number): number;
}
export {};
