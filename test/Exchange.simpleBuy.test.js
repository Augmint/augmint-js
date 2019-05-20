const { expect } = require("chai");
const { Augmint, utils, Wei, Tokens, Ratio } = require("../dist/index.js");
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
            { amount: Wei.of(0.0070), buy: true, price: Ratio.of(1.2) },
            { amount: Wei.of(0.0094), buy: true, price: Ratio.of(1) },
            { amount: Wei.of(0.0064), buy: true, price: Ratio.of(0.7) }
        ];

        const sellOrders = [
            { amount: Tokens.of(1), buy: false, price: Ratio.of(1.02) },
            { amount: Tokens.of(10), buy: false, price: Ratio.of(1.03) }
        ];

        const buyResult = {
            tokens: Tokens.of(2),
            ethers: Wei.of(0.0041),
            limitPrice: Ratio.of(1.03),
            averagePrice: Ratio.of(1.025)
        };

        const sellResult = {
            tokens: Tokens.of(4),
            ethers: Wei.of(0.009168),
            limitPrice: Ratio.of(1),
            averagePrice: Ratio.of(1.146)
        }

        const sellMatches = new OrderBook(buyOrders, sellOrders).estimateSimpleSell(Tokens.of(4), RATE);
        const buyMatches = new OrderBook(buyOrders, sellOrders).estimateSimpleBuy(Tokens.of(2), RATE);

        console.log(sellMatches.averagePrice.toString(), sellResult.averagePrice.toString())

        expect(sellMatches.averagePrice).to.equal(sellResult.averagePrice)
    });
});
