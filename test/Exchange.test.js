const { expect, assert } = require("chai");
const { takeSnapshot, revertSnapshot } = require("./testHelpers/ganache.js");
const { Augmint, utils, Wei, Tokens, Percent } = require("../dist/index.js");
const loadEnv = require("./testHelpers/loadEnv.js");
const config = loadEnv();
const OrderBook = Augmint.Exchange.OrderBook;

if (config.LOG) {
    utils.logger.level = config.LOG;
}

describe("connection", () => {
    let augmint;
    before(async () => {
        augmint = await Augmint.create(config);
    });

    it("should connect to latest contract", async () => {
        const exchange = augmint.exchange;
        assert.equal(exchange.address, "0xFAceA53a04bEfCC6C9246eb3951814cfEE2A1415");
    });

    it("should connect to supported legacy Exchange contracts", () => {
        const legacyAddresses = Augmint.constants.SUPPORTED_LEGACY_EXCHANGES[augmint.deployedEnvironment.name];

        const legacyContracts = augmint.getLegacyExchanges(legacyAddresses);

        const connectedAddresses = legacyContracts.map(leg => leg.address.toLowerCase());
        const lowerCaseLegacyAddresses = legacyAddresses.map(addr => addr.toLowerCase());

        assert.deepEqual(connectedAddresses, lowerCaseLegacyAddresses);
    });
});

describe("getOrderBook", () => {
    let myAugmint = null;
    let exchange = null;
    let snapshotId;

    before(async () => {
        myAugmint = await Augmint.create(config);
        exchange = myAugmint.exchange;
    });

    beforeEach(async () => {
        snapshotId = await takeSnapshot(myAugmint.ethereumConnection.web3);
    });

    afterEach(async () => {
        await revertSnapshot(myAugmint.ethereumConnection.web3, snapshotId);
    });

    it("should return empty orderbook when no orders", async () => {
        const orderBook = await exchange.getOrderBook();
        assert.deepEqual(orderBook, { buyOrders: [], sellOrders: [] });
    });

    it("should return orderbook with orders", async () => {
        const buyMaker = myAugmint.ethereumConnection.accounts[1];
        const sellMaker = myAugmint.ethereumConnection.accounts[0];
        const buyPrice = Percent.of(1.01);
        const sellPrice = Percent.of(1.05);

        const buyAmount = Wei.of(0.1);
        const sellAmount = Tokens.of(10);

        await exchange.instance.methods
            .placeBuyTokenOrder(buyPrice.toString())
            .send({ from: buyMaker, value: buyAmount.toString(), gas: 1000000 });

        await myAugmint.token.instance.methods
            .transferAndNotify(exchange.address, sellAmount.toString(), sellPrice.toString())
            .send({ from: sellMaker, gas: 1000000 });

        const orderBook = await exchange.getOrderBook();

        assert.deepEqual(orderBook, {
            buyOrders: [
                {
                    id: 1,
                    maker: buyMaker.toLowerCase(),
                    price: buyPrice,
                    amount: buyAmount,
                }
            ],
            sellOrders: [
                {
                    id: 2,
                    maker: sellMaker.toLowerCase(),
                    price: sellPrice,
                    amount: sellAmount,
                }
            ]
        });
    });
});

describe("compareOrders", () => {
    let exchange = null;
    it("o2 should be better (SELL price)", () => {
        const o1 = { price: Tokens.of(2), id: 1 };
        const o2 = { price: Tokens.of(1), id: 2 };
        const result = OrderBook.compareSellOrders(o1, o2);
        expect(result).to.be.above(0);
    });

    it("o1 should be better (BUY price)", () => {
        const o1 = { price: Wei.of(2), id: 2 };
        const o2 = { price: Wei.of(1), id: 1 };
        const result = OrderBook.compareBuyOrders(o1, o2);
        expect(result).to.be.below(0);
    });

    it("o2 should be better (SELL id)", () => {
        const o1 = { price: Tokens.of(1), id: 2 };
        const o2 = { price: Tokens.of(1), id: 1 };
        const result = OrderBook.compareSellOrders(o1, o2);
        expect(result).to.be.above(0);
    });

    it("o2 should be better (BUY id)", () => {
        const o1 = { price: Wei.of(1), id: 2 };
        const o2 = { price: Wei.of(1), id: 1 };
        const result = OrderBook.compareBuyOrders(o1, o2);
        expect(result).to.be.above(0);
    });

    it("should be equal when o1 same as o2", () => {
        // same id for two orders, it shouldn't happen
        const o1 = { price: Tokens.of(1), id: 1 };
        const o2 = { price: Tokens.of(1), id: 1 };
        const result = OrderBook.compareSellOrders(o1, o2);
        expect(result).to.be.equal(0);
    });

});
