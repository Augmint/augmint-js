import { promiseTimeout } from "./promiseTimeout";

const DEFAULT_EXIT_TIMEOUT = 10000; // how much to wait before timing out disconnect (in ms)
const SIGNALS = ["SIGINT", "SIGQUIT", "SIGTERM"] as const;
import * as logger from "ulog";
const log = logger("sigintHandler");

export function setExitHandler(exitHandler, name, exitTimeout = DEFAULT_EXIT_TIMEOUT) {
    SIGNALS.forEach(signal => {
        process.on(signal, async _signal => {
            await promiseTimeout(exitTimeout, exitHandler(_signal))
                .then(() => {
                    log.debug(`${name} exit (${_signal}) success`);
                })
                .catch(error => {
                    // most likely timeout
                    log.warn(`${name} exit (${_signal}) failed with Error:`, error);
                    process.exitCode = 999;
                });
        });
    });
}
