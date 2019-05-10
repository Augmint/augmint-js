const { assert } = require("chai");
const BN = require("bn.js");
const { takeSnapshot, revertSnapshot } = require("./testHelpers/ganache.js");
const { Augmint, utils } = require("../dist/index.js");
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
    termInSecs,
    discountRate,
    interestRatePa,
    collateralRatio,
    minDisbursedAmount,
    adjustedMinDisbursedAmount,
    maxLoanAmount,
    defaultingFeePt,
    isActive
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

describe("LoanManager getters", () => {
    const EXPECTED_ALL_PRODUCTS = [
        // id, termInSecs, discountRate, interestRatePa, collateralRatio, minDisbursedAmount, adjustedMinDisbursedAmount, maxLoanAmount, defaultingFeePt, isActive
        mockProd(0, 31536000, 854700, 0.17, 550000, 1000, 1250, 21801, 50000, true),
        mockProd(1, 15552000, 924752, 0.165, 550000, 1000, 1250, 21801, 50000, true),
        mockProd(2, 7776000, 962045, 0.16, 600000, 1000, 1250, 21801, 50000, false),
        mockProd(3, 5184000, 975153, 0.155, 600000, 1000, 1250, 21801, 50000, true),
        mockProd(4, 2592000, 987821, 0.15, 600000, 1000, 1250, 21801, 50000, true),
        mockProd(5, 1209600, 994279, 0.15, 600000, 1000, 1250, 21801, 50000, false),
        mockProd(6, 604800, 997132, 0.15, 600000, 1000, 1250, 21801, 50000, true),
        mockProd(7, 3600, 999998, 0.0175, 980000, 2000, 2500, 21801, 50000, true),
        mockProd(8, 1, 999999, 31.536, 990000, 3000, 3750, 21801, 50000, true)
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
