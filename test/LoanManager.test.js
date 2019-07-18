const chai = require("chai");
const { assert, expect } = chai;
chai.use(require("chai-exclude"));

const { normalizeBN } = require("./testHelpers/normalize.js");
const { takeSnapshot, revertSnapshot } = require("./testHelpers/ganache.js");
const { Augmint, utils, Wei, Tokens, Ratio } = require("../dist/index.js");
const { AugmintJsError } = Augmint.Errors;
const loadEnv = require("./testHelpers/loadEnv.js");
const config = loadEnv();

const DAY_IN_SECS = 86400;

if (config.LOG) {
    utils.logger.level = config.LOG;
}


// ===== TEST DATA =====

// (v1.1.0, 753a73f4b2140507197a8f80bff47b40)
// ==========================================
// localTest_initialSetup:
// term (in sec), discountRate, initialCollateralRatio (ppm), minDisbursedAmount (token), defaultingFeePt (ppm), isActive, minCollateralRatio (ppm)
// _loanManager.addLoanProduct(365 days, 854701, 1818182, 1000, 50000, true, 1500000); //  17% p.a., (collateral ratio: initial = ~181%, minimum = 150%)
// _loanManager.addLoanProduct(180 days, 924753, 1818182, 1000, 50000, true, 1500000); // 16.5% p.a., (collateral ratio: initial = ~181%, minimum = 150%)
// _loanManager.addLoanProduct(90 days, 962046, 1666667, 1000, 50000, true, 1200000); // 16%. p.a., (collateral ratio: initial = ~166%, minimum = 120%)
// _loanManager.addLoanProduct(60 days, 975154, 1666667, 1000, 50000, true, 1200000); //  15.5% p.a., (collateral ratio: initial = ~166%, minimum = 120%)
// _loanManager.addLoanProduct(30 days, 987822, 1666667, 1000, 50000, true, 1200000); //  15% p.a., (collateral ratio: initial = ~166%, minimum = 120%)
// _loanManager.addLoanProduct(14 days, 994280, 1666667, 1000, 50000, true, 1200000); // 15% p.a., (collateral ratio: initial = ~166%, minimum = 120%)
// _loanManager.addLoanProduct(7 days, 997132, 1666667, 1000, 50000, true, 1200000); // 15% p.a., (collateral ratio: initial = ~166%, minimum = 120%)
// _loanManager.addLoanProduct(1 hours, 999998, 1020408, 2000, 50000, true, 1010000); // due in 1hr for testing repayments ~1.75% p.a., (collateral ratio: initial = ~102%, minimum = 101%)
// _loanManager.addLoanProduct(1 seconds, 999999, 1010101, 3000, 50000, true, 1010000); // defaults in 1 secs for testing ~3153.6% p.a., (collateral ratio: initial = ~101.01%, minimum = 101%)

function createMockProducts(augmint, loanManager) {
    const loanManagerAddress = augmint.ethereumConnection.web3.utils.toChecksumAddress(loanManager.address);

    // TODO: check the max loan amount: is it valid and came from the monetary supervisor
    const maxLoanAmount = 218.00;   // where did this come from?

    return [
        mockProd(0, 365 * DAY_IN_SECS, .854701, 1.818182, 10.00, .05, true, 1.5, maxLoanAmount, loanManagerAddress),
        mockProd(1, 180 * DAY_IN_SECS, .924753, 1.818182, 10.00, .05, true, 1.5, maxLoanAmount, loanManagerAddress),
        mockProd(2, 90 * DAY_IN_SECS, .962046, 1.666667, 10.00, .05, false, 1.2, maxLoanAmount, loanManagerAddress),    // will be disabled by before()
        mockProd(3, 60 * DAY_IN_SECS, .975154, 1.666667, 10.00, .05, true, 1.2, maxLoanAmount, loanManagerAddress),
        mockProd(4, 30 * DAY_IN_SECS, .987822, 1.666667, 10.00, .05, true, 1.2, maxLoanAmount, loanManagerAddress),
        mockProd(5, 14 * DAY_IN_SECS, .994280, 1.666667, 10.00, .05, false, 1.2, maxLoanAmount, loanManagerAddress),    // will be disabled by before()
        mockProd(6, 7 * DAY_IN_SECS, .997132, 1.666667, 10.00, .05, true, 1.2, maxLoanAmount, loanManagerAddress),
        mockProd(7, 60 * 60, .999998, 1.020408, 20.00, .05, true, 1.01, maxLoanAmount, loanManagerAddress),
        mockProd(8, 1, .999999, 1.010101, 30.00, .05, true, 1.01, maxLoanAmount, loanManagerAddress)
    ];
}

// (v1.0.12, fdf5fde95aa940c6dbfb8353c572c5fb)
// ===========================================
// 1003_add_legacyContracts:
// term (in sec), discountRate, collateralRatio (ppm, inverted), minDisbursedAmount (token), defaultingFeePt (ppm), isActive
// oldLoanManager.addLoanProduct(1, 999999, 990000, 1000, 50000, true), // defaults in 1 secs for testing ? p.a.
// oldLoanManager.addLoanProduct(3600, 999989, 980000, 1000, 50000, true), // due in 1hr for testing repayments ? p.a.
// oldLoanManager.addLoanProduct(31536000, 860000, 550000, 1000, 50000, true), // 365d, 14% p.a.

function createLegacyMockProducts(augmint, loanManager) {
    const loanManagerAddress = augmint.ethereumConnection.web3.utils.toChecksumAddress(loanManager.address);
    const maxLoanAmount = 218.00;
    return [
        mockLegacyProd(0, 1, .999999, .990000, 10.00, .05, true, maxLoanAmount, loanManagerAddress),
        mockLegacyProd(1, 60 * 60, .999989, .980000, 10.00, .05, false, maxLoanAmount, loanManagerAddress),    // will be disabled by before()
        mockLegacyProd(2, 365 * DAY_IN_SECS, .860000, .550000, 10.00, .05, true, maxLoanAmount, loanManagerAddress)
    ];
}

// Mock product (v1.1.0, 753a73f4b2140507197a8f80bff47b40)

// LoanManager.addLoanProduct:
// uint32 term                      term (in sec)
// uint32 discountRate              discountRate
// uint32 initialCollateralRatio    initialCollateralRatio (ppm)
// uint minDisbursedAmount          minDisbursedAmount (token)
// uint32 defaultingFeePt           defaultingFeePt (ppm)
// bool isActive                    isActive
// uint32 minCollateralRatio        minCollateralRatio (ppm)

function mockProd(
    id, // loanproduct id (zero based index)
    termInSecs,
    discountRate,
    initialCollateralRatio,
    minDisbursedAmount,
    defaultingFeePt,
    isActive,
    minCollateralRatio,
    maxLoanAmount, // not part of the loanproduct in the LoanManager, only added to the tuple in getProducts(), actually comes from the MonetarySupervisor
    loanManagerAddress  // it is just the address where it came from, to keep track of the origin of each product
) {
    // Note: you have to return them in this weird order, as deepEqual will assert this specific order.
    return {
        id,
        termInSecs,
        discountRate: Ratio.of(discountRate),
        interestRatePa: calculateInterestRatePa(termInSecs, Ratio.of(discountRate)),
        collateralRatio: Ratio.of(initialCollateralRatio),  // FIXME: it is now called "initialCollateralRatio"
        minDisbursedAmount: Tokens.of(minDisbursedAmount),
        adjustedMinDisbursedAmount: calculateAdjustedMinDisbursedAmount(minDisbursedAmount),
        maxLoanAmount: Tokens.of(maxLoanAmount),
        defaultingFeePt: Ratio.of(defaultingFeePt),
        isActive: isActive,
        minCollateralRatio: Ratio.of(minCollateralRatio),
        loanManagerAddress: loanManagerAddress,
    };
}

// Mock product, legacy (v1.0.12, fdf5fde95aa940c6dbfb8353c572c5fb)
function mockLegacyProd(
    id,
    termInSecs,
    discountRate,
    collateralRatio,
    minDisbursedAmount,
    defaultingFeePt,
    isActive,
    maxLoanAmount,
    loanManagerAddress
) {
    return {
        id,
        termInSecs,
        discountRate: Ratio.of(discountRate),
        interestRatePa: calculateInterestRatePa(termInSecs, Ratio.of(discountRate)),
        collateralRatio: Ratio.of(collateralRatio),
        minDisbursedAmount: Tokens.of(minDisbursedAmount),
        minCollateralRatio: Ratio.of(0),  // FIXME: should not be here, there was no such property in that version
        adjustedMinDisbursedAmount: calculateAdjustedMinDisbursedAmount(minDisbursedAmount),
        maxLoanAmount: Tokens.of(maxLoanAmount),
        defaultingFeePt: Ratio.of(defaultingFeePt),
        isActive: isActive,
        loanManagerAddress: loanManagerAddress,
    };
}

function calculateInterestRatePa(termInSecs, discountRate) {
    const termInDays = termInSecs / DAY_IN_SECS;
    const irpa = (1000000 / discountRate - 1) * (365 / termInDays);
    return Math.round(irpa * 10000) / 10000;
}

function calculateAdjustedMinDisbursedAmount(minDisbursedAmount) {
    return Tokens.of(minDisbursedAmount * Augmint.constants.MIN_LOAN_AMOUNT_ADJUSTMENT.toNumber());
}


describe("LoanProduct", () => {
    const LoanProduct = Augmint.LoanManager.LoanProduct;

    it("should create a LoanProduct from a tuple", async () => {
        const expectedProd = mockProd(0, 365 * DAY_IN_SECS, .8547, 1.55, 10.00, .05, true, 1.5, 218.01);
        // Solidity LoanManager contract .getProducts() tuple:
        // [id, minDisbursedAmount, term, discountRate, collateralRatio, defaultingFeePt, maxLoanAmount, isActive, minCollateralRatio ]
        const lp = new LoanProduct(["0", "1000", "31536000", "854700", "1550000", "50000", "21801", "1", "1500000"]);
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
        const loanManager = augmint.latestContracts.LoanManager;
        assert.equal(augmint.ethereumConnection.web3.utils.toChecksumAddress(loanManager.deployedAddress), "0x213135c85437C23bC529A2eE9c2980646c332fCB");
    });

    it("should connect to supported legacy LoanManager contracts", () => {
        const checkSumFun = augmint.ethereumConnection.web3.utils.toChecksumAddress;
        const legacyAddresses = Augmint.constants.SUPPORTED_LEGACY_LOANMANAGERS[augmint.deployedEnvironment.name]
            .map(address => checkSumFun(address));
        const connectedAddresses = augmint.getLegacyLoanManagers()
            .map(contract => checkSumFun(contract.address));
        assert.deepEqual(connectedAddresses, legacyAddresses);

        // we expect one legacy address
        assert.equal(legacyAddresses.length, 1);
        assert.equal(legacyAddresses[0], '0xF7B8384c392fc333d3858a506c4F1506af44D53c');
    });
});

describe("LoanManager getters", () => {
    let augmint;
    let accounts;
    let loanManager;
    let legacyLoanManager;
    let snapshotId;

    let EXPECTED_ALL_PRODUCTS;
    let EXPECTED_ALL_LEGACY_PRODUCTS;
    let EXPECTED_ACTIVE_PRODUCTS;
    let EXPECTED_ACTIVE_LEGACY_PRODUCTS;

    before(async () => {
        augmint = await Augmint.create(config);
        accounts = augmint.ethereumConnection.accounts;
        loanManager = new Augmint.LoanManager(augmint.latestContracts.LoanManager.connect(augmint.ethereumConnection.web3), augmint.ethereumConnection);
        legacyLoanManager = augmint.getLegacyLoanManagers()[0];

        EXPECTED_ALL_PRODUCTS = createMockProducts(augmint, loanManager);
        EXPECTED_ALL_LEGACY_PRODUCTS = createLegacyMockProducts(augmint, legacyLoanManager);

        EXPECTED_ACTIVE_PRODUCTS = EXPECTED_ALL_PRODUCTS.filter(p => p.isActive);
        EXPECTED_ACTIVE_LEGACY_PRODUCTS = EXPECTED_ALL_LEGACY_PRODUCTS.filter(p => p.isActive);

        snapshotId = await takeSnapshot(augmint.ethereumConnection.web3);

        await Promise.all([
            loanManager.instance.methods.setLoanProductActiveState(2, false).send({ from: accounts[0] }),
            loanManager.instance.methods.setLoanProductActiveState(5, false).send({ from: accounts[0] }),
            legacyLoanManager.instance.methods.setLoanProductActiveState(1, false).send({ from: accounts[0] })
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

    // FIXME: legacy loanmanager returns new loanproduct type, not legacy
    it("should return all legacy loan products", async () => {
        const products = await legacyLoanManager.getAllProducts();
        assert.deepEqual(normalizeBN(products), EXPECTED_ALL_LEGACY_PRODUCTS);
    });

    // FIXME: legacy loanmanager returns new loanproduct type, not legacy
    it("should return active legacy loan products", async () => {
        const products = await legacyLoanManager.getActiveProducts();
        assert.deepEqual(normalizeBN(products), EXPECTED_ACTIVE_LEGACY_PRODUCTS);
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
