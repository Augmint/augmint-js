const { assert } = require("chai");
const { Augmint, utils } = require("../dist/index.js");
const loadEnv = require("./testHelpers/loadEnv.js");

const CCY = "EUR";

const config = loadEnv();

if (config.LOG) {
    utils.logger.level = config.LOG;
}

describe("AugmintToken connection", () => {
    let augmint;
    before(async () => {
        augmint = await Augmint.create(config);
    });

    it("should connect to latest contract", async () => {
        const peggedSymbol = await augmint.token.peggedSymbol;

        assert.equal(peggedSymbol, CCY);
    });

    it("should connect to supported legacy AugmintToken contracts", () => {
        const legacyAddresses = Augmint.constants.SUPPORTED_LEGACY_AUGMINTTOKENS[augmint.deployedEnvironment.name];

        const legacyContracts = augmint.getLegacyTokens(legacyAddresses);

        const connectedAddresses = legacyContracts.map(lm => lm.address.toLowerCase());
        const lowerCaseLegacyAddresses = legacyAddresses.map(addr => addr.toLowerCase());

        assert.deepEqual(connectedAddresses, lowerCaseLegacyAddresses);
    });
});
