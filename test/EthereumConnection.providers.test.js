const { assert } = require("chai");
const sinon = require("sinon");
const { Augmint, utils } = require("../dist/index.js");
const { EthereumConnection } = Augmint;
const Web3 = require("web3");

const loadEnv = require("./testHelpers/loadEnv.js");
const config = loadEnv();

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
        name: "local web3 websocket givenprovider",
        nonceTestAcc: "0x76e7a0aec3e43211395bbbb6fa059bd6750f83c3", // an account with txs to test getAccountNonce
        testWithGivenProvider: true, // it will create a new web3 instance with a new WebsocketProvider for each test (see beforeEach)
        options: { ETHEREUM_CONNECTION_CHECK_INTERVAL: 0 }
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

testProviders.forEach(testProvider => {
    describe("EthereumConnection -" + testProvider.name, function() {
        this.timeout(TEST_TIMEOUT);
        let web3;

        beforeEach(() => {
            if (testProvider.testWithGivenProvider) {
                web3 = new Web3(new Web3.providers.WebsocketProvider("ws://localhost:8545"));
                testProvider.options.givenProvider = web3.currentProvider;
            }
        });

        it("should connect & disconnect", async () => {
            ethereumConnection = new EthereumConnection(testProvider.options, testProvider.givenProvider);
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

            assert.equal(connectedSpy.callCount, 1);
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

        it("should return account nonce", async () => {
            const ethereumConnection = new EthereumConnection(testProvider.options, testProvider.givenProvider);
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
            if (testProvider.testWithGivenProvider) {
                console.info(
                    "     Skipping reconnect test with given provider  (we expect givenProvider to take care of reconnect)"
                );
                done();
            } else {
                const connectionLostSpy = sinon.spy();
                const disconnectedSpy = sinon.spy();
                const checkInterval = 500;

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
                    assert(
                        await ethereumConnection.isConnected().catch(error => {
                            console.error("isConnected failed with error: ", error);
                            assert.fail(error);
                        })
                    );
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
                        assert.fail(error);
                    });
            }
        });
    });
});
