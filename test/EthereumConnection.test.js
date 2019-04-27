const { assert, expect } = require("chai");
const { Augmint, utils } = require("../dist/index.js");
const { AugmintJsError } = require("../dist/Errors.js");
const { EthereumConnection } = Augmint;

const config = utils.loadEnv();

if (config.LOG) {
    utils.logger.level = config.LOG;
}

describe("EthereumConnection", () => {
    const MOCK_PROVIDER = { provider: { mock: true } };

    it("should check constructor params", () => {
        const invalidProviderType = () =>
            new EthereumConnection({ PROVIDER_TYPE: "blahblah", PROVIDER_URL: "something" });
        expect(invalidProviderType).throws(AugmintJsError, /Invalid PROVIDER_TYPE/);

        const noProviderURL = () => new EthereumConnection({ PROVIDER_TYPE: "websocket", PROVIDER_URL: "" });
        expect(noProviderURL).throws(AugmintJsError, /No PROVIDER_URL specified/);

        const bothProviderTypeAndProvider = () =>
            new EthereumConnection({ PROVIDER_TYPE: "websocket", PROVIDER_URL: "" }, MOCK_PROVIDER);
        expect(bothProviderTypeAndProvider).throws(AugmintJsError, /Both givenProvider and PROVIDER_TYPE/);
    });

    it("should have an initial state - given provider", async () => {
        const ethereumConnection = new EthereumConnection(null, MOCK_PROVIDER);

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

    it("should have an initial state - websocket provider", async () => {
        const ethereumConnection = new EthereumConnection({ PROVIDER_URL: "mock", PROVIDER_TYPE: "websocket" });

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

    it("should get options as constructor parameters too", async () => {
        const options = Object.assign({
            ETHEREUM_CONNECTION_CHECK_INTERVAL: 9999,
            ETHEREUM_CONNECTION_TIMEOUT: 99,
            ETHEREUM_ISLISTENING_TIMEOUT: 99,
            ETHEREUM_CONNECTION_CLOSE_TIMEOUT: 99,
            PROVIDER_TYPE: "websocket",
            PROVIDER_URL: "hoops",
            INFURA_PROJECT_ID: "bingo"
        });

        const ethereumConnection = new EthereumConnection(options);

        assert(
            ethereumConnection.options.ETHEREUM_CONNECTION_CHECK_INTERVAL,
            options.ETHEREUM_CONNECTION_CHECK_INTERVAL
        );
        assert.equal(ethereumConnection.options.PROVIDER_TYPE, options.PROVIDER_TYPE);
        assert.equal(ethereumConnection.options.PROVIDER_URL, options.PROVIDER_URL);
        assert.equal(ethereumConnection.options.INFURA_PROJECT_ID, options.INFURA_PROJECT_ID);
        assert.equal(ethereumConnection.options.ETHEREUM_CONNECTION_TIMEOUT, options.ETHEREUM_CONNECTION_TIMEOUT);
        assert.equal(
            ethereumConnection.options.ETHEREUM_CONNECTION_CLOSE_TIMEOUT,
            options.ETHEREUM_CONNECTION_CLOSE_TIMEOUT
        );
    });
});
