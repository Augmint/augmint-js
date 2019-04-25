import { logger, promiseTimeout, setExitHandler } from "./utils/index";

import { EventEmitter } from "events";
import * as Web3 from "web3";
import { AugmintJsError } from "./Errors";

const log = logger("EthereumConnection");

export interface IOptions {
    ETHEREUM_CONNECTION_CHECK_INTERVAL: number;
    ETHEREUM_CONNECTION_TIMEOUT: number;
    ETHEREUM_ISLISTENING_TIMEOUT: number;
    ETHEREUM_CONNECTION_CLOSE_TIMEOUT: number;
    LOG_AS_SUCCESS_AFTER_N_CONFIRMATION: number;

    /** provider options in case connectiong via websocket provider */
    PROVIDER_TYPE?: string;
    PROVIDER_URL?: string;
    INFURA_PROJECT_ID?: string;

    /** in case web3 is available via window in browser TODO: use proper web3 typing here */
    provider?: any;
}

const DEFAULTS: IOptions = {
    ETHEREUM_CONNECTION_TIMEOUT: 10000,
    ETHEREUM_CONNECTION_CLOSE_TIMEOUT: 10000,
    ETHEREUM_ISLISTENING_TIMEOUT: 1000,
    ETHEREUM_CONNECTION_CHECK_INTERVAL: 1000,
    LOG_AS_SUCCESS_AFTER_N_CONFIRMATION: 3,

    INFURA_PROJECT_ID: ""
};

/**
 * Connect to Ethereum network via web3
 *  Maintains connection state, network properties
 *  Reconnects in case of connection dropped. NB: each consumer has to resubscribe atm after reconnection (on "connected" event)
 *  Usage:
 *      const ethereumConnection = new EthereumConnection();
 *      await ethereumConnection.connect().catch( e => {..} )
 * @fires   EthereumConnection#connected
 * @fires   EthereumConnection#disconnected NB: it's only in case of error code 1000, normal end
 * @fires   EthereumConnection#connectionLost
 * @extends EventEmitter
 */
export class EthereumConnection extends EventEmitter {
    public web3: Web3;
    public provider: Web3.Provider;
    public networkId: number;
    public blockGasLimit: number;
    public safeBlockGasLimit: number;
    public accounts: string[];

    public options: IOptions;

    public isStopping: boolean = false; /**  flag to avoid retrying connection when stop() called intentionally  */
    public isTryingToReconnect: boolean = false; /** flag to avoid  trying to reconnect if already */

    private wasConnected: boolean = false; /** internal flag used to supress repeating connection lost logging */

    private connectionCheckTimer: ReturnType<typeof setTimeout>; /** NodeJs vs. browser setTimeout returns diff. */

    constructor(runtimeOptions: IOptions) {
        super();

        /**
         * @namespace
         * @prop {object}   web3    web3.js object
         * @prop {object}   provider    shorthand for web3.currentProvider
         * @prop {boolean}  isStopping  indicates if the connection is being shut down (ie. via stop())
         * @prop {number}   networkId
         * @prop {array}    accounts       array of available accounts received from web3.eth.getAccounts()
         * @prop {number}   blockGasLimit    the block gas limit when the connection was estabilished
         * @prop {number}   safeBlockGasLimit  as blockGasLimit read on startup and it can change later so we provide a "safe" estimate which is 90% of the gasLimit
         * @prop {boolean}  isStopping      true when shutting down because stop() has been called (e.g. SIGTERM/SIGSTOP/SIGINT
         * @prop {boolean}  isTryingToReconnect  true while trying to reconnect because of connection loss detected
         */

        this.options = Object.assign({}, DEFAULTS, runtimeOptions);

        if (this.options.provider && (this.options.PROVIDER_URL || this.options.PROVIDER_TYPE)) {
            throw new AugmintJsError(
                "EthereumConnection error. Both provider and PROVIDER_TYPE or PROVIDER_URL passed as option. Use either provider or PROVIDER_TYPE + PROVIDER_URL not both  "
            );
        }

        if (!this.options.provider) {
            if (this.options.PROVIDER_TYPE !== "websocket") {
                throw new AugmintJsError(
                    "EthereumConnection error. Invalid PROVIDER_TYPE: " +
                        this.options.PROVIDER_TYPE +
                        " Only websocket is supported at the moment. You can pass custom provider using provider using provider option"
                );
            }
            if (!this.options.PROVIDER_URL) {
                throw new AugmintJsError(
                    "EthereumConnection error. No PROVIDER_URL specified while PROVIDER_TYPE is provided."
                );
            }
        }

        setExitHandler(
            this._exit.bind(this),
            "ethereumConnection",
            this.options.ETHEREUM_CONNECTION_CLOSE_TIMEOUT + 1000
        );

        log.info(
            // IMPORTANT: NEVER expose keys even not in logs!
            `** EthereumConnection loaded with settings:
            provider: ${this.options.provider ? "set" : "not set"}
            PROVIDER_TYPE: ${this.options.PROVIDER_TYPE}
            PROVIDER_URL: ${this.options.PROVIDER_URL}
            INFURA_PROJECT_ID: ${
                this.options.INFURA_PROJECT_ID
                    ? this.options.INFURA_PROJECT_ID.substring(0, 4) + "... rest hidden"
                    : "not provided"
            }
            ETHEREUM_CONNECTION_CHECK_INTERVAL: ${this.options.ETHEREUM_CONNECTION_CHECK_INTERVAL}
            LOG_AS_SUCCESS_AFTER_N_CONFIRMATION: ${this.options.LOG_AS_SUCCESS_AFTER_N_CONFIRMATION}`
        );
    }

    /**
     * Get connection state
     *
     * @returns {Promise<boolean>}  result from  web3.eth.net.isListening()
     * @memberof EthereumConnection
     */
    public async isConnected(): Promise<boolean> {
        let result: boolean = false;
        if (this.web3) {
            result = await promiseTimeout(
                this.options.ETHEREUM_ISLISTENING_TIMEOUT,
                this.web3.eth.net.isListening() as Promise<boolean>
            ).catch(() => {
                // Need timeout b/c listening pending forever when called after a connection.close() TODO: test if needed in newer web3 than beta 33
                // log.debug("isConnected isListening ERROR (returning false)", e);
                return false;
            });
        }

        return result;
    }

    /**
     *  next nonce for the account
     * @param  {string}  account Ethereum account with leading 0x
     * @return {Promise}         The result web3.eth.getTransactionCount(account) which is essentially the nonce for the next tx
     */
    public async getAccountNonce(account: string): Promise<number> {
        return await this.web3.eth.getTransactionCount(account);
    }

    public async connect(): Promise<void> {
        this.isStopping = false;

        if (this.options.PROVIDER_TYPE && this.options.PROVIDER_URL) {
            switch (this.options.PROVIDER_TYPE) {
                case "http": {
                    // provider.on is not a function with web3js beta 33 - maybe newer release? or shall we make it work without it?
                    // this.provider = new Web3.providers.HttpProvider(this.PROVIDER_URL + this.INFURA_PROJECT_ID);
                    // break;
                    throw new AugmintJsError(this.options.PROVIDER_TYPE + " is not supported yet");
                }
                case "websocket": {
                    this.provider = new Web3.providers.WebsocketProvider(
                        this.options.PROVIDER_URL + this.options.INFURA_PROJECT_ID
                    );
                    break;
                }
                default:
                    throw new AugmintJsError(this.options.PROVIDER_TYPE + " is not supported yet");
            }
        } else if (this.options.provider) {
            this.provider = this.options.provider;
        } else {
            throw new AugmintJsError(
                "EthereumConnection connect error: Neither PROVIDER_TYPE+PROVIDER_URL or provider specified. Can't connect"
            );
        }
        this.provider.on("error", this.onProviderError.bind(this));
        this.provider.on("end", this.onProviderEnd.bind(this));

        if (this.web3) {
            // it's  a reconnect
            this.web3.setProvider(this.provider);
        } else {
            this.web3 = new Web3(this.provider);
        }

        const connectedEventPromise: Promise<void> = new Promise(
            async (resolve: () => void, reject: any): Promise<void> => {
                if (await this.isConnected()) {
                    await this.initAfterProviderConnect();
                    resolve();
                } else {
                    const tempOnConnected: () => void = async (): Promise<void> => {
                    this.removeListener("providerError", tempOnproviderError);
                    this.removeListener("connectionLost", tempOnConnectionLost);
                        await this.initAfterProviderConnect();
                    resolve(); // we wait for our custom setup to finish before we resolve connect()
                };

                const tempOnproviderError: () => void = (): void => {
                    this.removeListener("connected", tempOnConnected);
                    this.removeListener("connectionLost", tempOnConnectionLost);
                    reject(new Error("EthereumConnection connect failed. Provider error received instead of connect"));
                };

                const tempOnConnectionLost: (e: any) => void = (e: any): void => {
                    this.removeListener("connected", tempOnConnected);
                    this.removeListener("providerError", tempOnproviderError);
                    reject(
                        new Error(
                            `EthereumConnection connect failed. connectionLost received instead of connect. Code: ${
                                e.code
                            } Reason: ${e.reason}`
                        )
                    );
                };

                this.once("connectionLost", tempOnConnectionLost);
                this.once("connected", tempOnConnected);
                this.once("providerError", tempOnproviderError); // this would be better: this.provider.once("end", e => { .. but web3js has a bug subscrbuing the same event multiple times.
            }
        );

        await promiseTimeout(this.options.ETHEREUM_CONNECTION_TIMEOUT, connectedEventPromise).catch(error => {
            throw new AugmintJsError("EthereumConnection connect error. " + error);
        });
    }

    public async stop(/*signal*/): Promise<void> {
        this.isStopping = true;
        clearTimeout(this.connectionCheckTimer);

        if (this.web3 && (await this.isConnected())) {
            const disconnectedEventPromise: Promise<void> = new Promise(
                (resolve: () => void): void => {
                    this.once("disconnected", () => {
                        resolve();
                    });
                }
            );

            await this.web3.currentProvider.connection.close();

            await promiseTimeout(this.options.ETHEREUM_CONNECTION_CLOSE_TIMEOUT, disconnectedEventPromise);
        }
    }

    private async initAfterProviderConnect(): Promise<void> {
        clearTimeout(this.connectionCheckTimer);

        let lastBlock;
        [this.networkId, lastBlock, this.accounts] = await Promise.all([
            this.web3.eth.net.getId().then((res: string): number => parseInt(res, 10)),
            this.web3.eth.getBlock("latest"),
            this.web3.eth.getAccounts()
        ]);
        this.blockGasLimit = lastBlock.gasLimit;
        this.safeBlockGasLimit = Math.round(this.blockGasLimit * 0.9);

        if (this.isTryingToReconnect) {
            this.isTryingToReconnect = false;
            log.warn(" EthereumConnection - provider connection recovered");
        } else {
            log.debug(" EthereumConnection - provider connected");
        }

        this.wasConnected = true;
        if (this.options.ETHEREUM_CONNECTION_CHECK_INTERVAL > 0) {
            this.connectionCheckTimer = setInterval(
                this._checkConnection.bind(this),
                this.options.ETHEREUM_CONNECTION_CHECK_INTERVAL
            );
        }

        this.emit("connected", this);
    }

    private onProviderEnd(e): void {
        if (e.code === 1000) {
            // Normal connection closure (currentProvider.close() was called from stop())
            log.debug(" EthereumConnection - Websocket ended with normal end code:", e.code, e.reason);
            this.emit("disconnected", e, this);
        } else {
            if (!this.isTryingToReconnect && !this.isStopping) {
                // Unexpected connection loss - _checkConnection() will try to reconnect in every RECONNECT_INTERVAL
                log.warn(" EthereumConnection - Websocket connection ended with code:", e.code, e.reason);
                this.emit("connectionLost", e, this);
            }
        }
    }

    private onProviderError(event): void {
        // NB: This is triggered with every isConnected() call too when not connected
        //  Supressing repeating logs while reconnecting - common due to infura dropping web3 connection ca. in every 1-2 hours)
        //       TODO: check if we should implement web3 keepalive pings or if newever versions on web3js are supporting it
        if (!this.isTryingToReconnect && !this.isStopping && this.wasConnected) {
            this.emit("providerError", event, this);
            log.warn(
                " EthereumConnection - provider error. Trying to reconnect. Logging provider errors are supressed until sucessfull reconnect."
            );
        }
    }

    private async _exit(signal: string): Promise<void> {
        await this.stop();
    }

    private async _checkConnection(): Promise<void> {
        // subscriptions are starting not to arrive on Infura websocket after a while and provider end is not always triggered
        //  TODO: - check if newer versions of web3 (newer than beta33) are handling webscoket connection drops correclty
        if (!this.isStopping && !(await this.isConnected())) {
            if (this.wasConnected) {
                // emit connectionLost (and log) only first reconnect attempt
                log.debug(
                    " EthereumConnection _checkConnection() - ethereumConnection.isConnected() returned false. trying to reconnect"
                );
                this.emit("connectionLost", { reason: "checkConnection detected connectionloss" }, this); // triggering this so modules can handle event
                this.wasConnected = false;
            }

            this._tryToReconnect();
        }
    }

    private async _tryToReconnect(): Promise<void> {
        if (!this.isStopping && !this.isTryingToReconnect) {
            // we won't try to reconnect if previous is still running (this.isTryingToReconnect)
            //    i.e the prev connect() will errror or worst case timeout in ETHEREUM_CONNECTION_TIMEOUT ms and _checkConnection is called in every x ms
            if (this.wasConnected) {
                log.warn(
                    "  EthereumConnection connnection lost to web3 provider. Keep trying to reconnect. Logging of further warnings supressed until connection recovers"
                );
            }

            this.isTryingToReconnect = true;
            await this.connect().catch(e => {
                // we ignore error and wait for next attempt to be triggered in ETHEREUM_CONNECTION_CHECK_INTERVAL ms
                log.debug(" EthereumConnection reconnection attempt error:", e);
            });
            this.isTryingToReconnect = false;
        }
    }
}
