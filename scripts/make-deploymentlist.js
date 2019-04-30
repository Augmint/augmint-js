const { TsGeneratorPlugin } = require("ts-generator");
const { join, dirname, basename, sep } = require("path");
let environments = null;

function generateContracts(contracts) {
    return contracts
        .map(contract => {
            const stringContract = JSON.stringify(contract, null, 0);
            return `new DeployedContract<${contract.abiFileName}>(${stringContract})`;
        })
        .join(",\n");
}

class DeploymentListPlugin extends TsGeneratorPlugin {
    transformFile({ path, contents }) {
        const nameSpace = dirname(path)
            .split(sep)
            .pop();
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
        if (!environments.has(nameSpace)) {
            environments.set(nameSpace, {});
        }
        const content = environments.get(nameSpace);
        content[contractName] = d.map((item, index) => ({
            ...item,
            current: index === 0
        }));
    }

    beforeRun() {
        environments = new Map();
    }

    afterRun() {
        const { outDir, outFile } = this.ctx.rawConfig;
        const contractTypesSet = new Set(
            Array.from(environments.values()).reduce(
                (allTypes, content) =>
                    allTypes.concat(
                        Object.keys(content)
                            .reduce((prev, current) => {
                                return prev.concat(content[current]);
                            }, [])
                            .map(
                                deployment =>
                                    `import {${deployment.abiFileName}} from './types/${deployment.abiFileName}'`
                            )
                    ),
                []
            )
        );
        const header = `
        import { DeployedContract} from "../src/DeployedContract";
        import { DeployedContractList} from "../src/DeployedContractList";
        ${Array.from(contractTypesSet.values())
            .sort()
            .join("\n")}
        const deployedEnvironments = {};
        `;
        const exports = [];
        environments.forEach((content, key) => {
            const deployedEnvironment = `deployedEnvironments[${JSON.stringify(key)}]`;
            exports.push('');
            exports.push(`${deployedEnvironment}={};`);
            exports.push(Object.keys(content).map(
                contractName =>
                    `${deployedEnvironment}[${JSON.stringify(contractName)}] = new DeployedContractList([${generateContracts(
                        content[contractName]
                    )}]);`
            ).join('\n'));
        });
        return {
            contents: `
            ${header}
            ${exports.join("")}
            export default deployedEnvironments;`,
            path: join(this.ctx.cwd, outDir, outFile)
        };
    }
}

module.exports = {
    DeploymentListPlugin
};
