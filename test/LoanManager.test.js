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
// _loanManager.addLoanProduct(365 days, 854701, 1850000, 1000, 50000, true, 1500000); //  17% p.a., (collateral ratio: initial = 185%, minimum = 150%)
// _loanManager.addLoanProduct(180 days, 924753, 1850000, 1000, 50000, true, 1500000); // 16.5% p.a., (collateral ratio: initial = 185%, minimum = 150%)
// _loanManager.addLoanProduct(90 days, 962046, 1600000, 1000, 50000, true, 1200000); // 16%. p.a., (collateral ratio: initial = 160%, minimum = 120%)
// _loanManager.addLoanProduct(60 days, 975154, 1600000, 1000, 50000, true, 1200000); //  15.5% p.a., (collateral ratio: initial = 160%, minimum = 120%)
// _loanManager.addLoanProduct(30 days, 987822, 1600000, 1000, 50000, true, 1200000); //  15% p.a., (collateral ratio: initial = 160%, minimum = 120%)
// _loanManager.addLoanProduct(14 days, 994280, 1600000, 1000, 50000, true, 1200000); // 15% p.a., (collateral ratio: initial = 160%, minimum = 120%)
// _loanManager.addLoanProduct(7 days, 997132, 1600000, 1000, 50000, true, 1200000); // 15% p.a., (collateral ratio: initial = 160%, minimum = 120%)
// _loanManager.addLoanProduct(1 hours, 999000, 1230000, 2000, 50000, true, 1050000); // due in 1hr for testing repayments ~877% p.a., (collateral ratio: initial = 123%, minimum = 105%)
// _loanManager.addLoanProduct(1 seconds, 999000, 1110000, 3000, 50000, true, 1020000); // defaults in 1 secs for testing ~3156757% p.a., (collateral ratio: initial = 111%, minimum = 102%)

async function createMockProducts(augmint, loanManager) {
    const loanManagerAddress = augmint.ethereumConnection.web3.utils.toChecksumAddress(loanManager.address);
    const maxLoanAmount = (await getMaxLoanAmount(augmint, Tokens.of(30.00))).toNumber();

    return [
        mockProd(0, 365 * DAY_IN_SECS, .854701, 1.85, 10.00, .05, true, 1.5, maxLoanAmount, loanManagerAddress),
        mockProd(1, 180 * DAY_IN_SECS, .924753, 1.85, 10.00, .05, true, 1.5, maxLoanAmount, loanManagerAddress),
        mockProd(2, 90 * DAY_IN_SECS, .962046, 1.6, 10.00, .05, false, 1.2, maxLoanAmount, loanManagerAddress),    // will be disabled by before()
        mockProd(3, 60 * DAY_IN_SECS, .975154, 1.6, 10.00, .05, true, 1.2, maxLoanAmount, loanManagerAddress),
        mockProd(4, 30 * DAY_IN_SECS, .987822, 1.6, 10.00, .05, true, 1.2, maxLoanAmount, loanManagerAddress),
        mockProd(5, 14 * DAY_IN_SECS, .994280, 1.6, 10.00, .05, false, 1.2, maxLoanAmount, loanManagerAddress),    // will be disabled by before()
        mockProd(6, 7 * DAY_IN_SECS, .997132, 1.6, 10.00, .05, true, 1.2, maxLoanAmount, loanManagerAddress),
        mockProd(7, 60 * 60, .999000, 1.23, 20.00, .05, true, 1.05, maxLoanAmount, loanManagerAddress),
        mockProd(8, 1, .999000, 1.11, 30.00, .05, true, 1.02, maxLoanAmount, loanManagerAddress)
    ];
}

// (v1.0.12, fdf5fde95aa940c6dbfb8353c572c5fb)
// ===========================================
// 1003_add_legacyContracts:
// term (in sec), discountRate, collateralRatio (ppm, inverted), minDisbursedAmount (token), defaultingFeePt (ppm), isActive
// oldLoanManager.addLoanProduct(1, 999999, 990000, 1000, 50000, true), // defaults in 1 secs for testing ? p.a.
// oldLoanManager.addLoanProduct(3600, 999989, 980000, 1000, 50000, true), // due in 1hr for testing repayments ? p.a.
// oldLoanManager.addLoanProduct(31536000, 860000, 550000, 1000, 50000, true), // 365d, 14% p.a.

async function createLegacyMockProducts(augmint, loanManager) {
    const loanManagerAddress = augmint.ethereumConnection.web3.utils.toChecksumAddress(loanManager.address);
    const maxLoanAmount = (await getMaxLoanAmount(augmint, Tokens.of(10.00))).toNumber();

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
        minDisbursedAmount: Tokens.of(minDisbursedAmount),
        adjustedMinDisbursedAmount: calculateAdjustedMinDisbursedAmount(minDisbursedAmount),
        maxLoanAmount: Tokens.of(maxLoanAmount),
        defaultingFeePt: Ratio.of(defaultingFeePt),
        isActive: isActive,
        initialCollateralRatio: Ratio.of(initialCollateralRatio),
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

async function getMaxLoanAmount(augmint, minLoanAmount) {
    const contract = augmint.deployedEnvironment.getLatestContract("MonetarySupervisor").connect(augmint.ethereumConnection.web3);
    return Tokens.parse(await contract.methods.getMaxLoanAmount(minLoanAmount.toString()).call());
}

describe("LoanProduct", () => {
    const LoanProduct = Augmint.LoanManager.LoanProduct;

    it("should create a LoanProduct from a tuple", async () => {
        const expectedProd = mockProd(0, 365 * DAY_IN_SECS, .8547, 1.55, 10.00, .05, true, 1.5, 218.01);
        // Solidity LoanManager contract .getProducts() tuple:
        // [id, minDisbursedAmount, term, discountRate, initialCollateralRatio, defaultingFeePt, maxLoanAmount, isActive, minCollateralRatio ]
        const lp = new LoanProduct(["0", "1000", "31536000", "854700", "1550000", "50000", "21801", "1", "1500000"]);
        assert.deepEqual(normalizeBN(lp), expectedProd);
    });

    it("should create a legacy LoanProduct from a tuple", async () => {
        const expectedProd = mockLegacyProd(0, 365 * DAY_IN_SECS, .8547, .645161, 10.00, .05, true, 218.01);
        // Solidity LoanManager contract .getProducts() legacy tuple:
        // [id, minDisbursedAmount, term, discountRate, collateralRatio (inverted), defaultingFeePt, maxLoanAmount, isActive ]
        const lp = new LoanProduct(["0", "1000", "31536000", "854700", "645161", "50000", "21801", "1"]);
        assert.deepEqual(normalizeBN(lp), expectedProd);
    });

    it("should throw if creating with 0 term ", () => {
        expect(() => new LoanProduct(["99", "11", "0", "22", "33", "44", "55", "66"])).to.throw(
            AugmintJsError,
            /LoanProduct with 0 term/
        );
    });

    it("loan calculation simple test", () => {
        // numbers in this test case are the same as in contracts:test/loans.js
        const prod = new LoanProduct(["0", "1000", DAY_IN_SECS.toString(), "970000", "1600000", "50000", "21801", "1", "1200000"]);
        const ETH_FIAT_RATE = Tokens.of(998.00);
        const disbursedAmount = Tokens.of(30.25);
        const collateralAmount = Wei.of(0.05);

        // calculate from the collateral amount - same calculation as in the contract
        const valueFromCollateral = prod.calculateLoanFromCollateral(collateralAmount, ETH_FIAT_RATE);
        assert.equal(valueFromCollateral.disbursedAmount.toString(), Tokens.of(30.25).toString());
        assert.equal(valueFromCollateral.collateralAmount.toString(), Wei.of(0.05).toString());
        assert.equal(valueFromCollateral.repaymentAmount.toString(), Tokens.of(31.18).toString());
        assert.equal(valueFromCollateral.interestAmount.toString(), Tokens.of(.93).toString());

        // calculate back from the loan amount - reverse calculation as in the contract
        const valueFromLoan = prod.calculateLoanFromDisbursedAmount(disbursedAmount, ETH_FIAT_RATE);
        assert.equal(valueFromLoan.disbursedAmount.toString(), Tokens.of(30.25).toString());
        assert.closeTo(valueFromLoan.collateralAmount.toNumber(), Wei.of(0.05).toNumber(), 2e-5); // some precision is already lost
        assert.equal(valueFromLoan.repaymentAmount.toString(), Tokens.of(31.18).toString());
        assert.equal(valueFromLoan.interestAmount.toString(), Tokens.of(.93).toString());
    });

    it("should calculate loan values from disbursed amount", () => {
        // await loanManager.addLoanProduct(86400, 970000, 1600000, 3000, 50000, true, 1200000); // with margin (collateral ratio: initial = 160%, minimum = 120%)
        // collateral ratios: 62.5% is 160% inverted
        // [id, minDisbursedAmount, term, discountRate, initialCollateralRatio, defaultingFeePt, maxLoanAmount, isActive, minCollateralRatio ]
        const prod = new LoanProduct(["0", "1000", DAY_IN_SECS.toString(), "970000", "1600000", "50000", "21801", "1", "1200000"]);
        const legacyProd = new LoanProduct(["0", "1000", DAY_IN_SECS.toString(), "970000", "625000", "50000", "21801", "1"]);

        // assert that initial collateral ratio was properly inverted in case of a legacy product
        assert.equal(prod.getInitialCollateralRatio().toNumber(), Ratio.of(1.6).toNumber());
        assert.equal(legacyProd.getInitialCollateralRatio().toNumber(), Ratio.of(1.6).toNumber());

        const ETH_FIAT_RATE = Tokens.of(998.00);
        const EXPECTED_REPAY_BEFORE = new Date();
        EXPECTED_REPAY_BEFORE.setSeconds(EXPECTED_REPAY_BEFORE.getSeconds() + prod.termInSecs);

        const EXPECTED = {
            disbursedAmount: Tokens.of(30.25),
            collateralAmount: Wei.of(0.05),
            repaymentAmount: Tokens.of(31.18),
            interestAmount: Tokens.of(.93),
            repayBefore: EXPECTED_REPAY_BEFORE
        };

        const values = prod.calculateLoanFromDisbursedAmount(EXPECTED.disbursedAmount, ETH_FIAT_RATE);
        assert.closeTo(values.repayBefore.getTime(), EXPECTED.repayBefore.getTime(), 1000);
        assert.equal(values.disbursedAmount.toString(), EXPECTED.disbursedAmount.toString());
        assert.closeTo(values.collateralAmount.toNumber(), EXPECTED.collateralAmount.toNumber(), 2e-5);
        assert.equal(values.repaymentAmount.toString(), EXPECTED.repaymentAmount.toString());
        assert.equal(values.interestAmount.toString(), EXPECTED.interestAmount.toString());

        const legacyValues = legacyProd.calculateLoanFromDisbursedAmount(EXPECTED.disbursedAmount, ETH_FIAT_RATE);
        assert.closeTo(legacyValues.repayBefore.getTime(), EXPECTED.repayBefore.getTime(), 1000);
        assert.equal(legacyValues.disbursedAmount.toString(), EXPECTED.disbursedAmount.toString());
        assert.closeTo(legacyValues.collateralAmount.toNumber(), EXPECTED.collateralAmount.toNumber(), 2e-5);
        assert.equal(legacyValues.repaymentAmount.toString(), EXPECTED.repaymentAmount.toString());
        assert.equal(legacyValues.interestAmount.toString(), EXPECTED.interestAmount.toString());
    });

    it("should calculate loan values from collateral", () => {
        // [id, minDisbursedAmount, term, discountRate, initialCollateralRatio, defaultingFeePt, maxLoanAmount, isActive, minCollateralRatio ]
        const prod = new LoanProduct(["0", "1000", DAY_IN_SECS.toString(), "970000", "1600000", "50000", "21801", "1", "1200000"]);
        const legacyProd = new LoanProduct(["0", "1000", DAY_IN_SECS.toString(), "970000", "625000", "50000", "21801", "1"]);

        // assert that initial collateral ratio was properly inverted in case of a legacy product
        assert.equal(prod.getInitialCollateralRatio().toNumber(), Ratio.of(1.6).toNumber());
        assert.equal(legacyProd.getInitialCollateralRatio().toNumber(), Ratio.of(1.6).toNumber());

        const ETH_FIAT_RATE = Tokens.of(998.00);
        const EXPECTED_REPAY_BEFORE = new Date();
        EXPECTED_REPAY_BEFORE.setSeconds(EXPECTED_REPAY_BEFORE.getSeconds() + prod.termInSecs);

        const EXPECTED = {
            disbursedAmount: Tokens.of(30.25),
            collateralAmount: Wei.of(0.05),
            repaymentAmount: Tokens.of(31.18),
            interestAmount: Tokens.of(.93),
            repayBefore: EXPECTED_REPAY_BEFORE
        };

        const values = prod.calculateLoanFromCollateral(EXPECTED.collateralAmount, ETH_FIAT_RATE);
        assert.closeTo(values.repayBefore.getTime(), EXPECTED.repayBefore.getTime(), 1000);
        assert.equal(values.disbursedAmount.toString(), EXPECTED.disbursedAmount.toString());
        assert.equal(values.collateralAmount.toString(), EXPECTED.collateralAmount.toString());
        assert.equal(values.repaymentAmount.toString(), EXPECTED.repaymentAmount.toString());
        assert.equal(values.interestAmount.toString(), EXPECTED.interestAmount.toString());

        const legacyValues = legacyProd.calculateLoanFromCollateral(EXPECTED.collateralAmount, ETH_FIAT_RATE);
        assert.closeTo(legacyValues.repayBefore.getTime(), EXPECTED.repayBefore.getTime(), 1000);
        assert.equal(legacyValues.disbursedAmount.toString(), EXPECTED.disbursedAmount.toString());
        assert.equal(legacyValues.collateralAmount.toString(), EXPECTED.collateralAmount.toString());
        assert.equal(legacyValues.repaymentAmount.toString(), EXPECTED.repaymentAmount.toString());
        assert.equal(legacyValues.interestAmount.toString(), EXPECTED.interestAmount.toString());
    });

    // Note: negative interest rates are not in fact supported, but we calculate with them anyway
    it("should calculate loan values from disbursed amount (negative interest)", () => {
        // [id, minDisbursedAmount, term, discountRate, initialCollateralRatio, defaultingFeePt, maxLoanAmount, isActive, minCollateralRatio ]
        const prod = new LoanProduct(["0", "1000", DAY_IN_SECS.toString(), "1031915", "1600000", "50000", "21801", "1", "1200000"]);
        const legacyProd = new LoanProduct(["0", "1000", DAY_IN_SECS.toString(), "1031915", "625000", "50000", "21801", "1"]);

        const ETH_FIAT_RATE = Tokens.of(998.00);
        const EXPECTED_REPAY_BEFORE = new Date();
        EXPECTED_REPAY_BEFORE.setSeconds(EXPECTED_REPAY_BEFORE.getSeconds() + prod.termInSecs);

        const EXPECTED = {
            disbursedAmount: Tokens.of(32.18),
            collateralAmount: Wei.of(0.05),
            repaymentAmount: Tokens.of(31.18),
            interestAmount: Tokens.of(-1.00),
            repayBefore: EXPECTED_REPAY_BEFORE
        };

        const values = prod.calculateLoanFromDisbursedAmount(EXPECTED.disbursedAmount, ETH_FIAT_RATE);
        assert.closeTo(values.repayBefore.getTime(), EXPECTED.repayBefore.getTime(), 1000);
        assert.equal(values.disbursedAmount.toString(), EXPECTED.disbursedAmount.toString());
        assert.closeTo(values.collateralAmount.toNumber(), EXPECTED.collateralAmount.toNumber(), 2e-5);
        assert.equal(values.repaymentAmount.toString(), EXPECTED.repaymentAmount.toString());
        assert.equal(values.interestAmount.toString(), EXPECTED.interestAmount.toString());

        const legacyValues = legacyProd.calculateLoanFromDisbursedAmount(EXPECTED.disbursedAmount, ETH_FIAT_RATE);
        assert.closeTo(legacyValues.repayBefore.getTime(), EXPECTED.repayBefore.getTime(), 1000);
        assert.equal(legacyValues.disbursedAmount.toString(), EXPECTED.disbursedAmount.toString());
        assert.closeTo(legacyValues.collateralAmount.toNumber(), EXPECTED.collateralAmount.toNumber(), 2e-5);
        assert.equal(legacyValues.repaymentAmount.toString(), EXPECTED.repaymentAmount.toString());
        assert.equal(legacyValues.interestAmount.toString(), EXPECTED.interestAmount.toString());
    });

    // Note: negative interest rates are not in fact supported, but we calculate with them anyway
    it("should calculate loan values from collateral (negative interest)", () => {
        // [id, minDisbursedAmount, term, discountRate, initialCollateralRatio, defaultingFeePt, maxLoanAmount, isActive, minCollateralRatio ]
        const prod = new LoanProduct(["0", "1000", DAY_IN_SECS.toString(), "1031915", "1600000", "50000", "21801", "1", "1200000"]);
        const legacyProd = new LoanProduct(["0", "1000", DAY_IN_SECS.toString(), "1031915", "625000", "50000", "21801", "1"]);

        const ETH_FIAT_RATE = Tokens.of(998.00);
        const EXPECTED_REPAY_BEFORE = new Date();
        EXPECTED_REPAY_BEFORE.setSeconds(EXPECTED_REPAY_BEFORE.getSeconds() + prod.termInSecs);

        const EXPECTED = {
            disbursedAmount: Tokens.of(32.18),
            collateralAmount: Wei.of(0.05),
            repaymentAmount: Tokens.of(31.18),
            interestAmount: Tokens.of(-1.00),
            repayBefore: EXPECTED_REPAY_BEFORE
        };

        const values = prod.calculateLoanFromCollateral(EXPECTED.collateralAmount, ETH_FIAT_RATE);
        assert.closeTo(values.repayBefore.getTime(), EXPECTED.repayBefore.getTime(), 1000);
        assert.equal(values.disbursedAmount.toString(), EXPECTED.disbursedAmount.toString());
        assert.equal(values.collateralAmount.toString(), EXPECTED.collateralAmount.toString());
        assert.equal(values.repaymentAmount.toString(), EXPECTED.repaymentAmount.toString());
        assert.equal(values.interestAmount.toString(), EXPECTED.interestAmount.toString());

        const legacyValues = legacyProd.calculateLoanFromCollateral(EXPECTED.collateralAmount, ETH_FIAT_RATE);
        assert.closeTo(legacyValues.repayBefore.getTime(), EXPECTED.repayBefore.getTime(), 1000);
        assert.equal(legacyValues.disbursedAmount.toString(), EXPECTED.disbursedAmount.toString());
        assert.equal(legacyValues.collateralAmount.toString(), EXPECTED.collateralAmount.toString());
        assert.equal(legacyValues.repaymentAmount.toString(), EXPECTED.repaymentAmount.toString());
        assert.equal(legacyValues.interestAmount.toString(), EXPECTED.interestAmount.toString());
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

describe("LoanManager invalid calls", () => {
    let augmint;
    let loanManager;
    let legacyLoanManager;
    let products;
    let legacyProducts;
    let accounts;
    let snapshotId;

    before(async () => {
        augmint = await Augmint.create(config);
        loanManager = new Augmint.LoanManager(augmint.latestContracts.LoanManager.connect(augmint.ethereumConnection.web3), augmint.ethereumConnection);
        legacyLoanManager = augmint.getLegacyLoanManagers()[0];
        accounts = augmint.ethereumConnection.accounts;
        products = await loanManager.getAllProducts();
        legacyProducts = await legacyLoanManager.getAllProducts();

        snapshotId = await takeSnapshot(augmint.ethereumConnection.web3);
    });

    after(async () => {
        await revertSnapshot(augmint.ethereumConnection.web3, snapshotId);
    });

    it("does not allow invalid calls to newEthBackedLoan", async () => {
        // call the new loanmanager without minRate
        try {
            await loanManager.newEthBackedLoan(products[0], Wei.of(0.05), accounts[0]);
            assert.fail('should have failed')
        } catch (error) {
            if (error instanceof AugmintJsError) {
                assert.match(error.message, /missing minRate/);
            } else {
                throw error;
            }
        }

        // call the old loanmanager with minRate
        try {
            await legacyLoanManager.newEthBackedLoan(legacyProducts[0], Wei.of(0.05), accounts[0], Tokens.of(0));
            assert.fail('should have failed')
        } catch (error) {
            if (error instanceof AugmintJsError) {
                assert.match(error.message, /unexpected minRate/);
            } else {
                throw error;
            }
        }
    });

    it("does not allow invalid calls to addExtraCollateral ", async () => {
        // mock loan objects
        const loanObject = new Augmint.LoanManager.Loan([0, 100, 100, "0xaddress", 0, 0, 1234, 1234, 100, 10, 0, 0], loanManager.address);
        assert.isTrue(loanObject.isMarginLoan);
        const legacyLoanObject = new Augmint.LoanManager.Loan([0, 100, 100, "0xaddress", 0, 0, 1234, 1234, 100, 10], legacyLoanManager.address);
        assert.isFalse(legacyLoanObject.isMarginLoan);

        // just calls the new method on the legacy manager with a legacy loan object
        try {
            await legacyLoanManager.addExtraCollateral(legacyLoanObject, Wei.of(0.05), accounts[0]);
            assert.fail('should have failed')
        } catch (error) {
            if (error instanceof AugmintJsError) {
                assert.match(error.message, /invalid call/);
            } else {
                throw error;
            }
        }

        // passes a new loan object to the legacy manager
        try {
            await legacyLoanManager.addExtraCollateral(loanObject, Wei.of(0.05), accounts[0]);
            assert.fail('should have failed')
        } catch (error) {
            if (error instanceof AugmintJsError) {
                assert.match(error.message, /invalid call/);
            } else {
                throw error;
            }
        }

        // passes a legacy loan object to the new manager
        try {
            await loanManager.addExtraCollateral(legacyLoanObject, Wei.of(0.05), accounts[0]);
            assert.fail('should have failed')
        } catch (error) {
            if (error instanceof AugmintJsError) {
                assert.match(error.message, /invalid call/);
            } else {
                throw error;
            }
        }
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

        EXPECTED_ALL_PRODUCTS = await createMockProducts(augmint, loanManager);
        EXPECTED_ALL_LEGACY_PRODUCTS = await createLegacyMockProducts(augmint, legacyLoanManager);

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

    it("should return all legacy loan products", async () => {
        const products = await legacyLoanManager.getAllProducts();
        assert.deepEqual(normalizeBN(products), EXPECTED_ALL_LEGACY_PRODUCTS);
    });

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
        loanManager = augmint.latestContracts.LoanManager;
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
