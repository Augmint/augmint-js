const { expect, assert } = require("chai");
const BigNumber = require("bignumber.js");
const { takeSnapshot, revertSnapshot } = require("./testHelpers/ganache.js");
const { Augmint, utils } = require("../dist/index.js");
const loadEnv = require("./testHelpers/loadEnv.js");
const config = loadEnv();

if (config.LOG) {
    utils.logger.level = config.LOG;
}

describe("connection", () => {
    it("should connect to latest contract", async () => {
        const myAugmint = await Augmint.create(config);
        const exchange = myAugmint.exchange;
        assert.equal(exchange.address, "0xFAceA53a04bEfCC6C9246eb3951814cfEE2A1415");
    });

    it("should connect to legacy Excahnge contract");
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
        const buyPrice = 1.01;
        const bnBuyPrice = new BigNumber(buyPrice * Augmint.constants.PPM_DIV);
        const sellPrice = 1.05;
        const bnSellPrice = new BigNumber(sellPrice * Augmint.constants.PPM_DIV);

        const buyEthAmount = 0.1;
        const bn_buyWeiAmount = new BigNumber(myAugmint.ethereumConnection.web3.utils.toWei(buyEthAmount.toString()));
        const sellTokenAmount = 10;
        const bn_sellTokenAmount = new BigNumber(sellTokenAmount * Augmint.constants.DECIMALS_DIV);

        await exchange.instance.methods
            .placeBuyTokenOrder(bnBuyPrice.toString())
            .send({ from: buyMaker, value: bn_buyWeiAmount.toString(), gas: 1000000 });

        await myAugmint.token.instance.methods
            .transferAndNotify(exchange.address, bn_sellTokenAmount.toString(), bnSellPrice.toString())
            .send({ from: sellMaker, gas: 1000000 });

        const orderBook = await exchange.getOrderBook();

        assert.deepEqual(orderBook, {
            buyOrders: [
                {
                    id: 1,
                    maker: buyMaker.toLowerCase(),
                    bnPrice: bnBuyPrice,
                    bnAmount: bn_buyWeiAmount,
                    price: buyPrice,
                    direction: Augmint.constants.OrderDirection.TOKEN_BUY,
                    bnEthAmount: new BigNumber(buyEthAmount),
                    amount: buyEthAmount
                }
            ],
            sellOrders: [
                {
                    id: 2,
                    maker: sellMaker.toLowerCase(),
                    bnPrice: bnSellPrice,
                    bnAmount: bn_sellTokenAmount,
                    price: sellPrice,
                    direction: Augmint.constants.OrderDirection.TOKEN_SELL,
                    amount: sellTokenAmount
                }
            ]
        });
    });
});

describe("isOrderBetter", () => {
    let exchange = null;
        before(async () => {
        const myAugmint = await Augmint.create(config);
        exchange = myAugmint.exchange;
    });
    it("o2 should be better (SELL price)", () => {
        const o1 = { direction: Augmint.constants.OrderDirection.TOKEN_SELL, price: 2, id: 1 };
        const o2 = { direction: Augmint.constants.OrderDirection.TOKEN_SELL, price: 1, id: 2 };
        const result = exchange.isOrderBetter(o1, o2);
        expect(result).to.be.equal(1);
    });

    it("o1 should be better (BUY price)", () => {
        const o1 = { direction: Augmint.constants.OrderDirection.TOKEN_BUY, price: 2, id: 2 };
        const o2 = { direction: Augmint.constants.OrderDirection.TOKEN_BUY, price: 1, id: 1 };
        const result = exchange.isOrderBetter(o1, o2);
        expect(result).to.be.equal(-1);
    });

    it("o2 should be better (SELL id)", () => {
        const o1 = { direction: Augmint.constants.OrderDirection.TOKEN_SELL, price: 1, id: 2 };
        const o2 = { direction: Augmint.constants.OrderDirection.TOKEN_SELL, price: 1, id: 1 };
        const result = exchange.isOrderBetter(o1, o2);
        expect(result).to.be.equal(1);
    });

    it("o2 should be better (BUY id)", () => {
        const o1 = { direction: Augmint.constants.OrderDirection.TOKEN_BUY, price: 1, id: 2 };
        const o2 = { direction: Augmint.constants.OrderDirection.TOKEN_BUY, price: 1, id: 1 };
        const result = exchange.isOrderBetter(o1, o2);
        expect(result).to.be.equal(1);
    });

    it("o1 should be better when o1 same as o2", () => {
        // same id for two orders, it shouldn't happen
        const o1 = { direction: Augmint.constants.OrderDirection.TOKEN_SELL, price: 1, id: 1 };
        const o2 = { direction: Augmint.constants.OrderDirection.TOKEN_SELL, price: 1, id: 1 };
        const result = exchange.isOrderBetter(o1, o2);
        expect(result).to.be.equal(-1);
    });

    it("the direction of the two orders should be same", () => {
        const o1 = { direction: Augmint.constants.OrderDirection.TOKEN_SELL, price: 2, id: 2 };
        const o2 = { direction: Augmint.constants.OrderDirection.TOKEN_BUY, price: 1, id: 1 };
        expect(() => exchange.isOrderBetter(o1, o2)).to.throw(/order directions must be the same/);
    });
});
