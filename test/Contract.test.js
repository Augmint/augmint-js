const { loadEnv } = require("../dist/utils");
const assert = require("chai").assert;
const nodeAssert = require("assert");
const Contract = require("../dist/Contract.js");
const EthereumConnection = require("../dist/EthereumConnection.js");

const config = loadEnv();
const ethereumConnection = new EthereumConnection(config);

describe("constructor", () => {
    it("should be created", () => {
        const contract = new Contract();
        assert.isNull(contract.instance);
        assert.isNull(contract.web3);
        assert.isNull(contract.ethereumConnection);
        assert.isNull(contract.address);
    });

    it("should throw trying to connect without ethereumConnection", async () => {
        const contract = new Contract();

        nodeAssert.rejects(contract.connect(ethereumConnection, {}), /not connected to web3/);
    });
});
