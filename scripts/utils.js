const { upperFirst, camelCase } = require("lodash");

/**
 * Copiped from https://github.com/ethereum-ts/TypeChain/blob/aef73673eeceff891f9935a5b932277b1cf69192/packages/typechain/src/parser/normalizeName.ts
 * Converts valid file names to valid javascript symbols and does best effort to make them readable. Example: ds-token.test becomes DsTokenTest
 */

module.exports = {
    normalizeName: function(rawName) {
        const t1 = rawName.split(" ").join("-"); // spaces to - so later we can automatically convert them
        const t2 = t1.replace(/^\d+/, ""); // removes leading digits
        const result = upperFirst(camelCase(t2));

        if (result === "") {
            throw new Error(`Can't guess class name, please rename file: ${rawName}`);
        }

        return result;
    }
};
