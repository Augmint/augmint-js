import { Contract } from "./Contract";
import { EthereumConnection } from "./EthereumConnection";

import * as TokenAEurAbi from "../abiniser/abis/TokenAEur_ABI_2ea91d34a7bfefc8f38ef0e8a5ae24a5.json";
import { TokenAEur_ABI_2ea91d34a7bfefc8f38ef0e8a5ae24a5 as TokenAEurContract } from "../abiniser/types/TokenAEur_ABI_2ea91d34a7bfefc8f38ef0e8a5ae24a5";

export class AugmintToken extends Contract {
    public peggedSymbol: string;
    public symbol: string;
    public name: string;
    public decimals: number;
    public decimalsDiv: number;
    public feeAccountAddress: string;
    // overwrite Contract's  property to have typings
    public instance: TokenAEurContract; /** web3.js TokenAEur contract instance  */

    constructor() {
        super();
    }

    public async connect(ethereumConnection: EthereumConnection): Promise<void> {
        await super.connect(ethereumConnection, TokenAEurAbi);

        const [bytes32PeggedSymbol, symbol, name, decimals, feeAccountAddress]: [
            string,
            string,
            string,
            string,
            string
        ] = await Promise.all([
            this.instance.methods.peggedSymbol().call(),
            this.instance.methods.symbol().call(),
            this.instance.methods.name().call(),
            this.instance.methods.decimals().call(),
            this.instance.methods.feeAccount().call()
        ]);

        const peggedSymbolWithTrailing: string = this.web3.utils.toAscii(bytes32PeggedSymbol);
        this.peggedSymbol = peggedSymbolWithTrailing.substr(0, peggedSymbolWithTrailing.indexOf("\0"));

        this.name = name;
        this.symbol = symbol;
        this.decimals = parseInt(decimals);
        this.decimalsDiv = 10 ** this.decimals;
        this.feeAccountAddress = feeAccountAddress;
    }
}
