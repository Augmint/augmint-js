const assert = require("chai").assert;
const EthereumConnection = require("./EthereumConnection.js");
const sinon = require("sinon");

let ethereumConnection;
const providers = [
    { name: "local websocket", PROVIDER_URL: "ws://localhost:8545", PROVIDER_TYPE: "websocket" },
    {
        name: "infura websocket",
        PROVIDER_URL: "wss://rinkeby.infura.io/ws/v3/",
        PROVIDER_TYPE: "websocket",
        INFURA_PROJECT_ID: "cb1b0d436be24b0fa654ca34ae6a3645"
    }
];

describe("EthereumConnection", () => {
    it("should have an initial state", async () => {
        const ethereumConnection = new EthereumConnection();

        assert.isNull(ethereumConnection.web3);
        assert.isNull(ethereumConnection.provider);

        assert(!(await ethereumConnection.isConnected()));
        assert(!ethereumConnection.isStopping);
        assert(!ethereumConnection.isTryingToReconnect);

        assert.isNull(ethereumConnection.networkId);
        assert.isNull(ethereumConnection.blockGasLimit);
        assert.isNull(ethereumConnection.safeBlockGasLimit);
        assert.isNull(ethereumConnection.accounts);
    });

    providers.forEach(providerOptions => {
        describe("EthereumConnection -" + providerOptions.name, () => {
            it("should connect & disconnect", async () => {
                ethereumConnection = new EthereumConnection(providerOptions);
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
                const options = {
                    ETHEREUM_CONNECTION_CHECK_INTERVAL: 9999,
                    ETHEREUM_CONNECTION_TIMEOUT: 99,
                    ETHEREUM_ISLISTENING_TIMEOUT: 99,
                    ETHEREUM_CONNECTION_CLOSE_TIMEOUT: 99,
                    PROVIDER_TYPE: "test",
                    PROVIDER_URL: "hoops",
                    INFURA_PROJECT_ID: "bingo"
                };

                Object.assign(options, providerOptions);

                ethereumConnection = new EthereumConnection(options);

                assert(
                    ethereumConnection.ETHEREUM_CONNECTION_CHECK_INTERVAL,
                    options.ETHEREUM_CONNECTION_CHECK_INTERVAL
                );
                assert.equal(ethereumConnection.PROVIDER_TYPE, options.PROVIDER_TYPE);
                assert.equal(ethereumConnection.PROVIDER_URL, options.PROVIDER_URL);
                assert.equal(ethereumConnection.INFURA_PROJECT_ID, options.INFURA_PROJECT_ID);
                assert.equal(ethereumConnection.ETHEREUM_CONNECTION_TIMEOUT, options.ETHEREUM_CONNECTION_TIMEOUT);
                assert.equal(
                    ethereumConnection.ETHEREUM_CONNECTION_CLOSE_TIMEOUT,
                    options.ETHEREUM_CONNECTION_CLOSE_TIMEOUT
                );
            });

            it("should return account nonce", async () => {
                const ethereumConnection = new EthereumConnection();
                await ethereumConnection.connect();
                const expectedNonce = await ethereumConnection.web3.eth.getTransactionCount(
                    ethereumConnection.accounts[0]
                );

                let nonce = await ethereumConnection.getAccountNonce(ethereumConnection.accounts[0]);

                assert.equal(nonce, expectedNonce);

                // with a zero nonce acc, assuming randomAcc has no tx-s from migration subscriptions
                const randomAccount = "0x107af532e6f828da6fe79699123c9a5ea0123d16";
                nonce = await ethereumConnection.getAccountNonce(randomAccount);
                assert.equal(nonce, 0);
            });

            it("should reconnect after connection lost", done => {
                const connectionLostSpy = sinon.spy();
                const disconnectedSpy = sinon.spy();
                const checkInterval = 100;
                const options = {
                    ETHEREUM_CONNECTION_CHECK_INTERVAL: checkInterval,
                    ETHEREUM_CONNECTION_TIMEOUT: 10000
                };
                Object.assign(options, providerOptions);

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
