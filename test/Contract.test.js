const assert = require("chai").assert;
const nodeAssert = require("assert");
const { Augmint, utils } = require("../dist/index.js");
const { Contract, EthereumConnection } = Augmint;

const config = utils.loadEnv();

if (config.LOG) {
    utils.logger.level = config.LOG;
}

const ethereumConnection = new EthereumConnection(config);

describe("constructor", () => {
    it("should be created", () => {
        const contract = new Contract();
        assert.isUndefined(contract.instance);
        assert.isUndefined(contract.web3);
        assert.isUndefined(contract.ethereumConnection);
        assert.isNull(contract.address);
    });

    it("should throw trying to connect without ethereumConnection", async () => {
        const contract = new Contract();

        nodeAssert.rejects(contract.connect(ethereumConnection, {}), /not connected to web3/);
    });
});
