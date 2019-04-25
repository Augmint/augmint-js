const assert = require("chai").assert;
const sinon = require("sinon");
const { Augmint, utils } = require("../dist/index.js");
const { EthereumConnection } = Augmint;

const config = utils.loadEnv();

if (config.LOG) {
    utils.logger.level = config.LOG;
}

const TEST_TIMEOUT = 10000; // infura is occasionaly slow to connect

let ethereumConnection;
const testProviders = [
    {
        name: "local websocket",
        nonceTestAcc: "0x76e7a0aec3e43211395bbbb6fa059bd6750f83c3", // an account with txs to test getAccountNonce
        options: { PROVIDER_URL: "ws://localhost:8545", PROVIDER_TYPE: "websocket" }
    },
    {
        name: "infura websocket",
        nonceTestAcc: "0x4A7F6EcbE8B324A55b85adcc45313A412957B8ea", // an account with txs to test getAccountNonce
        options: {
        PROVIDER_URL: "wss://rinkeby.infura.io/ws/v3/",
        PROVIDER_TYPE: "websocket",
        INFURA_PROJECT_ID: "cb1b0d436be24b0fa654ca34ae6a3645"
    }
    }
];

describe("EthereumConnection", () => {
    it("should have an initial state", async () => {
        const ethereumConnection = new EthereumConnection();

        assert.isUndefined(ethereumConnection.web3);
        assert.isUndefined(ethereumConnection.provider);

        assert(!(await ethereumConnection.isConnected()));
        assert(!ethereumConnection.isStopping);
        assert(!ethereumConnection.isTryingToReconnect);

        assert.isUndefined(ethereumConnection.networkId);
        assert.isUndefined(ethereumConnection.blockGasLimit);
        assert.isUndefined(ethereumConnection.safeBlockGasLimit);
        assert.isUndefined(ethereumConnection.accounts);
    });

    testProviders.forEach(testProvider => {
        describe("EthereumConnection -" + testProvider.name, function() {
            this.timeout(TEST_TIMEOUT);

            it("should connect & disconnect", async () => {
                ethereumConnection = new EthereumConnection(testProvider.options);
                const connectedSpy = sinon.spy();
                const disconnectedSpy = sinon.spy();
                const connectionLostSpy = sinon.spy();

                ethereumConnection.on("connected", connectedSpy);
                ethereumConnection.on("disconnected", disconnectedSpy);
                ethereumConnection.on("connectionLost", connectionLostSpy);

                assert(!(await ethereumConnection.isConnected()));

                await ethereumConnection.connect();

                const expNetworkId = parseInt(await ethereumConnection.web3.eth.net.getId(), 10);

                assert(await ethereumConnection.isConnected());
                assert.equal(ethereumConnection.networkId, expNetworkId);
                assert(ethereumConnection.blockGasLimit > 0);
                assert(ethereumConnection.safeBlockGasLimit, Math.round(ethereumConnection.blockGasLimit * 0.9));

                assert.isArray(ethereumConnection.accounts);
                ethereumConnection.accounts.forEach(acc => assert(ethereumConnection.web3.utils.isAddress(acc)));

                assert(!ethereumConnection.isStopping);
                assert(!ethereumConnection.isTryingToReconnect);

                sinon.assert.calledOnce(connectedSpy);
                sinon.assert.notCalled(disconnectedSpy);
                sinon.assert.notCalled(connectionLostSpy);

                await ethereumConnection.stop();

                assert(!(await ethereumConnection.isConnected()));
                assert(ethereumConnection.isStopping);
                assert(!ethereumConnection.isTryingToReconnect);

                sinon.assert.calledOnce(connectedSpy); // 1 event left from initial connect on spy
                sinon.assert.notCalled(connectionLostSpy);
                sinon.assert.calledOnce(disconnectedSpy);
            });

            it("should get options as constructor parameters too", async () => {
                const options = Object.assign({}, testProvider.options, {
                    ETHEREUM_CONNECTION_CHECK_INTERVAL: 9999,
                    ETHEREUM_CONNECTION_TIMEOUT: 99,
                    ETHEREUM_ISLISTENING_TIMEOUT: 99,
                    ETHEREUM_CONNECTION_CLOSE_TIMEOUT: 99,
                    PROVIDER_TYPE: "websocket",
                    PROVIDER_URL: "hoops",
                    INFURA_PROJECT_ID: "bingo"
                });

                ethereumConnection = new EthereumConnection(options);

                assert(
                    ethereumConnection.options.ETHEREUM_CONNECTION_CHECK_INTERVAL,
                    options.ETHEREUM_CONNECTION_CHECK_INTERVAL
                );
                assert.equal(ethereumConnection.options.PROVIDER_TYPE, options.PROVIDER_TYPE);
                assert.equal(ethereumConnection.options.PROVIDER_URL, options.PROVIDER_URL);
                assert.equal(ethereumConnection.options.INFURA_PROJECT_ID, options.INFURA_PROJECT_ID);
                assert.equal(
                    ethereumConnection.options.ETHEREUM_CONNECTION_TIMEOUT,
                    options.ETHEREUM_CONNECTION_TIMEOUT
                );
                assert.equal(
                    ethereumConnection.options.ETHEREUM_CONNECTION_CLOSE_TIMEOUT,
                    options.ETHEREUM_CONNECTION_CLOSE_TIMEOUT
                );
            });

            it("should return account nonce", async () => {
                const ethereumConnection = new EthereumConnection(testProvider.options);
                await ethereumConnection.connect();

                const expectedNonce = await ethereumConnection.web3.eth.getTransactionCount(testProvider.nonceTestAcc);

                let nonce = await ethereumConnection.getAccountNonce(testProvider.nonceTestAcc);
                assert(nonce > 0); // test data sanity check

                assert.equal(nonce, expectedNonce);

                // with a zero nonce acc, assuming randomAcc has no tx-s with neither provider we test against
                const randomAccount = "0x51f9f5173450aef0b37b1a139fcd4edea67cc972";
                nonce = await ethereumConnection.getAccountNonce(randomAccount);
                assert.equal(nonce, 0);
            });

            it("should reconnect after connection lost", done => {
                const connectionLostSpy = sinon.spy();
                const disconnectedSpy = sinon.spy();
                const checkInterval = 100;

                const options = Object.assign({}, testProvider.options, {
                    ETHEREUM_CONNECTION_CHECK_INTERVAL: checkInterval,
                    ETHEREUM_CONNECTION_TIMEOUT: 10000
                });

                ethereumConnection = new EthereumConnection(options);

                const onConnectionLoss = async (event, eConnObj) => {
                    connectionLostSpy(event, eConnObj);
                    assert.equal(event.reason, "checkConnection detected connectionloss");
                };

                const onConnected = async () => {
                    // this is only set up for the reconnection we expect
                    assert(await ethereumConnection.isConnected());

                    assert(connectionLostSpy.calledOnce);
                    assert(disconnectedSpy.calledOnce);
                    done();
                };

                ethereumConnection
                    .connect()
                    .then(async () => {
                        assert(await ethereumConnection.isConnected());

                        ethereumConnection.on("disconnected", disconnectedSpy);
                        ethereumConnection.on("connectionLost", onConnectionLoss);
                        ethereumConnection.once("connected", onConnected); // we only setup connected here

                        await ethereumConnection.web3.currentProvider.connection.close(); // simulate connection drop
                        assert(!(await ethereumConnection.isConnected()));
                    })
                    .catch(error => {
                        throw error;
                    });
            });
        });
    });
});
