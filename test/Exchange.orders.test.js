const { assert } = require("chai");
const BigNumber = require("bignumber.js");
const { takeSnapshot, revertSnapshot } = require("./testHelpers/ganache.js");
const { Augmint, utils } = require("../dist/index.js");
const { assertEvent } = require("./testHelpers/events");
const { issueToken } = require("./testHelpers/token");
const { InvalidPriceError, InvalidTokenAmountError } = Augmint.Errors;
const loadEnv = require("./testHelpers/loadEnv.js");
const config = loadEnv();
if (config.LOG) {
    utils.logger.level = config.LOG;
}

describe("place orders - invalid args", () => {
    let augmint = null;
    let exchange = null;

    before(async () => {
        augmint = await Augmint.create(config);
        exchange = augmint.exchange;
    });

    it("placeBuyTokenOrder should not allow decimals in price", () => {
        assert.throws(() => exchange.placeBuyTokenOrder(1.1, 10000), InvalidPriceError);
    });

    it("placeSellTokenOrder should not allow decimals in price", () => {
        assert.throws(() => exchange.placeSellTokenOrder(1.1, 10000), InvalidPriceError);
    });

    it("placeSellTokenOrder should not allow more decimals in amount than token decimals", () => {
        assert.throws(() => exchange.placeSellTokenOrder(1000000, 100.121), InvalidTokenAmountError);
    });
});

describe("place orders - onchain", () => {
    let augmint = null;
    let exchange = null;
    let accounts;
    let snapshotId;

    beforeEach(async () => {
        snapshotId = await takeSnapshot(augmint.ethereumConnection.web3);
    });

    afterEach(async () => {
        await revertSnapshot(augmint.ethereumConnection.web3, snapshotId);
    });

    before(async () => {
        augmint = await Augmint.create(config);
        exchange = augmint.exchange;
        accounts = augmint.ethereumConnection.accounts;
    });

    it("placeBuyTokenOrder success", async () => {
        const maker = accounts[1];
        const price = 1.01 * Augmint.constants.PPM_DIV;
        const amount = new BigNumber(2000000000);
        const tx = exchange.placeBuyTokenOrder(price, amount);
        const txReceipt = await tx.send({ from: maker }).getTxReceipt();

        assert(txReceipt.status);
        // event NewOrder(uint64 indexed orderId, address indexed maker, uint32 price, uint tokenAmount, uint weiAmount);
        await assertEvent(exchange.instance, "NewOrder", {
            orderId: x => parseInt(x),
            maker: maker,
            price: price.toString(),
            tokenAmount: "0",
            weiAmount: amount.toString()
        });
    });

    it("placeSellTokenOrder success", async () => {
        const maker = accounts[1];
        const price = 1.02 * Augmint.constants.PPM_DIV;
        const amount = 10.99;

        await issueToken(augmint, accounts[0], maker, amount);

        const tx = exchange.placeSellTokenOrder(price, amount);
        const txReceipt = await tx.send({ from: maker }).getTxReceipt();

        assert(txReceipt.status);

        // event NewOrder(uint64 indexed orderId, address indexed maker, uint32 price, uint tokenAmount, uint weiAmount);
        await assertEvent(exchange.instance, "NewOrder", {
            orderId: x => parseInt(x),
            maker: maker,
            price: price.toString(),
            tokenAmount: (amount * Augmint.constants.DECIMALS_DIV).toString(),
            weiAmount: "0"
        });
    });
});

describe("cancel order ", () => {
    let augmint = null;
    let exchange = null;
    let snapshotId;

    before(async () => {
        augmint = await Augmint.create(config);
        exchange = augmint.exchange;
    });

    beforeEach(async () => {
        snapshotId = await takeSnapshot(augmint.ethereumConnection.web3);
    });

    afterEach(async () => {
        await revertSnapshot(augmint.ethereumConnection.web3, snapshotId);
    });

    it("should cancel a buy order");

    it("should cancel a sell order");

    it("cancel sell order should throw if order id is invalid");

    it("cancel buy order should throw if order id is invalid");
});
