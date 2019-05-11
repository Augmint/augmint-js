const { assert, expect } = require("chai");
const BN = require("bn.js");
const { takeSnapshot, revertSnapshot } = require("./testHelpers/ganache.js");
const { Augmint, utils } = require("../dist/index.js");
const { AugmintJsError } = Augmint.Errors;
const loadEnv = require("./testHelpers/loadEnv.js");
const config = loadEnv();

if (config.LOG) {
    utils.logger.level = config.LOG;
}

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
        discountRate: new BN(discountRate),
        interestRatePa,
        collateralRatio: new BN(collateralRatio),
        minDisbursedAmount: new BN(minDisbursedAmount),
        adjustedMinDisbursedAmount: new BN(adjustedMinDisbursedAmount),
        maxLoanAmount: new BN(maxLoanAmount),
        defaultingFeePt: new BN(defaultingFeePt),
        isActive
    };
}
describe.only("LoanProduct", () => {
    const LoanProduct = Augmint.LoanManager.LoanProduct;

    it("should create a LoanProduct from a tuple", async () => {
        const expectedProd = mockProd(0, 1000, 31536000, 854700, 550000, 50000, 21801, true, 0.17, 1250);
        // Solidity LoanManager contract .getProducts() tuple:
        // [id, minDisbursedAmount, term, discountRate, collateralRatio, defaultingFeePt, maxLoanAmount, isActive ]
        const lp = new LoanProduct(["0", "1000", "31536000", "854700", "550000", "50000", "21801", "1"]);
        assert.deepEqual(lp, expectedProd);
    });

    it("should throw if creating with 0 term ", () => {
        expect(() => new LoanProduct(["99", "11", "0", "22", "33", "44", "55", "66"])).to.throw(
            AugmintJsError,
            /LoanProduct with 0 term/
        );
    });
});

describe.only("LoanManager getters", () => {
    const EXPECTED_ALL_PRODUCTS = [
        // id,minDisbursedAmount,termInSecs,discountRate,collateralRatio,defaultingFeePt,maxLoanAmount,isActive,interestRatePa,adjustedMinDisbursedAmount
        mockProd(0, 1000, 31536000, 854700, 550000, 50000, 21801, true, 0.17, 1250),
        mockProd(1, 1000, 15552000, 924752, 550000, 50000, 21801, true, 0.165, 1250),
        mockProd(2, 1000, 7776000, 962045, 600000, 50000, 21801, false, 0.16, 1250),
        mockProd(3, 1000, 5184000, 975153, 600000, 50000, 21801, true, 0.155, 1250),
        mockProd(4, 1000, 2592000, 987821, 600000, 50000, 21801, true, 0.15, 1250),
        mockProd(5, 1000, 1209600, 994279, 600000, 50000, 21801, false, 0.15, 1250),
        mockProd(6, 1000, 604800, 997132, 600000, 50000, 21801, true, 0.15, 1250),
        mockProd(7, 2000, 3600, 999998, 980000, 50000, 21801, true, 0.0175, 2500),
        mockProd(8, 3000, 1, 999999, 990000, 50000, 21801, true, 31.536, 3750)
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
        assert.deepEqual(products, EXPECTED_ALL_PRODUCTS);
    });

    it("should return active loan products", async () => {
        const products = await loanManager.getActiveProducts();
        assert.deepEqual(products, EXPECTED_ACTIVE_PRODUCTS);
    });

    it("should calculate loan values from disbursed loan amount");

    it("should calculate loan values from collateral");
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

// function debugPrintProducts(products) {
//     products.forEach(p =>
//         //     products.forEach(p =>
//         //         console.log(
//         //             `id: ${p.id} isActive: ${p.isActive} termInSecs: ${p.termInSecs} interestRatePa: ${p.interestRatePa}
//         // collateralRatio: ${p.collateralRatio} discountRate: ${p.discountRate.toString()}
//         // minDisbursedAmount: ${p.minDisbursedAmount} adjustedMinDisbursedAmount: ${p.adjustedMinDisbursedAmount}
//         // maxLoanAmount: ${p.maxLoanAmount} defaultingFeePt: ${p.defaultingFeePt}`
//         //         )
//         //     );

//         console.log(
//             `mockProd(${p.id}, ${p.termInSecs}, ${p.discountRate}, ${p.interestRatePa}, ${p.collateralRatio}, ${
//                 p.minDisbursedAmount
//             }, ${p.adjustedMinDisbursedAmount}, ${p.maxLoanAmount}, ${p.defaultingFeePt}, ${p.isActive}),`
//         )
//     );
// }
