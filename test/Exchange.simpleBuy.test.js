const { assert } = require("chai");

const { Augmint, utils, Wei, Tokens, Ratio } = require("../dist/index.js");
const loadEnv = require("./testHelpers/loadEnv.js");
const OrderBook = Augmint.Exchange.OrderBook;

const config = loadEnv();

if (config.LOG) {
    utils.logger.level = config.LOG;
}

const RATE = Tokens.of(400.00);

function assertMatches(expected, actual) {
    assert(actual.filledTokens.eq(expected.filledTokens));
    assert(actual.filledEthers.eq(expected.filledEthers));
    assert(actual.limitPrice.eq(expected.limitPrice));
    assert(actual.averagePrice.eq(expected.averagePrice));
}

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

        const sellResult = {
            filledTokens: Tokens.of(6),
            filledEthers: Wei.of(0.016165),
            limitPrice: Ratio.of(1),
            averagePrice: Ratio.of(1.077673)
        };

        const sellMatches = new OrderBook(buyOrders, sellOrders).estimateMarketSell(Tokens.of(6), RATE);

        assertMatches(sellResult, sellMatches);

        const buyResult = {
            filledTokens: Tokens.of(2),
            filledEthers: Wei.of(0.005125),
            limitPrice: Ratio.of(1.03),
            averagePrice: Ratio.of(1.02501)
        };

        const buyMatches = new OrderBook(buyOrders, sellOrders).estimateMarketBuy(Tokens.of(2), RATE);

        assertMatches(buyResult, buyMatches);
    });
});
