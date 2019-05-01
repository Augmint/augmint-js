const { TsGeneratorPlugin } = require("ts-generator");
const { join } = require("path");
let content = {};

function generateExports() {
    return Object.keys(content).map(abiName => `export const ${abiName} = ${JSON.stringify(content[abiName])}`).join('\n')
}

class AbiListPlugin extends TsGeneratorPlugin {
    transformFile({ contents }) {
        const abiFile = JSON.parse(contents);
        const abiName = `${abiFile.contractName}_ABI_${abiFile.abiHash}`;
        content[abiName] = abiFile.abi;
    }

    beforeRun() {
        content = {}
    }

    afterRun() {
        const { outDir, outFile } = this.ctx.rawConfig;
        return {
            contents: generateExports(),
            path: join(this.ctx.cwd, outDir, outFile),
        };
    }
}

module.exports = {
    AbiListPlugin
};
