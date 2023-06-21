/**
 * Utility functions to enhance @solana/buffer-layout with custom types when preparing solana call data
 */
import { blob, Layout, offset, struct, u32 } from '@solana/buffer-layout';
import { PublicKey } from '@solana/web3.js';
import { web3 } from '@coral-xyz/anchor'
import {
  KYCDAO_STATUS_KYC_SEED,
  TOKEN_METADATA_PROGRAM_ID,
} from './constants'

/**
 * Encodes and decodes an utf-8 string for solana function calls
 *
 * @param property
 * @returns
 */
export function str(property: string) {
  return new WrappedLayout(
    vecU8(property),
    (data: Buffer) => data.toString('utf-8'),
    (s: string) => Buffer.from(s, 'utf-8'),
    property,
  );
}

/**
 * Encodes and decodes a public key for solana function calls
 *
 * @param property
 * @returns
 */
export function publicKey(property: string) {
  return new WrappedLayout(
    blob(32),
    (b) => new PublicKey(b),
    (key) => key.toBuffer(),
    property,
  );
}

export const getStatusId = async (
  receiver: web3.PublicKey,
  programId: web3.PublicKey,
) => {
  return (
    web3.PublicKey.findProgramAddressSync(
      [Buffer.from(KYCDAO_STATUS_KYC_SEED), receiver.toBuffer()],
      programId,
    )
  )
}

export const getMetadata = async (
  mint: web3.PublicKey,
): Promise<web3.PublicKey> => {
  return (
    web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID,
    )
  )[0]
}

/**
 * Custom layout representing a fixed length 8-bit bytearray
 *
 * @param property
 * @returns
 */
function vecU8(property: string) {
  const length = u32('length');
  const layout = struct<{ length: number; data: Uint8Array }>([
    length,
    blob(offset(length, -length.span), 'data'),
  ]);
  return new WrappedLayout<Buffer, { length: number; data: Uint8Array }>(
    layout,
    ({ data }) => Buffer.from(data),
    (data) => ({ data, length: data.length }),
    property,
  );
}

// concept of WrapperLayout borrowed from project-serum/borsch library
class WrappedLayout<T, B> extends Layout<T> {
  constructor(
    private readonly layout: Layout<B>,
    private readonly decoder: (b: B) => T,
    private readonly encoder: (t: T) => B,
    property: string,
  ) {
    super(layout.span, property);
    this.decoder = decoder;
    this.encoder = encoder;
  }
  decode(b: Buffer, offset = 0): T {
    return this.decoder(this.layout.decode(b, offset));
  }
  encode(src: T, b: Buffer, offset = 0) {
    return this.layout.encode(this.encoder(src), b, offset);
  }
  override getSpan(b: Buffer, offset = 0): number {
    return this.layout.getSpan(b, offset);
  }
}
