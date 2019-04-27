const chai = require("chai");
const { assert, expect } = chai;
const sinon = require("sinon");
chai.use(require("chai-as-promised"));
const { Transaction } = require("../dist/Transaction.js");
const { Augmint, utils } = require("../dist/index.js");
const { EthereumConnection, Rates } = Augmint;
const { TransactionError, TransactionSendError, AugmintJsError } = require("../dist/Errors.js");
const { takeSnapshot, revertSnapshot, mine } = require("./testHelpers/ganache.js");

describe("Transaction", () => {
    const config = utils.loadEnv();
    const ethereumConnection = new EthereumConnection(config);

    const rates = new Rates();

    let testContractTx;
    let accounts;
    let snapshotId;

    before(async () => {
        await ethereumConnection.connect();
        await rates.connect(ethereumConnection);
        const BYTES_CCY = ethereumConnection.web3.utils.asciiToHex("TESTCCY");
        testContractTx = rates.instance.methods.setRate(BYTES_CCY, 100);
        accounts = ethereumConnection.accounts;
    });

    beforeEach(async () => {
        snapshotId = await takeSnapshot(ethereumConnection.web3);
    });

    afterEach(async () => {
        await revertSnapshot(ethereumConnection.web3, snapshotId);
    });

    it("new Transaction missing params should throw ", () => {
        try {
            new Transaction();
        } catch (error) {
            assert.instanceOf(error, AugmintJsError);
            assert.instanceOf(error, TransactionError);
        }
        try {
            new Transaction(ethereumConnection);
        } catch (error) {
            assert.instanceOf(error, AugmintJsError);
            assert.instanceOf(error, TransactionError);
        }
    });

    it("getTx{Hash|Receipt|Confirmation} before send should be rejected ", async () => {
        const tx = new Transaction(ethereumConnection, testContractTx);
        expect(tx.getTxHash()).to.be.rejectedWith(TransactionError);
        expect(tx.getTxReceipt()).to.be.rejectedWith(TransactionError);
        expect(tx.getConfirmedReceipt()).to.be.rejectedWith(TransactionError);
    });

    it("send transaction missing params should throw", async () => {
        const tx = new Transaction(ethereumConnection, testContractTx);
        assert.throws(() => tx.send(), TransactionError);
    });

    it("send Transaction success", async () => {
        const CONFIRMATION_NUMBER = 5;

        const txHashSpy = sinon.spy();
        const receiptSpy = sinon.spy();
        const confirmationSpy = sinon.spy();
        const anyErrorSpy = sinon.spy();

        const onceTxHashSpy = sinon.spy();
        const onceReceiptSpy = sinon.spy();
        const onConfirmationSpy = sinon.spy();
        const onceConfirmedReceiptSpy = sinon.spy();

        const tx = new Transaction(ethereumConnection, testContractTx);

        tx.on("error", anyErrorSpy);
        tx.on("txRevert", anyErrorSpy);

        tx.on("receipt", receiptSpy);
        tx.on("confirmation", confirmationSpy);
        tx.on("transactionHash", txHashSpy);

        tx.onceTxHash(onceTxHashSpy)
            .onceReceipt(onceReceiptSpy)
            .onConfirmation(onConfirmationSpy)
            .onceConfirmedReceipt(CONFIRMATION_NUMBER, onceConfirmedReceiptSpy)

            .onceTxRevert(anyErrorSpy);

        tx.send({ from: accounts[0] });

        const txHash = await tx.getTxHash();
        const receipt = await tx.getTxReceipt();

        assert(txHash);
        assert(receipt.status);

        sinon.assert.calledWithExactly(txHashSpy, txHash);
        sinon.assert.calledWithExactly(receiptSpy, receipt);
        assert.equal(confirmationSpy.callCount, 0);

        sinon.assert.calledWithExactly(onceTxHashSpy, txHash);
        sinon.assert.calledWithExactly(onceReceiptSpy, receipt);
        assert.equal(onConfirmationSpy.callCount, 0);
        assert.equal(onceConfirmedReceiptSpy.callCount, 0);

        assert.equal(anyErrorSpy.callCount, 0);

        // should receive receipt after given number of confirmations
        const confirmedReceiptPromise = tx.getConfirmedReceipt(CONFIRMATION_NUMBER);
        await mine(ethereumConnection.web3, CONFIRMATION_NUMBER); // TODO: check if newer versions of web3js are genereating confirmations with ganache
        const confirmedReceipt = await confirmedReceiptPromise;
        assert(confirmedReceipt.status);

        assert.equal(confirmationSpy.callCount, CONFIRMATION_NUMBER);
        sinon.assert.calledWith(confirmationSpy, 1, receipt);

        sinon.assert.calledWithExactly(onceConfirmedReceiptSpy, receipt);

        assert.equal(onConfirmationSpy.callCount, CONFIRMATION_NUMBER);
        sinon.assert.calledWithExactly(onConfirmationSpy, 1, receipt);

        // confirmations should be still received after confirmaton
        await mine(ethereumConnection.web3, 1);
        assert.equal(confirmationSpy.callCount, CONFIRMATION_NUMBER + 1);
        assert.equal(onConfirmationSpy.callCount, CONFIRMATION_NUMBER + 1);
    });

    it("send Transaction to fail - tx REVERT", async () => {
        const CONFIRMATION_NUMBER = 3;
        const txHashSpy = sinon.spy();
        const receiptSpy = sinon.spy();
        const confirmationSpy = sinon.spy();

        const errorSpy = sinon.spy();
        const txRevertSpy = sinon.spy();

        const onceTxHashSpy = sinon.spy();
        const onceReceiptSpy = sinon.spy();
        const onConfirmationSpy = sinon.spy();
        const onceConfirmedReceiptSpy = sinon.spy();
        const onceTxRevertSpy = sinon.spy();

        const tx = new Transaction(ethereumConnection, testContractTx);

        tx.on("error", errorSpy);
        tx.on("txRevert", txRevertSpy);

        tx.on("receipt", receiptSpy);
        tx.on("confirmation", confirmationSpy);
        tx.on("transactionHash", txHashSpy);

        tx.onceTxHash(onceTxHashSpy)
            .onceReceipt(onceReceiptSpy)
            .onConfirmation(onConfirmationSpy)
            .onceConfirmedReceipt(CONFIRMATION_NUMBER, onceConfirmedReceiptSpy)
            .onceTxRevert(onceTxRevertSpy);

        tx.send({
            from: accounts[1]
        });

        const txHash = await tx.getTxHash().catch(error => {
            // --noVMErrorsOnRPCResponse flag needed to this test to pass.
            // Ganache doesn't return txHash for reverting tx-s without --noVMErrorsOnRPCResponse
            throw new Error(
                "TEST ERROR: getTxHash rejected with Error. Are you running ganache with --noVMErrorsOnRPCResponse flag? Error received:\n" +
                    error
            );
        });

        const receipt = await tx.getTxReceipt();

        assert(txHash);
        assert(!receipt.status);

        sinon.assert.calledWithExactly(txHashSpy, txHash);
        sinon.assert.calledWithExactly(receiptSpy, receipt);
        assert.equal(receiptSpy.callCount, 1);
        assert.equal(txRevertSpy.callCount, 1);
        assert.equal(errorSpy.callCount, 1);
        assert.equal(confirmationSpy.callCount, 0);

        sinon.assert.calledWithExactly(onceTxHashSpy, txHash);
        sinon.assert.calledWithExactly(onceReceiptSpy, receipt);
        sinon.assert.calledWithExactly(onceTxRevertSpy, errorSpy.args[0][0], receipt);
        assert.equal(onConfirmationSpy.callCount, 0);
        assert.equal(onceConfirmedReceiptSpy.callCount, 0);

        // should receive receipt after given number of confirmations
        const confirmedReceiptPromise = tx.getConfirmedReceipt(CONFIRMATION_NUMBER);
        await mine(ethereumConnection.web3, CONFIRMATION_NUMBER); // TODO: check if newer versions of web3js are genereating confirmations with ganache
        const confirmedReceipt = await confirmedReceiptPromise;
        assert(!confirmedReceipt.status);
        sinon.assert.calledWithExactly(onceConfirmedReceiptSpy, confirmedReceipt);

        assert.equal(confirmationSpy.callCount, CONFIRMATION_NUMBER);

        // confirmations should be received after confirmaton
        await mine(ethereumConnection.web3, 1);
        assert.equal(confirmationSpy.callCount, CONFIRMATION_NUMBER + 1);
        assert.equal(onConfirmationSpy.callCount, CONFIRMATION_NUMBER + 1);
    });

    it("send Transaction to fail - not enough gas", async () => {
        const txHashSpy = sinon.spy();
        const receiptSpy = sinon.spy();
        const confirmationSpy = sinon.spy();
        const errorSpy = sinon.spy();
        const txRevertSpy = sinon.spy();

        const tx = new Transaction(ethereumConnection, testContractTx);

        tx.on("error", errorSpy);
        tx.on("txRevert", txRevertSpy);
        tx.on("receipt", receiptSpy);
        tx.on("confirmation", confirmationSpy);
        tx.on("transactionHash", txHashSpy);

        const onceTxHashSpy = sinon.spy();
        const onceReceiptSpy = sinon.spy();
        const onConfirmationSpy = sinon.spy();
        const onceConfirmedReceiptSpy = sinon.spy();
        const onceTxRevertSpy = sinon.spy();

        tx.onceTxHash(onceTxHashSpy)
            .onceReceipt(onceReceiptSpy)
            .onConfirmation(onConfirmationSpy)
            .onceConfirmedReceipt(3, onceConfirmedReceiptSpy)
            .onceTxRevert(onceTxRevertSpy);

        tx.send({
            from: accounts[0],
            gas: 10000
        });

        let errorCaught;
        const txHash = await tx.getTxHash().catch(error => {
            assert.instanceOf(error, TransactionSendError);
            assert.instanceOf(error, AugmintJsError);
            assert.instanceOf(error, TransactionError);
            assert.match(error.message, /base fee exceeds gas limit/); // test sanity check
            assert.deepEqual(tx.sendError, error);
            errorCaught = error;
        });
        assert.isUndefined(txHash);

        const receipt = await tx.getTxReceipt().catch(error => {
            assert.deepEqual(error, errorCaught);
        });
        assert.isUndefined(receipt);

        const confirmedReceipt = await tx.getConfirmedReceipt(3).catch(error => {
            assert.deepEqual(error, errorCaught);
        });
        assert.isUndefined(confirmedReceipt);

        assert.equal(txHashSpy.callCount, 0);
        assert.equal(receiptSpy.callCount, 0);
        assert.equal(errorSpy.callCount, 1);

        sinon.assert.calledWithExactly(errorSpy, errorCaught, receipt);
        assert.equal(txRevertSpy.callCount, 0);
        assert.equal(confirmationSpy.callCount, 0);

        assert.equal(onceTxHashSpy.callCount, 0);
        assert.equal(onConfirmationSpy.callCount, 0);
        assert.equal(onceConfirmedReceiptSpy.callCount, 0);
        assert.equal(onceTxRevertSpy.callCount, 0);
        assert.equal(onceConfirmedReceiptSpy.callCount, 0);
    });

    it("sign and send tx", async () => {
        // private key of accounts[0] 0x76e7a 0aec3e43211395bbbb6fa059bd6750f83c3with the hardcoded mnemonin for ganache
        const PRIVATE_KEY = "0x85b3d743fbe4ec4e2b58947fa5484da7b2f5538b0ae8e655646f94c95d5fb949";
        const CONFIRMATION_NUMBER = 5;
        const txHashSpy = sinon.spy();
        const receiptSpy = sinon.spy();
        const confirmationSpy = sinon.spy();
        const anyErrorSpy = sinon.spy();

        const tx = new Transaction(ethereumConnection, testContractTx);

        tx.on("error", anyErrorSpy);
        tx.on("txRevert", anyErrorSpy);

        tx.on("receipt", receiptSpy);
        tx.on("confirmation", confirmationSpy);
        tx.on("transactionHash", txHashSpy);

        tx.sign(PRIVATE_KEY, {
            from: accounts[0],
            to: rates.address,
            gasLimit: 100000
        });

        const signedTx = await tx.getSignedTx();

        assert(tx.signedTx);
        assert.deepEqual(tx.signedTx, signedTx);

        const txHash = await tx.send().getTxHash();

        const txHash2 = await tx.getTxHash();
        const receipt = await tx.getTxReceipt();

        assert(txHash);
        assert(txHash, txHash2);
        assert(receipt.status);

        sinon.assert.calledWithExactly(txHashSpy, txHash);
        sinon.assert.calledWithExactly(receiptSpy, receipt);
        assert.equal(anyErrorSpy.callCount, 0);
        assert.equal(confirmationSpy.callCount, 0);

        // should receive receipt after given number of confirmations
        const confirmedReceiptPromise = tx.getConfirmedReceipt(CONFIRMATION_NUMBER);
        await mine(ethereumConnection.web3, CONFIRMATION_NUMBER); // TODO: check if newer versions of web3js are genereating confirmations with ganache
        const confirmedReceipt = await confirmedReceiptPromise;
        assert(confirmedReceipt.status);
        assert.equal(confirmationSpy.callCount, CONFIRMATION_NUMBER);
        sinon.assert.calledWith(confirmationSpy, 1, receipt);

        // confirmations should be still received after confirmaton
        await mine(ethereumConnection.web3, 1);
        assert.equal(confirmationSpy.callCount, CONFIRMATION_NUMBER + 1);
    });

    it("getTxReceipt and getConfirmedReceipt timeout ");
});
