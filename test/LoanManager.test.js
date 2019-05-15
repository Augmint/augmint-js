const chai = require("chai");
const { assert, expect } = chai;
chai.use(require("chai-exclude"));

const BN = require("bn.js");
BN.prototype.inspect = function() {
    return this.toString();
};

const { takeSnapshot, revertSnapshot } = require("./testHelpers/ganache.js");
const { Augmint, utils, Wei, Tokens, Ratio } = require("../dist/index.js");
const { AugmintJsError } = Augmint.Errors;
const loadEnv = require("./testHelpers/loadEnv.js");
const config = loadEnv();

if (config.LOG) {
    utils.logger.level = config.LOG;
}

// deeply normalize all BN properties so they can be compared with deepEquals
// NOTE: object graph must not have cycles
function normalizeBN(obj) {
    Object.keys(obj).map((key, index) => {
        const o = obj[key];
        if (o instanceof BN) {
            obj[key] = new BN(o.toString());
        } else if (o instanceof Object) {
            obj[key] = normalizeBN(o);
        }
    });
    return obj;
}

function mockProd(
    id,
    minDisbursedAmount,
    termInSecs,
    discountRate,
    collateralRatio,
    defaultingFeePt,
    maxLoanAmount,
    isActive,
    interestRatePa,
    adjustedMinDisbursedAmount
) {
    return {
        id,
        termInSecs,
        discountRate: Ratio.of(discountRate),
        interestRatePa,
        collateralRatio: Ratio.of(collateralRatio),
        minDisbursedAmount: Tokens.of(minDisbursedAmount),
        adjustedMinDisbursedAmount: Tokens.of(adjustedMinDisbursedAmount),
        maxLoanAmount: Tokens.of(maxLoanAmount),
        defaultingFeePt: Ratio.of(defaultingFeePt),
        isActive
    };
}

describe("LoanProduct", () => {
    const LoanProduct = Augmint.LoanManager.LoanProduct;

    it("should create a LoanProduct from a tuple", async () => {
        const expectedProd = mockProd(0, 10.00, 31536000, 0.8547, 0.55, 0.05, 218.01, true, 0.17, 12.50);
        // Solidity LoanManager contract .getProducts() tuple:
        // [id, minDisbursedAmount, term, discountRate, collateralRatio, defaultingFeePt, maxLoanAmount, isActive ]
        const lp = new LoanProduct(["0", "1000", "31536000", "854700", "550000", "50000", "21801", "1"]);
        assert.deepEqual(normalizeBN(lp), expectedProd);
    });

    it("should throw if creating with 0 term ", () => {
        expect(() => new LoanProduct(["99", "11", "0", "22", "33", "44", "55", "66"])).to.throw(
            AugmintJsError,
            /LoanProduct with 0 term/
        );
    });

    it("should calculate loan values from disbursed amount", () => {
        const lp = new LoanProduct(["0", "1000", "31536000", "854701", "550000", "50000", "21801", "1"]);
        const ETH_FIAT_RATE = Tokens.of(998.00);
        const EXPECTED_REPAY_BEFORE = new Date();
        EXPECTED_REPAY_BEFORE.setSeconds(EXPECTED_REPAY_BEFORE.getSeconds() + lp.termInSecs);

        const EXPECTED_LOANVALUES = {
            disbursedAmount: Tokens.of(100.00),
            collateralAmount: Wei.parse("213156312625250501"),
            repaymentAmount: Tokens.of(117.00),
            interestAmount: Tokens.of(17.00),
            repayBefore: EXPECTED_REPAY_BEFORE
        };

        const lv = lp.calculateLoanFromDisbursedAmount(EXPECTED_LOANVALUES.disbursedAmount, ETH_FIAT_RATE);
        assert.isAtMost(Math.abs(lv.repayBefore - EXPECTED_REPAY_BEFORE), 1000);
        assert.deepEqualExcluding(normalizeBN(lv), EXPECTED_LOANVALUES, "repayBefore");
    });

    it("should calculate loan values from collateral", () => {
        const lp = new LoanProduct(["0", "1000", "31536000", "1052632", "550000", "50000", "21801", "1"]);
        const ETH_FIAT_RATE = Tokens.of(998.00);
        const EXPECTED_REPAY_BEFORE = new Date();
        EXPECTED_REPAY_BEFORE.setSeconds(EXPECTED_REPAY_BEFORE.getSeconds() + lp.termInSecs);

        const EXPECTED_LOANVALUES = {
            disbursedAmount: Tokens.of(100.00),
            collateralAmount: Wei.parse("173076152304609218"),
            repaymentAmount: Tokens.of(95.00),
            interestAmount: Tokens.of(-5.00),
            repayBefore: EXPECTED_REPAY_BEFORE
        };

        const lv = lp.calculateLoanFromCollateral(EXPECTED_LOANVALUES.collateralAmount, ETH_FIAT_RATE);
        assert.isAtMost(Math.abs(lv.repayBefore - EXPECTED_REPAY_BEFORE), 1000);
        assert.deepEqualExcluding(normalizeBN(lv), EXPECTED_LOANVALUES, "repayBefore");
    });

    it("should calculate loan values from disbursed amount (negative interest)", () => {
        const lp = new LoanProduct(["0", "1000", "31536000", "1052632", "550000", "50000", "21801", "1"]);
        const ETH_FIAT_RATE = Tokens.of(998.00);
        const EXPECTED_REPAY_BEFORE = new Date();
        EXPECTED_REPAY_BEFORE.setSeconds(EXPECTED_REPAY_BEFORE.getSeconds() + lp.termInSecs);

        const EXPECTED_LOANVALUES = {
            disbursedAmount: Tokens.of(100.00),
            collateralAmount: Wei.parse("173076152304609218"),
            repaymentAmount: Tokens.of(95.00),
            interestAmount: Tokens.of(-5.00),
            repayBefore: EXPECTED_REPAY_BEFORE
        };

        const lv = lp.calculateLoanFromDisbursedAmount(EXPECTED_LOANVALUES.disbursedAmount, ETH_FIAT_RATE);
        assert.isAtMost(Math.abs(lv.repayBefore - EXPECTED_REPAY_BEFORE), 1000);
        assert.deepEqualExcluding(normalizeBN(lv), EXPECTED_LOANVALUES, "repayBefore");
    });

    it("should calculate loan values from collateral (negative interest)", () => {
        const lp = new LoanProduct(["0", "1000", "31536000", "1052632", "550000", "50000", "21801", "1"]);
        const ETH_FIAT_RATE = Tokens.of(998.00);
        const EXPECTED_REPAY_BEFORE = new Date();
        EXPECTED_REPAY_BEFORE.setSeconds(EXPECTED_REPAY_BEFORE.getSeconds() + lp.termInSecs);

        const EXPECTED_LOANVALUES = {
            disbursedAmount: Tokens.of(100.00),
            collateralAmount: Wei.parse("173076152304609218"),
            repaymentAmount: Tokens.of(95.00),
            interestAmount: Tokens.of(-5.00),
            repayBefore: EXPECTED_REPAY_BEFORE
        };

        const lv = lp.calculateLoanFromCollateral(EXPECTED_LOANVALUES.collateralAmount, ETH_FIAT_RATE);
        assert.isAtMost(Math.abs(lv.repayBefore - EXPECTED_REPAY_BEFORE), 1000);
        assert.deepEqualExcluding(normalizeBN(lv), EXPECTED_LOANVALUES, "repayBefore");
    });
});

describe("LoanManager connection", () => {
    let augmint;
    before(async () => {
        augmint = await Augmint.create(config);
    });

    it("should connect to latest contract", async () => {
        const loanManager = augmint.loanManager;
        assert.equal(loanManager.address, "0x213135c85437C23bC529A2eE9c2980646c332fCB");
    });

    it("should connect to supported legacy LoanManager contracts", () => {
        const legacyAddresses = Augmint.constants.SUPPORTED_LEGACY_LOANMANAGERS[augmint.deployedEnvironment.name];

        const legacyContracts = augmint.getLegacyLoanManagers(legacyAddresses);

        const connectedAddresses = legacyContracts.map(leg => leg.address.toLowerCase());
        const lowerCaseLegacyAddresses = legacyAddresses.map(addr => addr.toLowerCase());

        assert.deepEqual(connectedAddresses, lowerCaseLegacyAddresses);
    });
});

describe("LoanManager getters", () => {
    const EXPECTED_ALL_PRODUCTS = [
        // id,minDisbursedAmount,termInSecs,discountRate,collateralRatio,defaultingFeePt,maxLoanAmount,isActive,interestRatePa,adjustedMinDisbursedAmount
        mockProd(0, 10.00, 31536000, .854700, .55, .05, 218.01, true,    0.17, 12.50),
        mockProd(1, 10.00, 15552000, .924752, .55, .05, 218.01, true,   0.165, 12.50),
        mockProd(2, 10.00, 7776000,  .962045, .60, .05, 218.01, false,   0.16, 12.50),
        mockProd(3, 10.00, 5184000,  .975153, .60, .05, 218.01, true,   0.155, 12.50),
        mockProd(4, 10.00, 2592000,  .987821, .60, .05, 218.01, true,    0.15, 12.50),
        mockProd(5, 10.00, 1209600,  .994279, .60, .05, 218.01, false,   0.15, 12.50),
        mockProd(6, 10.00, 604800,   .997132, .60, .05, 218.01, true,    0.15, 12.50),
        mockProd(7, 20.00, 3600,     .999998, .98, .05, 218.01, true,  0.0175, 25.00),
        mockProd(8, 30.00, 1,        .999999, .99, .05, 218.01, true,  31.536, 37.50)
    ];

    const EXPECTED_ACTIVE_PRODUCTS = EXPECTED_ALL_PRODUCTS.filter(p => p.isActive);

    let augmint;
    let accounts;
    let loanManager;
    let snapshotId;

    before(async () => {
        augmint = await Augmint.create(config);
        accounts = augmint.ethereumConnection.accounts;
        loanManager = augmint.loanManager;

        snapshotId = await takeSnapshot(augmint.ethereumConnection.web3);
        await Promise.all([
            loanManager.instance.methods.setLoanProductActiveState(2, false).send({ from: accounts[0] }),
            loanManager.instance.methods.setLoanProductActiveState(5, false).send({ from: accounts[0] })
        ]);
    });

    after(async () => {
        await revertSnapshot(augmint.ethereumConnection.web3, snapshotId);
    });

    it("should return all loan products", async () => {
        const products = await loanManager.getAllProducts();
        assert.deepEqual(normalizeBN(products), EXPECTED_ALL_PRODUCTS);
    });

    it("should return active loan products", async () => {
        const products = await loanManager.getActiveProducts();
        assert.deepEqual(normalizeBN(products), EXPECTED_ACTIVE_PRODUCTS);
    });
});

describe("LoanManager events", () => {
    let augmint;
    let loanManager;
    let snapshotId;

    before(async () => {
        augmint = await Augmint.create(config);
        loanManager = augmint.loanManager;
    });

    beforeEach(async () => {
        snapshotId = await takeSnapshot(augmint.ethereumConnection.web3);
    });

    afterEach(async () => {
        await revertSnapshot(augmint.ethereumConnection.web3, snapshotId);
    });

    it("should callback onLoanProductActiveChange");

    it("should callback onNewLoanProduct");

    it("should callback onProduct");

    it("should callback onLoanRepaid");

    it("should callback onLoanCollected");

    it("should callback onNewLoan");
});
