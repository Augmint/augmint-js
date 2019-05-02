const chai = require("chai");
const { assert } = chai;
const sinon = require("sinon");
chai.use(require("chai-as-promised"));
const { Augmint } = require("../dist/index.js");
const { Transaction } = Augmint;
const { TransactionError, TransactionSendError, AugmintJsError } = Augmint.Errors;
const { takeSnapshot, revertSnapshot, mine } = require("./testHelpers/ganache.js");
const loadEnv = require("./testHelpers/loadEnv.js");
const config = loadEnv();

describe("Transaction - web3js events style", () => {
    let ethereumConnection;
    let rates;

    let testContractTx;
    let accounts;
    let snapshotId;

    before(async () => {
        const myAugmint = await Augmint.create(config);
        ethereumConnection = myAugmint.ethereumConnection;
        rates = myAugmint.rates;
        const BYTES_CCY = ethereumConnection.web3.utils.asciiToHex("TESTCCY");
        testContractTx = rates.instance.methods.setRate(BYTES_CCY, 100);
        accounts = ethereumConnection.accounts;
        snapshotId = await takeSnapshot(ethereumConnection.web3);
    });

    after(async () => {
        await revertSnapshot(ethereumConnection.web3, snapshotId);
    });

    it("send Transaction success", async () => {
        const CONFIRMATION_NUMBER = 5;

        const txHashSpy = sinon.spy();
        const receiptSpy = sinon.spy();
        const confirmationSpy = sinon.spy();
        const errorSpy = sinon.spy();

        const tx = new Transaction(ethereumConnection, testContractTx);

        tx.send({ from: accounts[0] })
            .on("error", errorSpy)
            .on("receipt", receiptSpy)
            .on("confirmation", confirmationSpy)
            .on("transactionHash", txHashSpy);

        const txHash = await tx.getTxHash();
        const receipt = await tx.getTxReceipt();

        assert(txHash);
        assert(receipt.status);

        sinon.assert.calledWithExactly(txHashSpy, txHash);
        sinon.assert.calledWithExactly(receiptSpy, receipt);

        assert.equal(errorSpy.callCount, 0);

        // should receive confirmations

        await mine(ethereumConnection.web3, CONFIRMATION_NUMBER);
        const confirmedReceipt = await tx.getConfirmedReceipt(CONFIRMATION_NUMBER);
        assert.deepEqual(receipt, confirmedReceipt);
        assert.isAtLeast(confirmationSpy.callCount, CONFIRMATION_NUMBER);
        sinon.assert.calledWith(confirmationSpy, 1, receipt);
    });

    it("send Transaction to fail - tx REVERT", async () => {
        const CONFIRMATION_NUMBER = 3;
        const txHashSpy = sinon.spy();
        const receiptSpy = sinon.spy();
        const confirmationSpy = sinon.spy();
        const errorSpy = sinon.spy();

        const tx = new Transaction(ethereumConnection, testContractTx);

        let errorCaught;
        tx.send({ from: accounts[1] })
            .on("error", (error, receipt, ...rest) => {
                assert.instanceOf(error, TransactionSendError);
                assert.instanceOf(error, AugmintJsError);
                assert.instanceOf(error, TransactionError);
                assert.match(error.message, /Transaction has been reverted by the EVM/);
                errorSpy(error, receipt, ...rest);
                errorCaught = error;
            })
            .on("receipt", receiptSpy)
            .on("confirmation", confirmationSpy)
            .on("transactionHash", txHashSpy);

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
        assert.equal(errorSpy.callCount, 1);
        sinon.assert.calledWithExactly(errorSpy, errorCaught, receipt);

        await mine(ethereumConnection.web3, CONFIRMATION_NUMBER);
        await tx.getConfirmedReceipt(CONFIRMATION_NUMBER);
        assert.isAtLeast(confirmationSpy.callCount, CONFIRMATION_NUMBER);

        // this triggered this way ganache --blockTime 1 flag. without it's different (web3 beta36)
        sinon.assert.calledWithExactly(confirmationSpy.firstCall, 0, undefined);
        sinon.assert.calledWithExactly(confirmationSpy.secondCall, 1, receipt);
        sinon.assert.calledWithExactly(confirmationSpy.lastCall, CONFIRMATION_NUMBER, receipt);

        // confirmations should be received
        await mine(ethereumConnection.web3, 1);
        await tx.getConfirmedReceipt(CONFIRMATION_NUMBER + 1);
        assert.isAtLeast(confirmationSpy.callCount, CONFIRMATION_NUMBER + 1);
        sinon.assert.calledWithExactly(confirmationSpy.lastCall, CONFIRMATION_NUMBER + 1, receipt);
    });

    /** This doesn't work with ganache --blockTime 1 : can't get error in any ways with web3 beta36 */
    it.skip("send Transaction to fail - not enough gas", async () => {
        const txHashSpy = sinon.spy();
        const receiptSpy = sinon.spy();
        const confirmationSpy = sinon.spy();
        const errorSpy = sinon.spy();

        const tx = new Transaction(ethereumConnection, testContractTx);

        tx.send({ from: accounts[0], gas: 10000 })
            .on("error", errorSpy)
            .on("receipt", receiptSpy)
            .on("confirmation", confirmationSpy)
            .on("transactionHash", txHashSpy);

        let errorCaught;
        const txHash = await tx.getTxHash().catch(error => {
            assert.instanceOf(error, TransactionSendError);
            assert.instanceOf(error, AugmintJsError);
            assert.instanceOf(error, TransactionError);
            assert.match(error.message, /base fee exceeds gas limit/); // test sanity check
            assert.deepEqual(tx.sendError, error);
            errorCaught = error;
        });

        // when ganache started with --blockTime 1 then we receive a hash
        // assert.isUndefined(txHash);

        const receipt = await tx.getTxReceipt().catch(error => {
            assert.deepEqual(error, errorCaught);
        });
        assert.isUndefined(receipt);

        const confirmedReceipt = await tx.getConfirmedReceipt(3).catch(error => {
            assert.deepEqual(error, errorCaught);
        });
        assert.isUndefined(confirmedReceipt);

        sinon.assert.calledWithExactly(errorSpy, errorCaught, receipt);
        assert.equal(txHashSpy.callCount, 0);
        assert.equal(receiptSpy.callCount, 0);
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

        tx.sign(PRIVATE_KEY, {
            from: accounts[0],
            to: rates.address,
            gasLimit: 100000
        })
            .on("error", errorSpy)
            .on("receipt", receiptSpy)
            .on("confirmation", confirmationSpy)
            .on("transactionHash", txHashSpy);

        const signedTx = await tx.getSignedTx();

        assert(tx.signedTx);
        assert.deepEqual(tx.signedTx, signedTx);

        const txHash = await tx.send().getTxHash();
        const receipt = await tx.getTxReceipt();

        assert(txHash);
        assert(receipt.status);

        sinon.assert.calledWithExactly(txHashSpy, txHash);
        sinon.assert.calledWithExactly(receiptSpy, receipt);
        assert.equal(errorSpy.callCount, 0);

        // should receive confirmations
        await mine(ethereumConnection.web3, CONFIRMATION_NUMBER);
        await tx.getConfirmedReceipt(CONFIRMATION_NUMBER);
        assert.isAtLeast(confirmationSpy.callCount, CONFIRMATION_NUMBER);
        sinon.assert.calledWithExactly(confirmationSpy.lastCall, CONFIRMATION_NUMBER, receipt);
    });
});
