const { TsGeneratorPlugin } = require("ts-generator");
const { normalizeName } = require("./utils.js");
const { join } = require("path");
let content = {};

class TypeListPlugin extends TsGeneratorPlugin {
    transformFile({ contents }) {
        const abiFile = JSON.parse(contents);
        const contractName = abiFile.contractName;
        const abiName = `${contractName}_ABI_${abiFile.abiHash}`;
        const className = normalizeName(abiName); // this how latest typechain normalizes classnames
        const abis = content[contractName] || [];
        abis.push({ abiName, className, contractName });
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
                    content[current].map(abiInfo => `import { ${abiInfo.className} } from "./types/${abiInfo.abiName}"`)
                );
            }, [])
            .join("\n");

        const enums = Object.keys(content)
            .map(contractName => `${contractName} = "${contractName}"`)
            .join(",");

        const types = Object.keys(content)
            .map(contract => {
                return `export type ${contract} = ${content[contract].map(({ className }) => className).join(" | ")};`;
            })
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
