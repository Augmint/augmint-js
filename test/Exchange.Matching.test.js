const expect = require("chai").expect;
const BigNumber = require("bignumber.js");
const { Augmint, utils } = require("../dist/index.js");
const { gas, Exchange } = Augmint;

const exchange = new Exchange();

const config = utils.loadEnv();

if (config.LOG) {
    utils.logger.level = config.LOG;
}

const PPM_DIV = 1000000;

function getBnPrice(price) {
    return new BigNumber((price * PPM_DIV).toFixed(0));
}

describe("getMatchMultipleOrdersTx", () => {
    it("should match orders on chain");
});

describe("calculateMatchingOrders", () => {
    const ETHEUR_RATE = new BigNumber(50000);
    const BN_ONE = new BigNumber(1);
    const GAS_LIMIT = Number.MAX_SAFE_INTEGER;

    it("should return no match if no orders", () => {
        const matches = exchange.calculateMatchingOrders([], [], ETHEUR_RATE, GAS_LIMIT);
        expect(matches.buyIds).to.have.lengthOf(0);
        expect(matches.sellIds).to.have.lengthOf(0);
        expect(matches.gasEstimate).to.be.equal(0);
    });

    it("should return empty arrays if no matching orders", () => {
        const buyOrders = [
            { id: 2, bnPrice: getBnPrice(0.9999), bn_ethAmount: BN_ONE },
            { id: 3, bnPrice: getBnPrice(0.97), bn_ethAmount: BN_ONE },
            { id: 1, bnPrice: getBnPrice(0.9), bn_ethAmount: BN_ONE }
        ];
        const sellOrders = [
            { id: 4, bnPrice: getBnPrice(1), bnAmount: new BigNumber(10) }, //
            { id: 5, bnPrice: getBnPrice(1.01), bnAmount: new BigNumber(10) } //
        ];

        const matches = exchange.calculateMatchingOrders(buyOrders, sellOrders, ETHEUR_RATE, GAS_LIMIT);

        expect(matches.buyIds).to.have.lengthOf(0);
        expect(matches.sellIds).to.have.lengthOf(0);
        expect(matches.gasEstimate).to.be.equal(0);
    });

    it("should return matching orders (two matching)", () => {
        const buyOrders = [
            { id: 2, bnPrice: getBnPrice(1), bnEthAmount: BN_ONE },
            { id: 3, bnPrice: getBnPrice(0.97), bnEthAmount: BN_ONE },
            { id: 1, bnPrice: getBnPrice(0.9), bnEthAmount: BN_ONE }
        ];
        const sellOrders = [
            { id: 4, bnPrice: getBnPrice(1), bnAmount: new BigNumber(1000) }, //
            { id: 5, bnPrice: getBnPrice(1.05), bnAmount: new BigNumber(1000) } //
        ];

        const matches = exchange.calculateMatchingOrders(buyOrders, sellOrders, ETHEUR_RATE, GAS_LIMIT);

        expect(matches.buyIds).to.deep.equal([2]);
        expect(matches.sellIds).to.deep.equal([4]);
        expect(matches.gasEstimate).to.be.equal(gas.MATCH_MULTIPLE_FIRST_MATCH_GAS);
    });

    it("should return matching orders (1 buy filled w/ 2 sells)", () => {
        const buyOrders = [
            { id: 2, bnPrice: getBnPrice(1.1), bnEthAmount: BN_ONE }, // maker. tokenValue = 1ETH x 500 ETHEUER / 1.1 = 454.55AEUR
            { id: 3, bnPrice: getBnPrice(0.97), bnEthAmount: BN_ONE },
            { id: 1, bnPrice: getBnPrice(0.9), bnEthAmount: BN_ONE }
        ];
        const sellOrders = [
            { id: 4, bnPrice: getBnPrice(1.05), bnAmount: new BigNumber(40000) }, // fully filled from id 2
            { id: 5, bnPrice: getBnPrice(1.04), bnAmount: new BigNumber(5455) }, // fully filled from id 2 and no leftover in id 2
            { id: 6, bnPrice: getBnPrice(1.04), bnAmount: new BigNumber(1000) } // no fill...
        ];

        const matches = exchange.calculateMatchingOrders(buyOrders, sellOrders, ETHEUR_RATE, GAS_LIMIT);

        expect(matches.buyIds).to.deep.equal([2, 2]);
        expect(matches.sellIds).to.deep.equal([4, 5]);
        expect(matches.gasEstimate).to.be.equal(
            gas.MATCH_MULTIPLE_FIRST_MATCH_GAS + gas.MATCH_MULTIPLE_ADDITIONAL_MATCH_GAS
        );
    });

    it("should return matching orders (2 buys filled w/ 3 sells)", () => {
        const buyOrders = [
            { id: 11, bnPrice: getBnPrice(1.1), bnEthAmount: new BigNumber(0.659715) }, // fully filled with id 9 as taker
            { id: 3, bnPrice: getBnPrice(1.09), bnEthAmount: BN_ONE }, // partially filled from id 4 as maker (leftover 0.9854812) and fully filled from id 2 as taker
            { id: 5, bnPrice: getBnPrice(0.9), bnEthAmount: BN_ONE } // no fill (not matched)
        ];

        const sellOrders = [
            { id: 9, bnPrice: getBnPrice(1.05), bnAmount: new BigNumber(31415) }, // maker. ethValue = 314.15 / 500 ETHEUR * 1.05 = 0.659715 ETH
            { id: 4, bnPrice: getBnPrice(1.06), bnAmount: new BigNumber(666) }, // taker in match with id 3, so ethValue = 6.66 / 500 ETHEUR * 1.09 (maker price) = 0.0145188 ETH
            { id: 2, bnPrice: getBnPrice(1.07), bnAmount: new BigNumber(46051) }, // maker in match with id 3 (full fill) ethValue = 0.9854812
            { id: 6, bnPrice: getBnPrice(1.08), bnAmount: new BigNumber(1000) } // no matching because no more left in matching buy orders..
        ];

        const matches = exchange.calculateMatchingOrders(buyOrders, sellOrders, ETHEUR_RATE, GAS_LIMIT);

        expect(matches.buyIds).to.deep.equal([11, 3, 3]);
        expect(matches.sellIds).to.deep.equal([9, 4, 2]);
        expect(matches.gasEstimate).to.be.equal(
            gas.MATCH_MULTIPLE_FIRST_MATCH_GAS + 2 * gas.MATCH_MULTIPLE_ADDITIONAL_MATCH_GAS
        );
    });

    it("should return as many matches as fits to gasLimit passed (exact)", () => {
        const buyOrders = [
            { id: 1, bnPrice: getBnPrice(1), bnEthAmount: BN_ONE },
            { id: 2, bnPrice: getBnPrice(1), bnEthAmount: BN_ONE },
            { id: 3, bnPrice: getBnPrice(1), bnEthAmount: BN_ONE }
        ];

        const sellOrders = [
            { id: 5, bnPrice: getBnPrice(1), bnAmount: new BigNumber(50000) },
            { id: 6, bnPrice: getBnPrice(1), bnAmount: new BigNumber(50000) },
            { id: 7, bnPrice: getBnPrice(1), bnAmount: new BigNumber(50000) }
        ];

        const gasLimit = gas.MATCH_MULTIPLE_FIRST_MATCH_GAS + gas.MATCH_MULTIPLE_ADDITIONAL_MATCH_GAS;

        const matches = exchange.calculateMatchingOrders(buyOrders, sellOrders, ETHEUR_RATE, gasLimit);

        expect(matches.buyIds).to.deep.equal([1, 2]);
        expect(matches.sellIds).to.deep.equal([5, 6]);
        expect(matches.gasEstimate).to.be.equal(gasLimit);
    });

    it("should return as many matches as fits to gasLimit passed (almost)", () => {
        const buyOrders = [
            { id: 1, bnPrice: getBnPrice(1), bnEthAmount: BN_ONE },
            { id: 2, bnPrice: getBnPrice(1), bnEthAmount: BN_ONE },
            { id: 3, bnPrice: getBnPrice(1), bnEthAmount: BN_ONE }
        ];

        const sellOrders = [
            { id: 5, bnPrice: getBnPrice(1), bnAmount: new BigNumber(50000) },
            { id: 6, bnPrice: getBnPrice(1), bnAmount: new BigNumber(50000) },
            { id: 7, bnPrice: getBnPrice(1), bnAmount: new BigNumber(50000) }
        ];

        const gasLimit = gas.MATCH_MULTIPLE_FIRST_MATCH_GAS + 2 * gas.MATCH_MULTIPLE_ADDITIONAL_MATCH_GAS - 1;

        const matches = exchange.calculateMatchingOrders(buyOrders, sellOrders, ETHEUR_RATE, gasLimit);

        expect(matches.buyIds).to.deep.equal([1, 2]);
        expect(matches.sellIds).to.deep.equal([5, 6]);
        expect(matches.gasEstimate).to.be.equal(
            gas.MATCH_MULTIPLE_FIRST_MATCH_GAS + gas.MATCH_MULTIPLE_ADDITIONAL_MATCH_GAS
        );
    });
});
