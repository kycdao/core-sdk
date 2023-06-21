import { EthereumUnits } from './types';
export function parseUnits(value, unit) {
    return value * 10 ** EthereumUnits[unit];
}
function applyHexEncodeOptions(hex, options) {
    const padToChars = (options === null || options === void 0 ? void 0 : options.padToBytes) ? Math.max(options.padToBytes, 0) * 2 : 0;
    return ((options === null || options === void 0 ? void 0 : options.addPrefix) ? '0x' : '') + hex.padStart(padToChars, '0');
}
export function hexEncodeString(input, options) {
    return applyHexEncodeOptions(Buffer.from(input, 'ascii').toString('hex'), options);
}
export function hexEncodeUint(uint, options) {
    return applyHexEncodeOptions(uint.toString(16), options);
}
export function hexEncodeAddress(address, options) {
    return applyHexEncodeOptions(removeHexPrefix(address), options);
}
export function removeHexPrefix(hex) {
    return hex.startsWith('0x') ? hex.slice(2) : hex;
}
export function hexDecodeToString(input, hasPrefix = true) {
    if (hasPrefix) {
        input = input.substring(2);
    }
    const offset = parseInt(input.substring(0, 64), 16) * 2;
    const length = parseInt(input.substring(offset, offset + 64), 16);
    input = input.substring(offset + 64);
    let str = '';
    for (let i = 0; i < length * 2; i += 2) {
        str += String.fromCharCode(parseInt(input.substring(i, i + 2), 16));
    }
    return str;
}
//# sourceMappingURL=utils.js.map