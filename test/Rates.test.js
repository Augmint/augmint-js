const { assert } = require("chai");
const { Augmint, utils, Tokens } = require("../dist/index.js");
const loadEnv = require("./testHelpers/loadEnv.js");
const { takeSnapshot, revertSnapshot } = require("./testHelpers/ganache.js");

const config = loadEnv();
const CCY = "EUR";
const DECIMALS_DIV = 100;

if (config.LOG) {
    utils.logger.level = config.LOG;
}

describe("Rates connection", () => {
    it("should connect to latest contract", async () => {
        const myAugmint = await Augmint.create(config);

        assert.equal(myAugmint.rates.instance.options.address, "0xb0a2a8e846b66C7384F52635CECEf5280F766C8B");
    });
});

describe("Rates getters", () => {
    const EXPECTED_RATE = Tokens.of(213.14);
    let snapshotId;
    let myAugmint;

    before(async () => {
        myAugmint = await Augmint.create(config);

        snapshotId = await takeSnapshot(myAugmint.ethereumConnection.web3);

        const BYTES_CCY = myAugmint.ethereumConnection.web3.utils.asciiToHex(CCY);
        const rates = myAugmint.rates;

        await rates.instance.methods.setRate(BYTES_CCY, EXPECTED_RATE.toString()).send({
            from: myAugmint.ethereumConnection.accounts[0]
        });
    });

    after(async () => {
        await revertSnapshot(myAugmint.ethereumConnection.web3, snapshotId);
    });

    it("getEthFiatRate", async () => {
        const ethFiatRate = await myAugmint.rates.getEthFiatRate(CCY);
        assert(EXPECTED_RATE.eq(ethFiatRate));
    });

    it("getAugmintRate", async () => {
        const augmintRate = await myAugmint.rates.getAugmintRate(CCY);
        assert(EXPECTED_RATE.eq(augmintRate.rate));
        assert.instanceOf(augmintRate.lastUpdated, Date);
    });
});
