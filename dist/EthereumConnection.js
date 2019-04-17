"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var EventEmitter = require("events");
var Web3 = require("web3");
var log_1 = require("./utils/log");
var promiseTimeout_1 = require("./utils/promiseTimeout");
var sigintHandler_1 = require("./utils/sigintHandler");
var log = log_1.default("EthereumConnection");
var DEFAULTS = {
    ETHEREUM_CONNECTION_TIMEOUT: 10000,
    ETHEREUM_CONNECTION_CLOSE_TIMEOUT: 10000,
    ETHEREUM_ISLISTENING_TIMEOUT: 1000,
    ETHEREUM_CONNECTION_CHECK_INTERVAL: 1000,
    PROVIDER_TYPE: "websocket",
    PROVIDER_URL: "ws://localhost:8545/",
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
var EthereumConnection = /** @class */ (function (_super) {
    __extends(EthereumConnection, _super);
    function EthereumConnection(runtimeOptions) {
        if (runtimeOptions === void 0) { runtimeOptions = {}; }
        var _this = _super.call(this) || this;
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
        _this.web3 = null;
        _this.provider = null;
        _this.isStopping = false; /** internal flag to avoid retrying connection when stop() called intentionally  */
        _this.isTryingToReconnect = false; /** internal flag to avoid  */
        _this.wasConnected = false; /** internal flag used to supress repeating connection lost logging */
        _this.connectionCheckTimer = null;
        _this.networkId = null;
        _this.blockGasLimit = null;
        _this.safeBlockGasLimit = null;
        _this.accounts = null;
        var options = Object.assign({}, DEFAULTS, runtimeOptions);
        _this.ETHEREUM_CONNECTION_CHECK_INTERVAL = options.ETHEREUM_CONNECTION_CHECK_INTERVAL;
        _this.ETHEREUM_CONNECTION_TIMEOUT = options.ETHEREUM_CONNECTION_TIMEOUT;
        _this.ETHEREUM_ISLISTENING_TIMEOUT = options.ETHEREUM_ISLISTENING_TIMEOUT;
        _this.ETHEREUM_CONNECTION_CLOSE_TIMEOUT = options.ETHEREUM_CONNECTION_CLOSE_TIMEOUT;
        _this.PROVIDER_TYPE = options.PROVIDER_TYPE;
        _this.PROVIDER_URL = options.PROVIDER_URL;
        _this.INFURA_PROJECT_ID = options.INFURA_PROJECT_ID;
        sigintHandler_1.default(_this._exit.bind(_this), "ethereumConnection", _this.ETHEREUM_CONNECTION_CLOSE_TIMEOUT + 1000);
        log.info(
        // IMPORTANT: NEVER expose keys even not in logs!
        "** EthereumConnection loaded with settings:\n            PROVIDER_TYPE: " + _this.PROVIDER_TYPE + "\n            PROVIDER_URL: " + _this.PROVIDER_URL + "\n            INFURA_PROJECT_ID: " + (_this.INFURA_PROJECT_ID ? _this.INFURA_PROJECT_ID.substring(0, 4) + "... rest hidden" : "not provided") + "\n            ETHEREUM_CONNECTION_CHECK_INTERVAL: " + _this.ETHEREUM_CONNECTION_CHECK_INTERVAL + "\n            LOG_AS_SUCCESS_AFTER_N_CONFIRMATION: " + process.env.LOG_AS_SUCCESS_AFTER_N_CONFIRMATION);
        return _this;
    }
    /**
     * Get connection state
     * @return {Promise} result from  web3.eth.net.isListening()
     */
    EthereumConnection.prototype.isConnected = function () {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        result = false;
                        if (!this.web3) return [3 /*break*/, 2];
                        return [4 /*yield*/, promiseTimeout_1.default(this.ETHEREUM_ISLISTENING_TIMEOUT, this.web3.eth.net.isListening()).catch(function () {
                                // Need timeout b/c listening pending forever when called after a connection.close() TODO: test if needed in newer web3 than beta 33
                                // log.debug("isConnected isListening ERROR (returning false)", e);
                                return false;
                            })];
                    case 1:
                        result = _a.sent();
                        _a.label = 2;
                    case 2: return [2 /*return*/, result];
                }
            });
        });
    };
    /**
     *  next nonce for the account
     * @param  {string}  account Ethereum account with leading 0x
     * @return {Promise}         The result web3.eth.getTransactionCount(account) which is essentially the nonce for the next tx
     */
    EthereumConnection.prototype.getAccountNonce = function (account) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.web3.eth.getTransactionCount(account)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    EthereumConnection.prototype.connect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var connectedEventPromise;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.isStopping = false;
                        switch (this.PROVIDER_TYPE) {
                            case "http": {
                                // provider.on is not a function with web3js beta 33 - maybe newer release? or shall we make it work without it?
                                //this.provider = new Web3.providers.HttpProvider(this.PROVIDER_URL + this.INFURA_PROJECT_ID);
                                //break;
                                throw new Error(this.PROVIDER_TYPE + " is not supported yet");
                            }
                            case "websocket": {
                                this.provider = new Web3.providers.WebsocketProvider(this.PROVIDER_URL + this.INFURA_PROJECT_ID);
                                break;
                            }
                            default:
                                throw new Error(this.PROVIDER_TYPE + " is not supported yet");
                        }
                        this.provider.on("error", this.onProviderError.bind(this));
                        this.provider.on("end", this.onProviderEnd.bind(this));
                        this.provider.on("connect", this.onProviderConnect.bind(this));
                        if (this.web3) {
                            // it's  a reconnect
                            this.web3.setProvider(this.provider);
                        }
                        else {
                            this.web3 = new Web3(this.provider);
                        }
                        connectedEventPromise = new Promise(function (resolve, reject) {
                            var tempOnConnected = function () {
                                _this.removeListener("providerError", tempOnproviderError);
                                _this.removeListener("connectionLost", tempOnConnectionLost);
                                resolve(); // we wait for our custom setup to finish before we resolve connect()
                            };
                            var tempOnproviderError = function () {
                                _this.removeListener("connected", tempOnConnected);
                                _this.removeListener("connectionLost", tempOnConnectionLost);
                                reject(new Error("EthereumConnection connect failed. Provider error received instead of connect"));
                            };
                            var tempOnConnectionLost = function (e) {
                                _this.removeListener("connected", tempOnConnected);
                                _this.removeListener("providerError", tempOnproviderError);
                                reject(new Error("EthereumConnection connect failed. connectionLost received instead of connect. Code: " + e.code + " Reason: " + e.reason));
                            };
                            _this.once("connectionLost", tempOnConnectionLost);
                            _this.once("connected", tempOnConnected);
                            _this.once("providerError", tempOnproviderError); // this would be better: this.provider.once("end", e => { .. but web3js has a bug subscrbuing the same event multiple times.
                        });
                        return [4 /*yield*/, promiseTimeout_1.default(this.ETHEREUM_CONNECTION_TIMEOUT, connectedEventPromise)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EthereumConnection.prototype.onProviderConnect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, lastBlock;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        clearTimeout(this.connectionCheckTimer);
                        return [4 /*yield*/, Promise.all([
                                this.web3.eth.net.getId().then(function (res) { return parseInt(res, 10); }),
                                this.web3.eth.getBlock("latest"),
                                this.web3.eth.getAccounts()
                            ])];
                    case 1:
                        _a = _b.sent(), this.networkId = _a[0], lastBlock = _a[1], this.accounts = _a[2];
                        this.blockGasLimit = lastBlock.gasLimit;
                        this.safeBlockGasLimit = Math.round(this.blockGasLimit * 0.9);
                        if (this.isTryingToReconnect) {
                            this.isTryingToReconnect = false;
                            log.warn(" EthereumConnection - provider connection recovered");
                        }
                        else {
                            log.debug(" EthereumConnection - provider connected");
                        }
                        this.wasConnected = true;
                        if (this.ETHEREUM_CONNECTION_CHECK_INTERVAL > 0) {
                            this.connectionCheckTimer = setInterval(this._checkConnection.bind(this), this.ETHEREUM_CONNECTION_CHECK_INTERVAL);
                        }
                        this.emit("connected", this);
                        return [2 /*return*/];
                }
            });
        });
    };
    EthereumConnection.prototype.onProviderEnd = function (e) {
        if (e.code === 1000) {
            // Normal connection closure (currentProvider.close() was called from stop())
            log.debug(" EthereumConnection - Websocket ended with normal end code:", e.code, e.reason);
            this.emit("disconnected", e, this);
        }
        else {
            if (!this.isTryingToReconnect && !this.isStopping) {
                // Unexpected connection loss - _checkConnection() will try to reconnect in every RECONNECT_INTERVAL
                log.warn(" EthereumConnection - Websocket connection ended with code:", e.code, e.reason);
                this.emit("connectionLost", e, this);
            }
        }
    };
    EthereumConnection.prototype.onProviderError = function (event) {
        // NB: This is triggered with every isConnected() call too when not connected
        //  Supressing repeating logs while reconnecting - common due to infura dropping web3 connection ca. in every 1-2 hours)
        //       TODO: check if we should implement web3 keepalive pings or if newever versions on web3js are supporting it
        if (!this.isTryingToReconnect && !this.isStopping && this.wasConnected) {
            this.emit("providerError", event, this);
            log.warn(" EthereumConnection - provider error. Trying to reconnect. Logging provider errors are supressed until sucessfull reconnect.");
        }
    };
    EthereumConnection.prototype.stop = function ( /*signal*/) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, disconnectedEventPromise;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        this.isStopping = true;
                        clearTimeout(this.connectionCheckTimer);
                        _a = this.web3;
                        if (!_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.isConnected()];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2:
                        if (!_a) return [3 /*break*/, 5];
                        disconnectedEventPromise = new Promise(function (resolve) {
                            _this.once("disconnected", function () {
                                resolve();
                            });
                        });
                        return [4 /*yield*/, this.web3.currentProvider.connection.close()];
                    case 3:
                        _b.sent();
                        return [4 /*yield*/, promiseTimeout_1.default(this.ETHEREUM_CONNECTION_CLOSE_TIMEOUT, disconnectedEventPromise)];
                    case 4:
                        _b.sent();
                        _b.label = 5;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    EthereumConnection.prototype._exit = function (signal) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.stop()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EthereumConnection.prototype._checkConnection = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = !this.isStopping;
                        if (!_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.isConnected()];
                    case 1:
                        _a = !(_b.sent());
                        _b.label = 2;
                    case 2:
                        // subscriptions are starting not to arrive on Infura websocket after a while and provider end is not always triggered
                        //  TODO: - check if newer versions of web3 (newer than beta33) are handling webscoket connection drops correclty
                        if (_a) {
                            if (this.wasConnected) {
                                // emit connectionLost (and log) only first reconnect attempt
                                log.debug(" EthereumConnection _checkConnection() - ethereumConnection.isConnected() returned false. trying to reconnect");
                                this.emit("connectionLost", { reason: "checkConnection detected connectionloss" }, this); // triggering this so modules can handle event
                                this.wasConnected = false;
                            }
                            this._tryToReconnect();
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    EthereumConnection.prototype._tryToReconnect = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(!this.isStopping && !this.isTryingToReconnect)) return [3 /*break*/, 2];
                        // we won't try to reconnect if previous is still running (this.isTryingToReconnect)
                        //    i.e the prev connect() will errror or worst case timeout in ETHEREUM_CONNECTION_TIMEOUT ms and _checkConnection is called in every x ms
                        if (this.wasConnected) {
                            log.warn("  EthereumConnection connnection lost to web3 provider. Keep trying to reconnect. Logging of further warnings supressed until connection recovers");
                        }
                        this.isTryingToReconnect = true;
                        return [4 /*yield*/, this.connect().catch(function (e) {
                                // we ignore error and wait for next attempt to be triggered in ETHEREUM_CONNECTION_CHECK_INTERVAL ms
                                log.debug(" EthereumConnection reconnection attempt error:", e);
                            })];
                    case 1:
                        _a.sent();
                        this.isTryingToReconnect = false;
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    return EthereumConnection;
}(EventEmitter));
exports.default = EthereumConnection;
//# sourceMappingURL=EthereumConnection.js.map