const expect = require("chai").expect;
const { Augmint, utils, Wei, Tokens, Ratio } = require("../dist/index.js");
const { gas } = Augmint;
const loadEnv = require("./testHelpers/loadEnv.js");
const OrderBook = Augmint.Exchange.OrderBook;

const config = loadEnv();

if (config.LOG) {
    utils.logger.level = config.LOG;
}

describe("getMatchingOrders", () => {
    const ETHEUR_RATE = Tokens.of(500.00);
    const GAS_LIMIT = Number.MAX_SAFE_INTEGER;

    it("should return no match if no orders", () => {
        const matches = new OrderBook([], []).getMatchingOrders(ETHEUR_RATE, GAS_LIMIT);
        expect(matches.buyIds).to.have.lengthOf(0);
        expect(matches.sellIds).to.have.lengthOf(0);
        expect(matches.gasEstimate).to.be.equal(0);
    });


    it("should return empty arrays if no matching orders", () => {
        const buyOrders = [
            { id: 2, price: Ratio.of(0.9999), amount: Wei.of(1) },
            { id: 3, price: Ratio.of(0.97), amount: Wei.of(1) },
            { id: 1, price: Ratio.of(0.9), amount: Wei.of(1) }
        ];
        const sellOrders = [
            { id: 4, price: Ratio.of(1), amount: Tokens.of(0.10) },
            { id: 5, price: Ratio.of(1.01), amount: Tokens.of(0.10) }
        ];

        const matches = new OrderBook(buyOrders, sellOrders).getMatchingOrders(ETHEUR_RATE, GAS_LIMIT);

        expect(matches.buyIds).to.have.lengthOf(0);
        expect(matches.sellIds).to.have.lengthOf(0);
        expect(matches.gasEstimate).to.be.equal(0);
    });

    it("should return matching orders (two matching)", () => {
        const buyOrders = [
            { id: 2, price: Ratio.of(1), amount: Wei.of(1) },
            { id: 3, price: Ratio.of(0.97), amount: Wei.of(1) },
            { id: 1, price: Ratio.of(0.9), amount: Wei.of(1) }
        ];
        const sellOrders = [
            { id: 4, price: Ratio.of(1), amount: Tokens.of(10.00) },
            { id: 5, price: Ratio.of(1.05), amount: Tokens.of(10.00) }
        ];

        const matches = new OrderBook(buyOrders, sellOrders).getMatchingOrders(ETHEUR_RATE, GAS_LIMIT);

        expect(matches.buyIds).to.deep.equal([2]);
        expect(matches.sellIds).to.deep.equal([4]);
        expect(matches.gasEstimate).to.be.equal(gas.MATCH_MULTIPLE_FIRST_MATCH_GAS);
    });

    it("should return matching orders (1 buy filled w/ 2 sells)", () => {
        const buyOrders = [
            { id: 2, price: Ratio.of(1.1), amount: Wei.of(1) }, // maker. tokenValue = 1ETH x 500 ETHEUER / 1.1 = 454.55AEUR
            { id: 3, price: Ratio.of(0.97), amount: Wei.of(1) },
            { id: 1, price: Ratio.of(0.9), amount: Wei.of(1) }
        ];
        const sellOrders = [
            { id: 4, price: Ratio.of(1.04), amount: Tokens.of(400.00) }, // fully filled from id 2
            { id: 5, price: Ratio.of(1.05), amount: Tokens.of(54.55) }, // fully filled from id 2 and no leftover in id 2
            { id: 6, price: Ratio.of(1.05), amount: Tokens.of(10.00) } // no fill...
        ];

        const matches = new OrderBook(buyOrders, sellOrders).getMatchingOrders(ETHEUR_RATE, GAS_LIMIT);

        expect(matches.buyIds).to.deep.equal([2, 2]);
        expect(matches.sellIds).to.deep.equal([4, 5]);
        expect(matches.gasEstimate).to.be.equal(
            gas.MATCH_MULTIPLE_FIRST_MATCH_GAS + gas.MATCH_MULTIPLE_ADDITIONAL_MATCH_GAS
        );
    });

    // FIXME: the data in this test case is not quite right
    it.skip("should return matching orders (2 buys filled w/ 3 sells)", () => {
        const buyOrders = [
            { id: 11, price: Ratio.of(1.1), amount: Wei.of(0.659715) }, // fully filled with id 9 as taker
            { id: 3, price: Ratio.of(1.09), amount: Wei.of(1) }, // partially filled from id 4 as maker (leftover 0.9854812) and fully filled from id 2 as taker
            { id: 5, price: Ratio.of(0.9), amount: Wei.of(1) } // no fill (not matched)
        ];

        const sellOrders = [
            { id: 9, price: Ratio.of(1.05), amount: Tokens.of(314.15) }, // maker. ethValue = 314.15 / 500 ETHEUR * 1.05 = 0.659715 ETH
            { id: 4, price: Ratio.of(1.06), amount: Tokens.of(6.66) }, // taker in match with id 3, so ethValue = 6.66 / 500 ETHEUR * 1.09 (maker price) = 0.0145188 ETH
            { id: 2, price: Ratio.of(1.07), amount: Tokens.of(460.51) }, // maker in match with id 3 (full fill) ethValue = 0.9854812
            { id: 6, price: Ratio.of(1.08), amount: Tokens.of(10.00) } // no matching because no more left in matching buy orders..
        ];

        const orders = new OrderBook(buyOrders, sellOrders);
        const matches = orders.getMatchingOrders(ETHEUR_RATE, GAS_LIMIT);

        expect(matches.buyIds).to.deep.equal([3, 1, 1]);
        expect(matches.sellIds).to.deep.equal([7, 5, 4]);
        expect(matches.gasEstimate).to.be.equal(
            gas.MATCH_MULTIPLE_FIRST_MATCH_GAS + 2 * gas.MATCH_MULTIPLE_ADDITIONAL_MATCH_GAS
        );
    });

    it("should return as many matches as fits to gasLimit passed (exact)", () => {
        const buyOrders = [
            { id: 1, price: Ratio.of(1), amount: Wei.of(1) },
            { id: 2, price: Ratio.of(1), amount: Wei.of(1) },
            { id: 3, price: Ratio.of(1), amount: Wei.of(1) }
        ];

        const sellOrders = [
            { id: 5, price: Ratio.of(1), amount: Tokens.of(500.00) },
            { id: 6, price: Ratio.of(1), amount: Tokens.of(500.00) },
            { id: 7, price: Ratio.of(1), amount: Tokens.of(500.00) }
        ];

        const gasLimit = gas.MATCH_MULTIPLE_FIRST_MATCH_GAS + gas.MATCH_MULTIPLE_ADDITIONAL_MATCH_GAS;

        const matches = new OrderBook(buyOrders, sellOrders).getMatchingOrders(ETHEUR_RATE, gasLimit);

        expect(matches.buyIds).to.deep.equal([1, 2]);
        expect(matches.sellIds).to.deep.equal([5, 6]);
        expect(matches.gasEstimate).to.be.equal(gasLimit);
    });

    it("should return as many matches as fits to gasLimit passed (almost)", () => {
        const buyOrders = [
            { id: 1, price: Ratio.of(1), amount: Wei.of(1) },
            { id: 2, price: Ratio.of(1), amount: Wei.of(1) },
            { id: 3, price: Ratio.of(1), amount: Wei.of(1) }
        ];

        const sellOrders = [
            { id: 5, price: Ratio.of(1), amount: Tokens.of(500.00) },
            { id: 6, price: Ratio.of(1), amount: Tokens.of(500.00) },
            { id: 7, price: Ratio.of(1), amount: Tokens.of(500.00) }
        ];

        const gasLimit = gas.MATCH_MULTIPLE_FIRST_MATCH_GAS + 2 * gas.MATCH_MULTIPLE_ADDITIONAL_MATCH_GAS - 1;

        const matches = new OrderBook(buyOrders, sellOrders).getMatchingOrders(ETHEUR_RATE, gasLimit);

        expect(matches.buyIds).to.deep.equal([1, 2]);
        expect(matches.sellIds).to.deep.equal([5, 6]);
        expect(matches.gasEstimate).to.be.equal(
            gas.MATCH_MULTIPLE_FIRST_MATCH_GAS + gas.MATCH_MULTIPLE_ADDITIONAL_MATCH_GAS
        );
    });
});
