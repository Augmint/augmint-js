module.exports = setExitHandler;

const log = require("./log.js")("sigintHandler");
const promiseTimeout = require("./promiseTimeout.js");
const DEFAULT_EXIT_TIMEOUT = 10000; // how much to wait before timing out disconnect (in ms)
const SIGNALS = ["SIGINT", "SIGQUIT", "SIGTERM"];

function setExitHandler(exitHandler, name, exitTimeout = DEFAULT_EXIT_TIMEOUT) {
    SIGNALS.forEach(signal => {
        process.on(signal, async signal => {
            await promiseTimeout(exitTimeout, exitHandler(signal))
                .then(() => {
                    log.debug(`${name} exit (${signal}) success`);
                })
                .catch(error => {
                    // most likely timeout
                    log.warn(`${name} exit (${signal}) failed with Error:`, error);
                    process.exitCode = 999;
                });
        });
    });
}
