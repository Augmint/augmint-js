const { TsGeneratorPlugin } = require("ts-generator");
const { normalizeName } = require("./utils.js");
const { join, dirname, sep } = require("path");
let environments = null;

function generateContracts(contracts) {
    return contracts
        .map(contract => {
            const stringContract = JSON.stringify(contract, null, 0);
            return `new DeployedContract<${normalizeName(contract.abiFileName)}>(${stringContract})`;
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
        const latestAbiHash = deploymentFile.latestAbiHash;
        const d = [];
        Object.keys(deploymentFile.deployedAbis).forEach(abiHash => {
            const abiDeployment = deploymentFile.deployedAbis[abiHash];
            const latestDeploymentAddress = abiDeployment.latestDeployedAddress;
            Object.keys(abiDeployment.deployments).forEach(deployedAddress => {
                const deployment = abiDeployment.deployments[deployedAddress];
                const latestInAbi = deployedAddress === latestDeploymentAddress;
                d.push({
                    abiFileName: `${contractName}_ABI_${abiHash}`,
                    current: latestInAbi && abiHash === latestAbiHash,
                    deployedAddress: deployedAddress.toLocaleLowerCase(),
                    generated: new Date(deployment.generatedAt).getTime()
                });
            });
        });
        if (!environments.has(nameSpace)) {
            environments.set(nameSpace, {});
        }

        d.sort((a, b) => (a.current ? -1 : b.current ? 1 : b.generated - a.generated));

        const content = environments.get(nameSpace);

        content[contractName] = d.map(({ abiFileName, deployedAddress }) => ({
            abiFileName,
            // className: normalizeName(abiFileName), // this how latest typechain normalizes classnames
            deployedAddress
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
                            .map(deployment => {
                                return `import {${normalizeName(deployment.abiFileName)}} from './types/${
                                    deployment.abiFileName
                                }'`;
                            })
                    ),
                []
            )
        );
        const header = `
        import { DeployedContract} from "../src/DeployedContract";
        import { DeployedEnvironment} from "../src/DeployedEnvironment";
        ${Array.from(contractTypesSet.values())
            .sort()
            .join("\n")}
            
        const deployedEnvironments:DeployedEnvironment[] = [];
        let currentEnvironment: DeployedEnvironment;
        `;
        const exports = [];
        environments.forEach((content, key) => {
            exports.push(`
            currentEnvironment = new DeployedEnvironment(${JSON.stringify(key)});
            deployedEnvironments.push(currentEnvironment);`);
            exports.push(
                Object.keys(content)
                    .map(
                        contractName =>
                            `currentEnvironment.addRole(${JSON.stringify(contractName)},[${generateContracts(
                                content[contractName]
                            )}]);`
                    )
                    .join("\n")
            );
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
