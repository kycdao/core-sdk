import { EthereumUnit, HexEncodeOptions } from './types';
export declare function parseUnits(value: number, unit: EthereumUnit): number;
export declare function hexEncodeString(input: string, options?: HexEncodeOptions): string;
export declare function hexEncodeUint(uint: number, options?: HexEncodeOptions): string;
export declare function hexEncodeAddress(address: string, options?: HexEncodeOptions): string;
export declare function removeHexPrefix(hex: string): string;
export declare function hexDecodeToString(input: string, hasPrefix?: boolean): string;
