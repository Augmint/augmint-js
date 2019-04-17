"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function connectLatest(ethereumConnection, abiFile) {
    var contractName = abiFile.contractName;
    var abiVersionHash = abiFile.abiHash;
    var deploysFile = getDeploysFile(ethereumConnection.networkId, contractName);
    if (!deploysFile.deployedAbis[abiVersionHash] || !deploysFile.deployedAbis[abiVersionHash].latestDeployedAddress) {
        throw new Error("Couldn't find deployment info for " + contractName + " with abi version " + abiVersionHash + " in " + deploysFile._fileName);
    }
    var contractAddress = deploysFile.deployedAbis[abiVersionHash].latestDeployedAddress;
    return new ethereumConnection.web3.eth.Contract(abiFile.abi, contractAddress);
}
exports.connectLatest = connectLatest;
function getDeploysFile(networkId, contractName) {
    var deploysFileName = "../abiniser/deployments/" + networkId + "/" + contractName + "_DEPLOYS.json";
    var deploysFile;
    try {
        /* must provide fileName string again for webpack (needs to be statically analysable) */
        deploysFile = require("../abiniser/deployments/" + networkId + "/" + contractName + "_DEPLOYS.json");
    }
    catch (error) {
        throw new Error("Couldn't import deployment file " + deploysFileName + " for " + contractName + "\n" + error);
    }
    deploysFile._fileName = deploysFileName;
    return deploysFile;
}
//# sourceMappingURL=contractConnection.js.map