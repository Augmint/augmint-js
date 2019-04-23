const { expect, assert } = require("chai");
const BigNumber = require("bignumber.js");
const { takeSnapshot, revertSnapshot } = require("./testHelpers/ganache.js");
const { Augmint, utils } = require("../dist/index.js");
const { Exchange, EthereumConnection, constants } = Augmint;

const config = utils.loadEnv();

if (config.LOG) {
    utils.logger.level = config.LOG;
}

describe("connection", () => {
    const CCY = "EUR";
    const ethereumConnection = new EthereumConnection(config);
    const exchange = new Exchange();

    it("should connect to latest contract", async () => {
        await ethereumConnection.connect();

        assert.isNull(exchange.address);
        assert.isUndefined(exchange.tokenPeggedSymbol);
        assert.isUndefined(exchange.tokenSymbol);

        await exchange.connect(ethereumConnection);

        assert.equal(exchange.address, "0xFAceA53a04bEfCC6C9246eb3951814cfEE2A1415");
        assert.equal(exchange.rates.address, "0xb0a2a8e846b66C7384F52635CECEf5280F766C8B");
        assert.equal(exchange.augmintToken.address, "0xBbEcfF5Db2F9cCcc936895121802FC15053344c6");
        assert.equal(exchange.tokenPeggedSymbol, CCY);
        assert.equal(exchange.tokenSymbol, "AEUR");
    });

    it("should connect to legacy Excahnge contract");
});

describe("getOrderBook", () => {
    const ethereumConnection = new EthereumConnection(config);
    const exchange = new Exchange();
    let snapshotId;

    before(async () => {
        await ethereumConnection.connect();
        await exchange.connect(ethereumConnection);
    });

    beforeEach(async () => {
        snapshotId = await takeSnapshot(ethereumConnection.web3);
    });

    afterEach(async () => {
        await revertSnapshot(ethereumConnection.web3, snapshotId);
    });

    it("should return empty orderbook when no orders", async () => {
        const orderBook = await exchange.getOrderBook();
        assert.deepEqual(orderBook, { buyOrders: [], sellOrders: [] });
    });

    it("should return orderbook with orders", async () => {
        const buyMaker = ethereumConnection.accounts[1];
        const sellMaker = ethereumConnection.accounts[0];
        const buyPrice = 1.01;
        const bnBuyPrice = new BigNumber(buyPrice * constants.PPM_DIV);
        const sellPrice = 1.05;
        const bnSellPrice = new BigNumber(sellPrice * constants.PPM_DIV);

        const buyEthAmount = 0.1;
        const bn_buyWeiAmount = new BigNumber(ethereumConnection.web3.utils.toWei(buyEthAmount.toString()));
        const sellTokenAmount = 10;
        const bn_sellTokenAmount = new BigNumber(sellTokenAmount * constants.DECIMALS_DIV);

        await exchange.instance.methods
            .placeBuyTokenOrder(bnBuyPrice.toString())
            .send({ from: buyMaker, value: bn_buyWeiAmount.toString(), gas: 1000000 });

        await exchange.augmintToken.instance.methods
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
                    direction: constants.OrderDirection.TOKEN_BUY,
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
                    direction: constants.OrderDirection.TOKEN_SELL,
                    amount: sellTokenAmount
                }
            ]
        });
    });
});

describe("isOrderBetter", () => {
    const exchange = new Exchange();
    it("o2 should be better (SELL price)", () => {
        const o1 = { direction: constants.OrderDirection.TOKEN_SELL, price: 2, id: 1 };
        const o2 = { direction: constants.OrderDirection.TOKEN_SELL, price: 1, id: 2 };
        const result = exchange.isOrderBetter(o1, o2);
        expect(result).to.be.equal(1);
    });

    it("o1 should be better (BUY price)", () => {
        const o1 = { direction: constants.OrderDirection.TOKEN_BUY, price: 2, id: 2 };
        const o2 = { direction: constants.OrderDirection.TOKEN_BUY, price: 1, id: 1 };
        const result = exchange.isOrderBetter(o1, o2);
        expect(result).to.be.equal(-1);
    });

    it("o2 should be better (SELL id)", () => {
        const o1 = { direction: constants.OrderDirection.TOKEN_SELL, price: 1, id: 2 };
        const o2 = { direction: constants.OrderDirection.TOKEN_SELL, price: 1, id: 1 };
        const result = exchange.isOrderBetter(o1, o2);
        expect(result).to.be.equal(1);
    });

    it("o2 should be better (BUY id)", () => {
        const o1 = { direction: constants.OrderDirection.TOKEN_BUY, price: 1, id: 2 };
        const o2 = { direction: constants.OrderDirection.TOKEN_BUY, price: 1, id: 1 };
        const result = exchange.isOrderBetter(o1, o2);
        expect(result).to.be.equal(1);
    });

    it("o1 should be better when o1 same as o2", () => {
        // same id for two orders, it shouldn't happen
        const o1 = { direction: constants.OrderDirection.TOKEN_SELL, price: 1, id: 1 };
        const o2 = { direction: constants.OrderDirection.TOKEN_SELL, price: 1, id: 1 };
        const result = exchange.isOrderBetter(o1, o2);
        expect(result).to.be.equal(-1);
    });

    it("the direction of the two orders should be same", () => {
        const o1 = { direction: constants.OrderDirection.TOKEN_SELL, price: 2, id: 2 };
        const o2 = { direction: constants.OrderDirection.TOKEN_BUY, price: 1, id: 1 };
        expect(() => exchange.isOrderBetter(o1, o2)).to.throw(/order directions must be the same/);
    });
});
