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
                    deployedAddress: "0xbbecff5db2f9cccc936895121802fc15053344c6"
                },
                {
                    abiFileName: "TokenAEur_ABI_2ea91d34a7bfefc8f38ef0e8a5ae24a5",
                    deployedAddress: "0x5d77f09a3703be84d84810379067a6d9ad759582"
                }
            ]
        });

        const myAugmint = await Augmint.create(config, env);

        const peggedSymbol = await myAugmint.token.peggedSymbol;
        const legacyTokens = myAugmint.getLegacyTokens();
        const legacyPeggedSymbol = await legacyTokens[0].peggedSymbol;

        assert.equal(legacyTokens.length, 1);
        assert.equal(peggedSymbol, CCY);
        assert.equal(legacyPeggedSymbol, CCY);
    });

    it("should list all loan products", async () => {
        const augmint = await Augmint.create(config);
        const loanProducts = await augmint.getLoanProducts(true);
        console.log(loanProducts)
    });

    it("should list all loans", async () => {
        const augmint = await Augmint.create(config);
//        const loans = await augmint.getLoansForAccount()
//        console.log(loans)

    })
});
