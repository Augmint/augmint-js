import loggerFactory from "./log"
import promiseTimeout from "./promiseTimeout"
const DEFAULT_EXIT_TIMEOUT = 10000; // how much to wait before timing out disconnect (in ms)
const SIGNALS = ["SIGINT", "SIGQUIT", "SIGTERM"] as const;
const log = loggerFactory("sigintHandler");

export default function setExitHandler(exitHandler, name, exitTimeout = DEFAULT_EXIT_TIMEOUT) {
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
