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

export function hexDecodeToString(input: string, hasPrefix = true): string {
  if (hasPrefix) {
    input = input.substring(2);
  }

  let str = '';
  for (let i = 0; i < input.length; i += 2) {
    str += String.fromCharCode(parseInt(input.substring(i, 2), 16));
  }
  return str;
}
