const { assert } = require("chai");
const BigNumber = require("bignumber.js");
const { Augmint, utils } = require("../dist/index.js");
const { EthereumConnection, Rates } = Augmint;

const config = utils.loadEnv();
const { takeSnapshot, revertSnapshot } = require("./testHelpers/ganache.js");
const CCY = "EUR";
const DECIMALS_DIV = 100;

if (config.LOG) {
    utils.logger.level = config.LOG;
}

describe("Rates connection", () => {
    const ethereumConnection = new EthereumConnection(config);
    const rates = new Rates();

    it("should connect to latest contract", async () => {
        await ethereumConnection.connect();

        assert.isNull(rates.address);
        await rates.connect(ethereumConnection);
        assert.equal(rates.address, "0xb0a2a8e846b66C7384F52635CECEf5280F766C8B");
    });

    it("should connect to legacy Rates contract");
});

describe("Rates getters", () => {
    const ethereumConnection = new EthereumConnection(config);
    const rates = new Rates();
    const EXPECTED_RATE = 213.14;
    let snapshotId;

    before(async () => {
        await ethereumConnection.connect();

        snapshotId = await takeSnapshot(ethereumConnection.web3);

        await rates.connect(ethereumConnection);
        const BYTES_CCY = ethereumConnection.web3.utils.asciiToHex(CCY);

        await rates.instance.methods.setRate(BYTES_CCY, EXPECTED_RATE * DECIMALS_DIV).send({
            from: ethereumConnection.accounts[0]
        });
    });

    after(async () => {
        await revertSnapshot(ethereumConnection.web3, snapshotId);
    });

    it("getBnEthFiatRate", async () => {
        const bnEthFiatRate = await rates.getBnEthFiatRate(CCY);
        assert.deepEqual(bnEthFiatRate, new BigNumber(EXPECTED_RATE));
    });

    it("getEthFiatRate", async () => {
        const ethFiatRate = await rates.getEthFiatRate(CCY);
        assert.equal(ethFiatRate, EXPECTED_RATE);
    });

    it("getBnEthFiatRate - invalid ccy");

    it("getAugmintRate", async () => {
        const augmintRate = await rates.getAugmintRate(CCY);
        assert.equal(augmintRate.rate, EXPECTED_RATE);
        assert.instanceOf(augmintRate.lastUpdated, Date);
    });

    it("getAugmintRate - invalid ccy");
});

describe("Rates txs", () => {
    const ethereumConnection = new EthereumConnection(config);
    const rates = new Rates();
    let snapshotId;

    before(async () => {
        await ethereumConnection.connect();
        await rates.connect(ethereumConnection);
    });

    beforeEach(async () => {
        snapshotId = await takeSnapshot(ethereumConnection.web3);
    });

    afterEach(async () => {
        await revertSnapshot(ethereumConnection.web3, snapshotId);
    });

    it("setRate");

    it("setRate - invalid ccy");

    it("setRate - invalid price");
});
