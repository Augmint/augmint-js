import { logger } from "./logger";
import { promiseTimeout } from "./promiseTimeout";

const DEFAULT_EXIT_TIMEOUT = 10000; // how much to wait before timing out disconnect (in ms)
const SIGNALS = ["SIGINT", "SIGQUIT", "SIGTERM"] as const;

const log = logger("sigintHandler");

type ExitHandlerFunction = (signal: string) => Promise<any>;

export function setExitHandler(
    exitHandlerCb: ExitHandlerFunction,
    name: string,
    exitTimeout = DEFAULT_EXIT_TIMEOUT
): void {
    SIGNALS.forEach(signal => {
        process.on(signal, async _signal => {
            await promiseTimeout(exitTimeout, exitHandlerCb(signal))
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
