import { EthereumUnit, EthereumUnits, HexEncodeOptions } from './types';

export function parseUnits(value: number, unit: EthereumUnit): number {
  return value * 10 ** EthereumUnits[unit];
}

function applyHexEncodeOptions(hex: string, options?: HexEncodeOptions): string {
  const padToChars = options?.padToBytes ? Math.max(options.padToBytes, 0) * 2 : 0;
  return (options?.addPrefix ? '0x' : '') + hex.padStart(padToChars, '0');
}

export function hexEncodeString(input: string, options?: HexEncodeOptions): string {
  return applyHexEncodeOptions(Buffer.from(input, 'ascii').toString('hex'), options);
}

export function hexEncodeUint(uint: number, options?: HexEncodeOptions): string {
  return applyHexEncodeOptions(uint.toString(16), options);
}

export function hexEncodeAddress(address: string, options?: HexEncodeOptions): string {
  return applyHexEncodeOptions(removeHexPrefix(address), options);
}

export function removeHexPrefix(hex: string): string {
  return hex.startsWith('0x') ? hex.slice(2) : hex;
}

// IMPORTANT: this method is for decoding a single string response from an ABI method
export function hexDecodeToString(input: string, hasPrefix = true): string {
  if (hasPrefix) {
    input = input.substring(2);
  }

  // the first 32 bytes should contain the size of the offset until the start of the dynamic data in bytes
  const offset = parseInt(input.substring(0, 64), 16) * 2;

  // the first 32 bytes of the dynamic data should contain the length of the data in bytes (or the number of array elements in case of arrays)
  const length = parseInt(input.substring(offset, offset + 64), 16);

  // start decoding after the offset and the first 32 bytes containing the length
  input = input.substring(offset + 64);

  let str = '';

  // iterate over every byte (every 2 characters in the hexadecimal string), convert each to decimal and parse it as a character code and add it to the end of the parsed string
  // only do this until the length specified in the response itself because the last 32 byte part is padded with zeros from the right (parsing them could lead to trailing spaces)
  for (let i = 0; i < length * 2; i += 2) {
    str += String.fromCharCode(parseInt(input.substring(i, i + 2), 16));
  }

  return str;
}
