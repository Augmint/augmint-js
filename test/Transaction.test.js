const chai = require("chai");
const { assert, expect } = chai;
const sinon = require("sinon");
chai.use(require("chai-as-promised"));
const { Augmint } = require("../dist/index.js");
const { EthereumConnection, Rates, Transaction } = Augmint;
const { TransactionError, TransactionSendError, AugmintJsError } = Augmint.Errors;
const { takeSnapshot, revertSnapshot, mine } = require("./testHelpers/ganache.js");
const loadEnv = require("./testHelpers/loadEnv.js");
const config = loadEnv();

describe("Transaction", () => {
    let ethereumConnection;

    let rates;

    let testContractTx;
    let accounts;
    let snapshotId;

    before(async () => {
        const myAugmint = Augmint.create(config);
        ethereumConnection = myAugmint.ethereumConnection;
        rates = myAugmint.rates;
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

        const onceTxHashSpy = sinon.spy();
        const onceReceiptSpy = sinon.spy();
        const onConfirmationSpy = sinon.spy();
        const onceConfirmedReceiptSpy = sinon.spy();
        const onceTxRevertSpy = sinon.spy();

        const tx = new Transaction(ethereumConnection, testContractTx);

        tx.send({ from: accounts[0] })
            .onceTxHash(onceTxHashSpy)
            .onceReceipt(onceReceiptSpy)
            .onConfirmation(onConfirmationSpy)
            .onceConfirmedReceipt(CONFIRMATION_NUMBER, onceConfirmedReceiptSpy)
            .onceTxRevert(onceTxRevertSpy);

        const txHash = await tx.getTxHash();
        const receipt = await tx.getTxReceipt();

        assert(txHash);
        assert(receipt.status);

        sinon.assert.calledWithExactly(onceTxHashSpy, txHash);
        sinon.assert.calledWithExactly(onceReceiptSpy, receipt);
        assert.equal(onConfirmationSpy.callCount, 0);
        assert.equal(onceConfirmedReceiptSpy.callCount, 0);
        assert.equal(onceTxRevertSpy.callCount, 0);

        // should receive confirmations and receipt after given number of confirmations
        const confirmedReceiptPromise = tx.getConfirmedReceipt(CONFIRMATION_NUMBER);
        await mine(ethereumConnection.web3, CONFIRMATION_NUMBER); // TODO: check if newer versions of web3js are genereating confirmations with ganache

        assert.equal(onConfirmationSpy.callCount, CONFIRMATION_NUMBER);
        sinon.assert.calledWithExactly(onConfirmationSpy, 1, receipt);

        const confirmedReceipt = await confirmedReceiptPromise;
        assert(confirmedReceipt.status);
        sinon.assert.calledWithExactly(onceConfirmedReceiptSpy, receipt);

        // confirmations should be still received after confirmaton
        await mine(ethereumConnection.web3, 1);
        assert.equal(onConfirmationSpy.callCount, CONFIRMATION_NUMBER + 1);
    });

    it("send Transaction to fail - tx REVERT", async () => {
        const CONFIRMATION_NUMBER = 3;

        const onceTxHashSpy = sinon.spy();
        const onceReceiptSpy = sinon.spy();
        const onConfirmationSpy = sinon.spy();
        const onceConfirmedReceiptSpy = sinon.spy();
        const onceTxRevertSpy = sinon.spy();

        const tx = new Transaction(ethereumConnection, testContractTx);

        let errorCaught;
        tx.onceTxHash(onceTxHashSpy)
            .onceReceipt(onceReceiptSpy)
            .onConfirmation(onConfirmationSpy)
            .onceConfirmedReceipt(CONFIRMATION_NUMBER, onceConfirmedReceiptSpy)
            .onceTxRevert((error, receipt, ...rest) => {
                assert.instanceOf(error, TransactionSendError);
                assert.instanceOf(error, AugmintJsError);
                assert.instanceOf(error, TransactionError);
                assert.match(error.message, /Transaction has been reverted by the EVM/);
                onceTxRevertSpy(error, receipt, ...rest);
                errorCaught = error;
            });

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

        sinon.assert.calledWithExactly(onceTxHashSpy, txHash);
        sinon.assert.calledWithExactly(onceReceiptSpy, receipt);
        sinon.assert.calledWithExactly(onceTxRevertSpy, errorCaught, receipt);
        assert.equal(onConfirmationSpy.callCount, 0);
        assert.equal(onceConfirmedReceiptSpy.callCount, 0);

        // should receive confirmations and a receipt after given number of confirmations
        const confirmedReceiptPromise = tx.getConfirmedReceipt(CONFIRMATION_NUMBER);
        await mine(ethereumConnection.web3, CONFIRMATION_NUMBER); // TODO: check if newer versions of web3js are genereating confirmations with ganache

        assert.equal(onConfirmationSpy.callCount, CONFIRMATION_NUMBER);
        sinon.assert.calledWithExactly(onConfirmationSpy.firstCall, 1, receipt);
        sinon.assert.calledWithExactly(onConfirmationSpy.lastCall, CONFIRMATION_NUMBER, receipt);

        const confirmedReceipt = await confirmedReceiptPromise;
        assert(!confirmedReceipt.status);
        sinon.assert.calledWithExactly(onceConfirmedReceiptSpy, confirmedReceipt);

        // confirmations should be still received
        await mine(ethereumConnection.web3, 1);
        assert.equal(onConfirmationSpy.callCount, CONFIRMATION_NUMBER + 1);
        sinon.assert.calledWithExactly(onConfirmationSpy.lastCall, CONFIRMATION_NUMBER + 1, receipt);
    });

    it("send Transaction to fail - not enough gas", async () => {
        const tx = new Transaction(ethereumConnection, testContractTx);

        const onceTxHashSpy = sinon.spy();
        const onceReceiptSpy = sinon.spy();
        const onConfirmationSpy = sinon.spy();
        const onceConfirmedReceiptSpy = sinon.spy();
        const onceTxRevertSpy = sinon.spy();

        tx.send({
            from: accounts[0],
            gas: 10000
        })
            .onceTxHash(onceTxHashSpy)
            .onceReceipt(onceReceiptSpy)
            .onConfirmation(onConfirmationSpy)
            .onceConfirmedReceipt(3, onceConfirmedReceiptSpy)
            .onceTxRevert(onceTxRevertSpy);

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

        const onceTxHashSpy = sinon.spy();
        const onceReceiptSpy = sinon.spy();
        const onConfirmationSpy = sinon.spy();
        const onceConfirmedReceiptSpy = sinon.spy();
        const onceTxRevertSpy = sinon.spy();

        const tx = new Transaction(ethereumConnection, testContractTx);

        tx.sign(PRIVATE_KEY, {
            from: accounts[0],
            to: rates.address,
            gasLimit: 100000
        })
            .send()
            .onceTxHash(onceTxHashSpy)
            .onceReceipt(onceReceiptSpy)
            .onConfirmation(onConfirmationSpy)
            .onceConfirmedReceipt(3, onceConfirmedReceiptSpy)
            .onceTxRevert(onceTxRevertSpy);

        const signedTx = await tx.getSignedTx();
        assert(tx.signedTx);
        assert.deepEqual(tx.signedTx, signedTx);

        const txHash = await tx.getTxHash();
        const receipt = await tx.getTxReceipt();

        assert(txHash);
        assert(receipt.status);

        sinon.assert.calledWithExactly(onceTxHashSpy, txHash);
        sinon.assert.calledWithExactly(onceReceiptSpy, receipt);
        assert.equal(onConfirmationSpy.callCount, 0);
        assert.equal(onceConfirmedReceiptSpy.callCount, 0);
        assert.equal(onceTxRevertSpy.callCount, 0);

        // should receive confirmations and receipt after given number of confirmations
        const confirmedReceiptPromise = tx.getConfirmedReceipt(CONFIRMATION_NUMBER);
        await mine(ethereumConnection.web3, CONFIRMATION_NUMBER); // TODO: check if newer versions of web3js are genereating confirmations with ganache

        assert.equal(onConfirmationSpy.callCount, CONFIRMATION_NUMBER);
        sinon.assert.calledWithExactly(onConfirmationSpy, 1, receipt);

        const confirmedReceipt = await confirmedReceiptPromise;
        assert(confirmedReceipt.status);
        sinon.assert.calledWithExactly(onceConfirmedReceiptSpy, receipt);

        // confirmations should be still received after confirmaton
        await mine(ethereumConnection.web3, 1);
        assert.equal(onConfirmationSpy.callCount, CONFIRMATION_NUMBER + 1);
    });

    it("getTxHash, getTxReceipt and getConfirmedReceipt timeout ");
});
