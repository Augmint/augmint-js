const { assert } = require("chai");
const { Augmint, utils } = require("../dist/index.js");
const loadEnv = require("./testHelpers/loadEnv.js");

const config = loadEnv();
const CCY = "EUR";

if (config.LOG) {
    utils.logger.level = config.LOG;
}

describe("Test Augmint interfaces", () => {
    it("should create environment", async () => {
        const env = Augmint.generateDeploymentEnvironment("test", {
            TokenAEur: [
                {
                    abiFileName: "TokenAEur_ABI_2ea91d34a7bfefc8f38ef0e8a5ae24a5",
                    current: false,
                    deployedAddress: "0x5d77f09a3703be84d84810379067a6d9ad759582"
                },
                {
                    abiFileName: "TokenAEur_ABI_2ea91d34a7bfefc8f38ef0e8a5ae24a5",
                    current: true,
                    deployedAddress: "0xbbecff5db2f9cccc936895121802fc15053344c6"
                }
            ]
        });

        const myAugmint = await Augmint.create(config,env);

        const peggedSymbol = await myAugmint.token.peggedSymbol;
        const legacyTokens = myAugmint.getLegacyTokens();
        const legacyPeggedSymbol = await legacyTokens[0].peggedSymbol;

        assert.equal(legacyTokens.length,1);
        assert.equal(peggedSymbol, CCY);
        assert.equal(legacyPeggedSymbol, CCY);

    });
});
