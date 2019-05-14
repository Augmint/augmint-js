const { expect } = require("chai");
const { BN } = require("bn.js");

const { Augmint, utils } = require("../dist/index.js");
const loadEnv = require("./testHelpers/loadEnv.js");
const OrderBook = Augmint.Exchange.OrderBook;

const config = loadEnv();

if (config.LOG) {
    utils.logger.level = config.LOG;
}

const PPM_DIV = 1000000;
const ONE_ETH_IN_WEI = new BN("1000000000000000000");
const RATE = new BN("100");

function toWei(amount) {
    return new BN(amount * PPM_DIV).mul(ONE_ETH_IN_WEI).div(new BN(PPM_DIV));
}

function toPPM(price) {
    return new BN(price * PPM_DIV);
}

describe("calculate simplebuy", () => {
    it("should return simplebuy data", () => {
        const buyOrders = [
            { amount: toWei(4.88774716210514), buy: true, price: toPPM(1) },
            { amount: toWei(1.2764160999999998), buy: true, price: toPPM(1) },
            { amount: toWei(1.172032), buy: true, price: toPPM(1) }
        ];

        const sellOrders = [
            { amount: toWei(0.01), buy: false, price: toPPM(1.0299) },
            { amount: toWei(1), buy: false, price: toPPM(1.0299) },
            { amount: toWei(10), buy: false, price: toPPM(1.03) }
        ];

        const result = {
            tokens: 2,
            ethers: 0,
            limitPrice: 1000000,
            averagePrice: 1000000
        }

        const matches = new OrderBook(buyOrders, sellOrders).calculateSimpleBuyData(2, false, toWei(RATE));
        console.log("matches", matches);
    });
});
