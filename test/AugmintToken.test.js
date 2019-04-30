const { assert } = require("chai");
const { Augmint, utils } = require("../dist/src/index.js");

const CCY = "EUR";

const config = utils.loadEnv();

if (config.LOG) {
    utils.logger.level = config.LOG;
}

describe("AugmintToken connection", () => {
    it("should connect to latest contract", async () => {
        const myAugmint = await Augmint.create(config);

        const peggedSymbol = await myAugmint.token.peggedSymbol;


        assert.equal(peggedSymbol, CCY);
    });

    it("should connect to legacy AugmintToken contract");
});
