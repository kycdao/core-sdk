export class EvmResponseDecoder {
    log(input) {
        return Object.assign(Object.assign({}, input), { logIndex: parseInt(input.logIndex), transactionIndex: parseInt(input.transactionIndex), blockNumber: parseInt(input.blockNumber) });
    }
    transactionReceipt(input) {
        return Object.assign(Object.assign({}, input), { transactionIndex: parseInt(input.transactionIndex), blockNumber: parseInt(input.blockNumber), cumulativeGasUsed: parseInt(input.cumulativeGasUsed), gasUsed: parseInt(input.gasUsed), status: parseInt(input.status), logs: input.logs.map((log) => this.log(log)) });
    }
}
//# sourceMappingURL=evm-response-decoder.js.map