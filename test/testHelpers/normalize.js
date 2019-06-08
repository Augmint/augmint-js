const BN = require("bn.js");

BN.prototype.inspect = function() {
    return this.toString();
};

module.exports = { normalizeBN };

// deeply normalize all BN properties so they can be compared with deepEquals
// NOTE: object graph must not have cycles
function normalizeBN(obj) {
    Object.keys(obj).map((key, index) => {
        const o = obj[key];
        if (o instanceof BN) {
            obj[key] = new BN(o.toString());
        } else if (o instanceof Object) {
            obj[key] = normalizeBN(o);
        }
    });
    return obj;
}
