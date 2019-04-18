const assert = require("chai").assert;
const ganache = require("./testHelpers/ganache.js");
const { Augmint, utils } = require("../dist/index.js");
const {Exchange,EthereumConnection } = Augmint;

const config = utils.loadEnv();

if (config.LOG) {
    utils.logger.level = config.LOG;
}

describe("MatchMultipleOrders onchain", () => {
    const ethereumConnection = new EthereumConnection(config);
    let exchange;
    let snapshotId;
    let accounts;
    let web3;

    before(async () => {
        await ethereumConnection.connect();
        web3 = ethereumConnection.web3;
        accounts = ethereumConnection.accounts;
        exchange = new Exchange(ethereumConnection, []);

        await exchange.connect(ethereumConnection);
    });

    beforeEach(async () => {
        snapshotId = await ganache.takeSnapshot(ethereumConnection.web3);
    });

    afterEach(async () => {
        await ganache.revertSnapshot(ethereumConnection.web3, snapshotId);
    });

    it("getMatchingOrders", async () => {
        await exchange.instance.methods.placeBuyTokenOrder("1000000").send({
            from: accounts[1],
            value: web3.utils.toWei("0.1"),
            gas: 1000000
        });
        await exchange.augmintToken.instance.methods.transferAndNotify(exchange.address, "1000", "1000000").send({
            from: accounts[0],
            gas: 1000000
        });

        const expGasEstimate = 200000;

        // No gasLimit (defaults to safeBlockGasLimit)
        let matchingOrders = await exchange.getMatchingOrders();

        assert.deepEqual(matchingOrders, { buyIds: [1], sellIds: [2], gasEstimate: expGasEstimate });

        // passed gaslimit not enough to match any
        matchingOrders = await exchange.getMatchingOrders(expGasEstimate - 1);
        assert.deepEqual(matchingOrders, { buyIds: [], sellIds: [], gasEstimate: 0 });
    });

    it("signAndSendMatchMultipleOrders", async () => {
        await Promise.all([
            exchange.instance.methods
                .placeBuyTokenOrder("1000000")
                .send({ from: accounts[1], value: web3.utils.toWei("0.1"), gas: 1000000 }),

            exchange.augmintToken.instance.methods
                .transferAndNotify(exchange.address, "1000", "1000000")
                .send({ from: accounts[0], gas: 1000000 })
        ]);

        let matchingOrders = await exchange.getMatchingOrders();

        // ganache account[0] private key, generated with  mnemonic fixed in ganache launch script
        const privateKey = "0x85b3d743fbe4ec4e2b58947fa5484da7b2f5538b0ae8e655646f94c95d5fb949";

        const receipt = await exchange.signAndSendMatchMultipleOrders(
            ethereumConnection.accounts[0],
            privateKey,
            matchingOrders
        );

        assert(receipt.status);
        matchingOrders = await exchange.getMatchingOrders();
        assert.deepEqual(matchingOrders, { buyIds: [], sellIds: [], gasEstimate: 0 });
    });

    it("matchMultipleOrders", async () => {
        await Promise.all([
            exchange.instance.methods
                .placeBuyTokenOrder("1000000")
                .send({ from: accounts[1], value: web3.utils.toWei("0.1"), gas: 1000000 }),

            exchange.augmintToken.instance.methods
                .transferAndNotify(exchange.address, "1000", "1000000")
                .send({ from: accounts[0], gas: 1000000 })
        ]);

        let matchingOrders = await exchange.getMatchingOrders();

        const receipt = await exchange.matchMultipleOrders(ethereumConnection.accounts[0], matchingOrders);

        assert(receipt.status);
        matchingOrders = await exchange.getMatchingOrders();
        assert.deepEqual(matchingOrders, { buyIds: [], sellIds: [], gasEstimate: 0 });
    });
});
