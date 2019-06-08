const { assert } = require("chai");

const { normalizeBN } = require("./testHelpers/normalize.js");
const { Augmint, utils, Wei, Tokens, Ratio } = require("../dist/index.js");
const loadEnv = require("./testHelpers/loadEnv.js");
const OrderBook = Augmint.Exchange.OrderBook;

const config = loadEnv();

if (config.LOG) {
    utils.logger.level = config.LOG;
}

const RATE = Tokens.of(400.00);

describe("calculate market orders", () => {
    it("should return matching info", () => {
        const buyOrders = [
            { amount: Wei.of(0.0070), price: Ratio.of(1.2) },
            { amount: Wei.of(0.0094), price: Ratio.of(1) },
            { amount: Wei.of(0.0064), price: Ratio.of(0.7) }
        ];

        const sellOrders = [
            { amount: Tokens.of(1), price: Ratio.of(1.02) },
            { amount: Tokens.of(10), price: Ratio.of(1.03) }
        ];

        const orderBook = new OrderBook(buyOrders, sellOrders);

        const sellResult = {
            filledTokens: Tokens.of(6),
            filledEthers: Wei.of(0.016165),
            limitPrice: Ratio.of(1),
            averagePrice: Ratio.of(1.077673)
        };

        const sellMatches = orderBook.estimateMarketSell(Tokens.of(6), RATE);

        assert.deepEqual(normalizeBN(sellResult), normalizeBN(sellMatches));

        const buyResult = {
            filledTokens: Tokens.of(2),
            filledEthers: Wei.of(0.005125),
            limitPrice: Ratio.of(1.03),
            averagePrice: Ratio.of(1.02501)
        };

        const buyMatches = orderBook.estimateMarketBuy(Tokens.of(2), RATE);

        assert.deepEqual(normalizeBN(buyMatches), normalizeBN(buyResult));
    });

    it("should work on empty order book", () => {
        const orderBook = new OrderBook([], []);
        const exp = {
            filledTokens: Tokens.of(0),
            filledEthers: Wei.of(0)
        };
        const buyMatches = orderBook.estimateMarketBuy(Tokens.of(100), RATE);
        const sellMatches = orderBook.estimateMarketSell(Tokens.of(100), RATE)
        assert.deepEqual(normalizeBN(buyMatches), normalizeBN(exp));
        assert.deepEqual(normalizeBN(sellMatches), normalizeBN(exp));
    });
});
