import Contract from "./Contract";
import EthereumConnection from "./EthereumConnection";

const TokenAEurArtifact = require("../abiniser/abis/TokenAEur_ABI_2ea91d34a7bfefc8f38ef0e8a5ae24a5.json");

export default class AugmintToken extends Contract {
    peggedSymbol: string;
    symbol: string;
    name: string;
    decimals: number;
    decimalsDiv: number;
    feeAccountAddress: string;
    readonly contractArtifact = TokenAEurArtifact;

    constructor() {
        super();
    }

    async connect(ethereumConnection: EthereumConnection, augmintTokenAddress?: any) {
        await super.connect(ethereumConnection, this.contractArtifact, augmintTokenAddress);

        const [bytes32PeggedSymbol, symbol, name, decimals, feeAccountAddress] = await Promise.all([
            this.instance.methods.peggedSymbol().call(),
            this.instance.methods.symbol().call(),
            this.instance.methods.name().call(),
            this.instance.methods.decimals().call(),
            this.instance.methods.feeAccount().call()
        ]);

        const peggedSymbolWithTrailing = this.web3.utils.toAscii(bytes32PeggedSymbol);
        this.peggedSymbol = peggedSymbolWithTrailing.substr(0, peggedSymbolWithTrailing.indexOf("\0"));

        this.name = name;
        this.symbol = symbol;
        this.decimals = decimals;
        this.decimalsDiv = 10 ** decimals;
        this.feeAccountAddress = feeAccountAddress;

        return this.instance;
    }
}