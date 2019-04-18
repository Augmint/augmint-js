const { assert } = require("chai");
const { Augmint, utils } = require("../dist/index.js");
const { EthereumConnection, AugmintToken } = Augmint;

const CCY = "EUR";

const config = utils.loadEnv();

describe("AugmintToken connection", () => {
    const ethereumConnection = new EthereumConnection(config);

    it("should connect to latest contract", async () => {
        await ethereumConnection.connect();
        const tokenAEur = new AugmintToken();

        assert.isUndefined(tokenAEur.peggedSymbol);
        assert.isUndefined(tokenAEur.symbol);
        assert.isUndefined(tokenAEur.name);
        assert.isUndefined(tokenAEur.decimals);
        assert.isUndefined(tokenAEur.decimalsDiv);
        assert.isUndefined(tokenAEur.feeAccountAddress);
        assert.isNull(tokenAEur.address);

        await tokenAEur.connect(ethereumConnection);

        assert.equal(tokenAEur.peggedSymbol, CCY);
        assert.equal(tokenAEur.symbol, "AEUR");
        assert.equal(tokenAEur.name, "Augmint Euro");
        assert.equal(tokenAEur.address, "0xBbEcfF5Db2F9cCcc936895121802FC15053344c6");
        assert.equal(tokenAEur.decimals, 2);
        assert.equal(tokenAEur.decimalsDiv, 100);
        assert.equal(tokenAEur.feeAccountAddress, "0xf5EfCaA78f5656F7Ddc971BC5d51a08b5F161573");
    });

    it("should connect to legacy AugmintToken contract");
});
