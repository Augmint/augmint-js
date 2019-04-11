const Contract = require("./Contract.js");
const TokenAEurArtifact = require("./abiniser/abis/TokenAEur_ABI_2ea91d34a7bfefc8f38ef0e8a5ae24a5.json");

class AugmintToken extends Contract {
    constructor() {
        super();

        this.peggedSymbol = null;
        this.symbol = null;
        this.name = null;
        this.decimals = null;
        this.decimalsDiv = null;

        this.feeAccountAddress = null;

        this.contractArtifact = TokenAEurArtifact;
    }

    async connect(ethereumConnection, augmintTokenAddress) {
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
        (this.symbol = symbol), (this.decimals = decimals);
        this.decimalsDiv = 10 ** decimals;
        this.feeAccountAddress = feeAccountAddress;

        return this.instance;
    }
}

module.exports = AugmintToken;
