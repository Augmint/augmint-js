const typescript = require("rollup-plugin-typescript2");
const pkg = require("./package.json");
const builtins = require('rollup-plugin-node-builtins');
module.exports = {
    input: "src/index.ts",
    output: [
        {
            file: pkg.main,
            format: "cjs"
        },
        {
            file: pkg.module,
            format: "es"
        }
    ],
    external: [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.peerDependencies || {})],
    plugins: [
        builtins(),
        typescript({
            typescript: require("typescript")
        })
    ]
};
