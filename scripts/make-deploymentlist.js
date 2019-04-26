const { TsGeneratorPlugin } = require("ts-generator");
const { join } = require("path");
let content = {};

function generateContracts(contracts) {
    return contracts
        .map(contract => {
            const stringContract = JSON.stringify(contract, null, 0);
            return `new DeployedContract<${contract.abiFileName}>(${stringContract})`;
        })
        .join(",\n");
}

class DeploymentListPlugin extends TsGeneratorPlugin {
    transformFile({ contents }) {
        const deploymentFile = JSON.parse(contents);
        const contractName = deploymentFile.contractName;
        const d = [];
        Object.keys(deploymentFile.deployedAbis).forEach(abiHash => {
            const abiDeployment = deploymentFile.deployedAbis[abiHash];
            const latestDeploymentAddress = abiDeployment.latestDeployedAddress;
            Object.keys(abiDeployment.deployments).forEach(deployedAddress => {
                const deployment = abiDeployment.deployments[deployedAddress];
                d.push({
                    abiFileName: `${contractName}_ABI_${abiHash}`,
                    abiHash,
                    contractName,
                    deployedAddress,
                    generatedAt: new Date(deployment.generatedAt).getTime(),
                    latestInAbi: deployedAddress === latestDeploymentAddress
                });
            });
        });
        d.sort((a, b) => b.generatedAt - a.generatedAt);
        content[contractName] = d.map((item, index) => ({
            ...item,
            current: index === 0
        }));
    }

    beforeRun() {
        content = {};
    }

    afterRun() {
        const { outDir, outFile } = this.ctx.rawConfig;
        const contractTypesSet = new Set(Object.keys(content).reduce((prev, current) => {
            return prev.concat(content[current])
        },[]).map(deployment => `import {${deployment.abiFileName}} from './types/${deployment.abiFileName}'`));
        const header = `
        import { DeployedContract} from "./DeployedContract";
        import { DeployedContractList} from "./DeployedContractList";
        ${Array.from(contractTypesSet.values()).sort().join('\n')}
        `;
        const exports = Object.keys(content).map(
            contractName =>
                `export const ${contractName}:DeployedContractList = new DeployedContractList([${generateContracts(content[contractName])}])`
        );
        return {
            contents: `
            ${header}
            ${exports.join("\n")}`,
            path: join(this.ctx.cwd, outDir, outFile)
        };
    }
}

module.exports = {
    DeploymentListPlugin
};
