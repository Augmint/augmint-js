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
        expect(tx.getTxConfirmation()).to.be.rejectedWith(TransactionError);
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
        const errorSpy = sinon.spy();

        const tx = new Transaction(ethereumConnection, testContractTx);

        tx.on("error", errorSpy);
        tx.on("receipt", receiptSpy);
        tx.on("confirmation", confirmationSpy);
        tx.on("transactionHash", txHashSpy);

        const txHash = await tx.send({ from: accounts[0] }).getTxHash();

        const txHash2 = await tx.getTxHash();
        const receipt = await tx.getTxReceipt();

        assert(txHash);
        assert(txHash, txHash2);
        assert(receipt.status);

        sinon.assert.calledWithExactly(txHashSpy, txHash);
        sinon.assert.calledWithExactly(receiptSpy, receipt);
        assert.equal(errorSpy.callCount, 0);
        assert.equal(confirmationSpy.callCount, 0);

        // should receive receipt after given number of confirmations
        const confirmedReceiptPromise = tx.getTxConfirmation(CONFIRMATION_NUMBER);
        await mine(ethereumConnection.web3, CONFIRMATION_NUMBER); // TODO: check if newer versions of web3js are genereating confirmations with ganache
        const confirmedReceipt = await confirmedReceiptPromise;
        assert(confirmedReceipt.status);
        assert.equal(confirmationSpy.callCount, CONFIRMATION_NUMBER);
        sinon.assert.calledWith(confirmationSpy, 1, receipt);

        // confirmations should be still received after confirmaton
        await mine(ethereumConnection.web3, 1);
        assert.equal(confirmationSpy.callCount, CONFIRMATION_NUMBER + 1);
    });

    it("send Transaction to fail - EVM error", async () => {
        const CONFIRMATION_NUMBER = 3;
        const txHashSpy = sinon.spy();
        const receiptSpy = sinon.spy();
        const confirmationSpy = sinon.spy();
        const errorSpy = sinon.spy();

        const tx = new Transaction(ethereumConnection, testContractTx);

        tx.on("error", errorSpy);
        tx.on("receipt", receiptSpy);
        tx.on("confirmation", confirmationSpy);
        tx.on("transactionHash", txHashSpy);

        const txHash = await tx
            .send({
                from: accounts[1]
            })
            .getTxHash();

        const txHash2 = await tx.getTxHash();
        const receipt = await tx.getTxReceipt();

        assert(txHash);
        assert(txHash, txHash2);
        assert(!receipt.status);

        sinon.assert.calledWithExactly(txHashSpy, txHash);
        // sinon.assert.calledWithExactly(receiptSpy, receipt);
        assert.equal(receiptSpy.callCount, 1);
        assert.equal(errorSpy.callCount, 1);
        assert.equal(confirmationSpy.callCount, 0);

        // should receive receipt after given number of confirmations
        const confirmedReceiptPromise = tx.getTxConfirmation(CONFIRMATION_NUMBER);
        await mine(ethereumConnection.web3, CONFIRMATION_NUMBER); // TODO: check if newer versions of web3js are genereating confirmations with ganache
        const confirmedReceipt = await confirmedReceiptPromise;
        assert(!confirmedReceipt.status);

        assert.equal(confirmationSpy.callCount, CONFIRMATION_NUMBER);

        // confirmations should be received after confirmaton
        await mine(ethereumConnection.web3, 1);
        assert.equal(confirmationSpy.callCount, CONFIRMATION_NUMBER + 1);
    });

    it("send Transaction to fail - not enough gas", async () => {
        const txHashSpy = sinon.spy();
        const receiptSpy = sinon.spy();
        const confirmationSpy = sinon.spy();
        const errorSpy = sinon.spy();

        const tx = new Transaction(ethereumConnection, testContractTx);

        tx.on("error", errorSpy);
        tx.on("receipt", receiptSpy);
        tx.on("confirmation", confirmationSpy);
        tx.on("transactionHash", txHashSpy);

        const txHash = await tx
            .send({
                from: accounts[0],
                gas: 10000
            })
            .getTxHash()
            .catch(error => {
                assert.instanceOf(tx.sendError, TransactionSendError);
                assert.instanceOf(tx.sendError, AugmintJsError);
                assert.instanceOf(tx.sendError, TransactionError);
                assert.match(error.message, /base fee exceeds gas limit/); // test sanity check
            });

        assert.isUndefined(txHash);

        assert.equal(txHashSpy.callCount, 0);
        assert.equal(receiptSpy.callCount, 0);
        assert.equal(errorSpy.callCount, 1);
        assert.equal(confirmationSpy.callCount, 0);
    });

    it("sign and send tx", async () => {
        // private key of accounts[0] 0x76e7a 0aec3e43211395bbbb6fa059bd6750f83c3with the hardcoded mnemonin for ganache
        const PRIVATE_KEY = "0x85b3d743fbe4ec4e2b58947fa5484da7b2f5538b0ae8e655646f94c95d5fb949";
        const CONFIRMATION_NUMBER = 5;
        const txHashSpy = sinon.spy();
        const receiptSpy = sinon.spy();
        const confirmationSpy = sinon.spy();
        const errorSpy = sinon.spy();

        const tx = new Transaction(ethereumConnection, testContractTx);

        tx.on("error", errorSpy);
        tx.on("receipt", receiptSpy);
        tx.on("confirmation", confirmationSpy);
        tx.on("transactionHash", txHashSpy);

        const signedTx = await tx
            .sign(PRIVATE_KEY, {
                from: accounts[0],
                to: rates.address,
                gasLimit: 100000
            })
            .getSignedTx();

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
        assert.equal(errorSpy.callCount, 0);
        assert.equal(confirmationSpy.callCount, 0);

        // should receive receipt after given number of confirmations
        const confirmedReceiptPromise = tx.getTxConfirmation(CONFIRMATION_NUMBER);
        await mine(ethereumConnection.web3, CONFIRMATION_NUMBER); // TODO: check if newer versions of web3js are genereating confirmations with ganache
        const confirmedReceipt = await confirmedReceiptPromise;
        assert(confirmedReceipt.status);
        assert.equal(confirmationSpy.callCount, CONFIRMATION_NUMBER);
        sinon.assert.calledWith(confirmationSpy, 1, receipt);

        // confirmations should be still received after confirmaton
        await mine(ethereumConnection.web3, 1);
        assert.equal(confirmationSpy.callCount, CONFIRMATION_NUMBER + 1);
    });
});
