const assert = require("chai").assert;
const { Augmint, Wei, Tokens } = require("../dist/index.js");
const loadEnv = require("./testHelpers/loadEnv.js");
const config = loadEnv();

const { takeSnapshot, revertSnapshot } = require("./testHelpers/ganache.js");
const { assertEvent } = require("./testHelpers/events");

const CCY = "EUR";
const DECIMALS_DIV = 100;
let BYTES_CCY;

describe("Rates setters", () => {
    let rates;
    let accounts;
    let snapshotId;
    let ethereumConnection;

    before(async () => {
        const myAugmint = await Augmint.create(config);
        rates = myAugmint.rates;
        ethereumConnection = myAugmint.ethereumConnection;
        accounts = ethereumConnection.accounts;
        BYTES_CCY = ethereumConnection.web3.utils.asciiToHex(CCY);
    });

    beforeEach(async () => {
        snapshotId = await takeSnapshot(ethereumConnection.web3);
    });

    afterEach(async () => {
        await revertSnapshot(ethereumConnection.web3, snapshotId);
    });

    it("setRate - send", async () => {
        const expectedPrice = Tokens.of(1234.56);

        const tx = rates.setRate(CCY, expectedPrice);
        const txReceipt = await tx.send({ from: accounts[0] }).getTxReceipt();
        assert(txReceipt.status);

        await assertEvent(rates.instance, "RateChanged", {
            symbol: BYTES_CCY.padEnd(66, "0"),
            newRate: expectedPrice.toString()
        });

        const newStoredRate = await rates.getAugmintRate(CCY);

        assert(expectedPrice.eq(newStoredRate.rate));
    });

    it("setRate - signed", async () => {
        // private key of accounts[0] 0x76e7a 0aec3e43211395bbbb6fa059bd6750f83c3with the hardcoded mnemonin for ganache
        const PRIVATE_KEY = "0x85b3d743fbe4ec4e2b58947fa5484da7b2f5538b0ae8e655646f94c95d5fb949";
        const expectedPrice = Tokens.of(5678.91);

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
            newRate: expectedPrice.toString()
        });

        const newStoredRate = await rates.getAugmintRate(CCY);

        assert(expectedPrice.eq(newStoredRate.rate));
    });

    it("setRate = 0", async () => {
        const expectedPrice = Tokens.of(0);

        const tx = rates.setRate(CCY, expectedPrice);
        const txReceipt = await tx.send({ from: accounts[0] }).getTxReceipt();

        assert(txReceipt.status);
        await assertEvent(rates.instance, "RateChanged", {
            symbol: BYTES_CCY.padEnd(66, "0"),
            newRate: expectedPrice.toString()
        });

        const newStoredRate = await rates.getAugmintRate(CCY);
        assert(expectedPrice.eq(newStoredRate.rate));
    });

});
