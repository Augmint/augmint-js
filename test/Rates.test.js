const { assert } = require("chai");
const BigNumber = require("bignumber.js");
const { Augmint, utils } = require("../dist/index.js");
const loadEnv = require("./testHelpers/loadEnv.js");
const { takeSnapshot, revertSnapshot } = require("./testHelpers/ganache.js");

const { AugmintJsError, ZeroRateError } = Augmint.Errors;
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

    it("should connect to legacy Rates contract");
});

describe("Rates getters", () => {
    const EXPECTED_RATE = 213.14;
    let snapshotId;
    let myAugmint;

    before(async () => {
        myAugmint = await Augmint.create(config);

        snapshotId = await takeSnapshot(myAugmint.ethereumConnection.web3);

        const BYTES_CCY = myAugmint.ethereumConnection.web3.utils.asciiToHex(CCY);
        const rates = myAugmint.rates;

        await rates.instance.methods.setRate(BYTES_CCY, EXPECTED_RATE * DECIMALS_DIV).send({
            from: myAugmint.ethereumConnection.accounts[0]
        });
    });

    after(async () => {
        await revertSnapshot(myAugmint.ethereumConnection.web3, snapshotId);
    });

    it("getBnEthFiatRate", async () => {
        const bnEthFiatRate = await myAugmint.rates.getBnEthFiatRate(CCY);
        assert.deepEqual(bnEthFiatRate, new BigNumber(EXPECTED_RATE * DECIMALS_DIV));
    });

    it("getEthFiatRate", async () => {
        const ethFiatRate = await myAugmint.rates.getEthFiatRate(CCY);
        assert.equal(ethFiatRate, EXPECTED_RATE);
    });

    it("getBnEthFiatRate - invalid ccy", async () => {
        await myAugmint.rates.getEthFiatRate("INVALID").catch(error => {
            assert.instanceOf(error, AugmintJsError);
            assert.instanceOf(error, ZeroRateError);
        });
    });

    it("getAugmintRate", async () => {
        const augmintRate = await myAugmint.rates.getAugmintRate(CCY);
        assert.equal(augmintRate.rate, EXPECTED_RATE);
        assert.deepEqual(augmintRate.bnRate, new BigNumber(EXPECTED_RATE * DECIMALS_DIV));
        assert.instanceOf(augmintRate.lastUpdated, Date);
    });

    it("getAugmintRate - invalid ccy", async () => {
        await myAugmint.rates.getAugmintRate("INVALID").catch(error => {
            assert.instanceOf(error, AugmintJsError);
            assert.instanceOf(error, ZeroRateError);
        });
    });
});

describe("Rates txs", () => {
    let myAugmint;
    let snapshotId;

    before(async () => {
        myAugmint = await Augmint.create(config);
    });

    beforeEach(async () => {
        snapshotId = await takeSnapshot(myAugmint.ethereumConnection.web3);
    });

    afterEach(async () => {
        await revertSnapshot(myAugmint.ethereumConnection.web3, snapshotId);
    });

    it("setRate");

    it("setRate = 0");

    it("setRate - invalid ccy");

    it("setRate - invalid price");
});
