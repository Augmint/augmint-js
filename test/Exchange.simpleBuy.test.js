const { expect } = require("chai");
const { Augmint, utils, Wei, Tokens, Percent } = require("../dist/index.js");
const loadEnv = require("./testHelpers/loadEnv.js");
const OrderBook = Augmint.Exchange.OrderBook;

const config = loadEnv();

if (config.LOG) {
    utils.logger.level = config.LOG;
}

const RATE = Tokens.of(500.00);

describe("calculate simplebuy", () => {
    it("should return simplebuy data", () => {
        const buyOrders = [
            { amount: Wei.of(0.0070), buy: true, price: Percent.of(1) },
            { amount: Wei.of(0.0094), buy: true, price: Percent.of(1) },
            { amount: Wei.of(0.0064), buy: true, price: Percent.of(0.7) }
        ];

        const sellOrders = [
            { amount: Tokens.of(0.01), buy: false, price: Percent.of(1.0299) },
            { amount: Tokens.of(1), buy: false, price: Percent.of(1.0299) },
            { amount: Tokens.of(10), buy: false, price: Percent.of(1.03) }
        ];

        const buyResult = {
            tokens: Tokens.of(2),
            ethers: 0,
            limitPrice: 100,
            averagePrice: 100
        }

        const sellResult = {
            tokens: Tokens.of(2),
            ethers: 0,
            limitPrice: 100,
            averagePrice: 100
        }

        const sellMatches = new OrderBook(buyOrders, sellOrders).estimateSimpleSell(Tokens.of(2), RATE);
        const buyMatches = new OrderBook(buyOrders, sellOrders).estimateSimpleBuy(Tokens.of(2), RATE);
        console.log("sell matches", sellMatches);
        console.log("buy matches", buyMatches);
    });
});
