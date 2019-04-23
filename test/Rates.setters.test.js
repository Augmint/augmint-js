const assert = require("chai").assert;
const { Augmint, utils } = require("../dist/index.js");
const { EthereumConnection, Rates } = Augmint;
const { InvalidPriceError, AugmintJsError } = require("../dist/Errors.js");

const config = utils.loadEnv();

const { takeSnapshot, revertSnapshot } = require("./testHelpers/ganache.js");
const { assertEvent } = require("./testHelpers/events");

const CCY = "EUR";
const DECIMALS_DIV = 100;
let BYTES_CCY;

describe("Rates setters", () => {
    const ethereumConnection = new EthereumConnection(config);
    const rates = new Rates();
    let accounts;
    let snapshotId;

    before(async () => {
        await ethereumConnection.connect();
        accounts = ethereumConnection.accounts;
        BYTES_CCY = ethereumConnection.web3.utils.asciiToHex(CCY);
        await rates.connect(ethereumConnection);
    });

    beforeEach(async () => {
        snapshotId = await takeSnapshot(ethereumConnection.web3);
    });

    afterEach(async () => {
        await revertSnapshot(ethereumConnection.web3, snapshotId);
    });

    it("setRate - send", async () => {
        const expectedPrice = 1234.56;

        const tx = rates.setRate(CCY, expectedPrice);
        const txReceipt = await tx.send({ from: accounts[0] }).getTxReceipt();
        assert(txReceipt.status);

        await assertEvent(rates.instance, "RateChanged", {
            symbol: BYTES_CCY.padEnd(66, "0"),
            newRate: (expectedPrice * DECIMALS_DIV).toString()
        });

        const newStoredRate = await rates.getAugmintRate(CCY);

        assert.equal(newStoredRate.rate, expectedPrice);
    });

    it("setRate - signed", async () => {
        // private key of accounts[0] 0x76e7a 0aec3e43211395bbbb6fa059bd6750f83c3with the hardcoded mnemonin for ganache
        const PRIVATE_KEY = "0x85b3d743fbe4ec4e2b58947fa5484da7b2f5538b0ae8e655646f94c95d5fb949";
        const expectedPrice = 5678.91;

        const txReceipt = await rates
            .setRate(CCY, expectedPrice)
            .sign(PRIVATE_KEY, {
                from: accounts[0]
            })
            .send()
            .getTxReceipt();

        assert(txReceipt.status);

        await assertEvent(rates.instance, "RateChanged", {
            symbol: BYTES_CCY.padEnd(66, "0"),
            newRate: (expectedPrice * DECIMALS_DIV).toString()
        });

        const newStoredRate = await rates.getAugmintRate(CCY);

        assert.equal(newStoredRate.rate, expectedPrice);
    });

    it("setRate = 0", async () => {
        const expectedPrice = 0;

        const tx = rates.setRate(CCY, expectedPrice);
        const txReceipt = await tx.send({ from: accounts[0] }).getTxReceipt();

        assert(txReceipt.status);
        await assertEvent(rates.instance, "RateChanged", {
            symbol: BYTES_CCY.padEnd(66, "0"),
            newRate: (expectedPrice * DECIMALS_DIV).toString()
        });

        const newStoredRate = await rates.getAugmintRate(CCY);
        assert.equal(newStoredRate.rate, expectedPrice);
    });

    it("setRate - invalid price", () => {
        const expectedPrice = 1232.222;
        try {
            rates.setRate(CCY, expectedPrice);
        } catch (error) {
            assert.instanceOf(error, AugmintJsError);
            assert.instanceOf(error, InvalidPriceError);
        }
    });
});
