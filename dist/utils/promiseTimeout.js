"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function promiseTimeout(ms, promise) {
    var id;
    var timeout = new Promise(function (resolve, reject) {
        id = setTimeout(function () {
            reject("Timed out in " + ms + "ms.");
        }, ms);
    });
    return Promise.race([promise, timeout])
        .then(function (result) {
        clearTimeout(id);
        return result;
    })
        .catch(function (error) {
        clearTimeout(id);
        throw error;
    });
}
exports.default = promiseTimeout;
//# sourceMappingURL=promiseTimeout.js.map