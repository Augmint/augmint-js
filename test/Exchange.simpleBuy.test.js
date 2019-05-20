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

        const sellResult = {
            tokens: Tokens.of(4),
            ethers: Wei.of(0.009168),
            limitPrice: Ratio.of(1),
            averagePrice: Ratio.of(1.146)
        };

        const sellMatches = new OrderBook(buyOrders, sellOrders).estimateSimpleSell(Tokens.of(4), RATE);

        expect(sellMatches.tokens.eq(sellResult.tokens)).to.be.equal(true);
        expect(sellMatches.ethers.eq(sellResult.ethers)).to.be.equal(true);
        expect(sellMatches.limitPrice.eq(sellResult.limitPrice)).to.be.equal(true);
        expect(sellMatches.averagePrice.eq(sellResult.averagePrice)).to.be.equal(true);

        const buyResult = {
            tokens: Tokens.of(2),
            ethers: Wei.of(0.0041),
            limitPrice: Ratio.of(1.03),
            averagePrice: Ratio.of(1.025)
        };

        const buyMatches = new OrderBook(buyOrders, sellOrders).estimateSimpleBuy(Tokens.of(2), RATE);

        expect(buyMatches.tokens.eq(buyResult.tokens)).to.be.equal(true);
        expect(buyMatches.ethers.eq(buyResult.ethers)).to.be.equal(true);
        expect(buyMatches.limitPrice.eq(buyResult.limitPrice)).to.be.equal(true);
        expect(buyMatches.averagePrice.eq(buyResult.averagePrice)).to.be.equal(true);
    });
});
