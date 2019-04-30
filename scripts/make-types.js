const { TsGeneratorPlugin } = require("ts-generator");
const { join } = require("path");
let content = {};

class TypeListPlugin extends TsGeneratorPlugin {
    transformFile({ contents }) {
        const abiFile = JSON.parse(contents);
        const contractName = abiFile.contractName;
        const abiName = `${contractName}_ABI_${abiFile.abiHash}`;
        const abis = content[contractName] || [];
        abis.push(abiName);
        content[contractName] = abis;
    }

    beforeRun() {
        content = {};
    }

    afterRun() {
        const { outDir, outFile } = this.ctx.rawConfig;
        const imports = Object.keys(content)
            .reduce((prev, current) => {
                return prev.concat(
                    content[current].map(abiFileName => `import { ${abiFileName} } from "./types/${abiFileName}"`)
                );
            }, [])
            .join("\n");
        const enums = Object.keys(content).join(",");
        const types = Object.keys(content)
            .map(contractName => `export type ${contractName} = ${content[contractName].join(" | ")};`)
            .join("\n");
        return {
            contents: `
            ${imports}
                      
            export enum AugmintContracts {${enums}}
            
            ${types}
            `,
            path: join(this.ctx.cwd, outDir, outFile)
        };
    }
}

module.exports = {
    TypeListPlugin
};
