const { assert } = require("chai");
const { takeSnapshot, revertSnapshot } = require("./testHelpers/ganache.js");
const { Augmint, utils, Wei, Tokens, Percent } = require("../dist/index.js");
const { assertEvent } = require("./testHelpers/events");
const { issueToken } = require("./testHelpers/token");
const { TransactionSendError } = Augmint.Errors;
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

    it("placeBuyTokenOrder should allow only integer for price", () => {
        assert.throws(
            () => exchange.placeBuyTokenOrder(1.1, 10000).send({ from: augmint.ethereumConnection.accounts[0] }),
            TransactionSendError,
            /invalid number value/
        );
    });

    it("placeSellTokenOrder should allow only integer for  price", () => {
        assert.throws(
            () => exchange.placeSellTokenOrder(1.1, 10000).send({ from: augmint.ethereumConnection.accounts[0] }),
            TransactionSendError,
            /invalid number value/
        );
    });

    it("placeSellTokenOrder should allow only integer for tokenamount", () => {
        assert.throws(
            () => exchange.placeSellTokenOrder(1000000, 100.121).send({ from: augmint.ethereumConnection.accounts[0] }),
            TransactionSendError,
            /invalid number value/
        );
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
        const price = Percent.of(1.01);
        const amount = Wei.of(2);
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
        const price = Percent.of(1.02);
        const amount = Tokens.of(10.99);

        await issueToken(augmint, accounts[0], maker, amount);

        const tx = exchange.placeSellTokenOrder(price, amount);
        const txReceipt = await tx.send({ from: maker }).getTxReceipt();

        assert(txReceipt.status);

        // event NewOrder(uint64 indexed orderId, address indexed maker, uint32 price, uint tokenAmount, uint weiAmount);
        await assertEvent(exchange.instance, "NewOrder", {
            orderId: x => parseInt(x),
            maker: maker,
            price: price.toString(),
            tokenAmount: amount.toString(),
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
