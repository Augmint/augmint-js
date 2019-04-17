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
var cost = require("./gas");
var Contract_1 = require("./Contract");
var AugmintToken_1 = require("./AugmintToken");
var constants_1 = require("./constants");
var Rates_1 = require("./Rates");
var BigNumber = require("bignumber.js");
var ExchangeArtifact = require("../abiniser/abis/Exchange_ABI_d3e7f8a261b756f9c40da097608b21cd.json");
/**
 * Augmint Exchange contract class
 * @class Exchange
 * @extends Contract
 */
var Exchange = /** @class */ (function (_super) {
    __extends(Exchange, _super);
    function Exchange() {
        var _this = _super.call(this) || this;
        _this.rates = null;
        _this.tokenPeggedSymbol = null; /** fiat symbol this exchange is linked to (via Exchange.augmintToken) */
        _this.tokenSymbol = null; /** token symbol this exchange contract instance is linked to  */
        return _this;
    }
    Exchange.prototype.connect = function (ethereumConnection, exchangeAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, tokenAddressAtExchange, ratesAddressAtExchange;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, _super.prototype.connect.call(this, ethereumConnection, ExchangeArtifact, exchangeAddress)];
                    case 1:
                        _b.sent();
                        this.rates = new Rates_1.default();
                        return [4 /*yield*/, this.rates.connect(this.ethereumConnection)];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, Promise.all([
                                this.instance.methods.augmintToken().call(),
                                this.instance.methods.rates().call()
                            ])];
                    case 3:
                        _a = _b.sent(), tokenAddressAtExchange = _a[0], ratesAddressAtExchange = _a[1];
                        if (ratesAddressAtExchange !== this.rates.address) {
                            throw new Error("Exchange: latest Rates contract deployment address " + this.rates.address + " for provided ABI doesn't match rates contract address " + ratesAddressAtExchange + " at deployed Exchange contract");
                        }
                        this.augmintToken = new AugmintToken_1.default();
                        return [4 /*yield*/, this.augmintToken.connect(this.ethereumConnection)];
                    case 4:
                        _b.sent();
                        if (tokenAddressAtExchange !== this.augmintToken.address) {
                            throw new Error("Exchange: latest AugmintToken contract deployment address at " + this.augmintToken.address + "  doesn't match AugmintToken contract address set at latest deployed Exchange contract: " + tokenAddressAtExchange + ".\n                Connecting to legacy Exchanges is not supported yet");
                        }
                        this.tokenPeggedSymbol = this.augmintToken.peggedSymbol;
                        this.tokenSymbol = this.augmintToken.symbol;
                        return [2 /*return*/, this.instance];
                }
            });
        });
    };
    /**
     * Fetches current OrderBook and returns as many matching orderIds (at current ETHFiat rate) as fits into the provided gas limit.
     *  if no gasLimit provided then ethereumConnection.safeBlockGasLimit is used
     * The returned matchingOrders can be passed to signAndSendMatchMultiple or matchMultiple functions
     * @param  {number}  [gasLimit=EthereumConnection.safeBlockGasLimit]   return as many matches as it fits to gasLimit based on gas cost estimate.
     * @return {Promise}            pairs of matching order id , ordered by execution sequence
                                   { buyIds: [], sellIds: [], gasEstimate }
     */
    Exchange.prototype.getMatchingOrders = function (gasLimit) {
        if (gasLimit === void 0) { gasLimit = this.ethereumConnection.safeBlockGasLimit; }
        return __awaiter(this, void 0, void 0, function () {
            var _a, orderBook, bn_ethFiatRate, matches;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.all([
                            this.fetchOrderBook(),
                            this.rates.getBnEthFiatRate(this.tokenPeggedSymbol)
                        ])];
                    case 1:
                        _a = _b.sent(), orderBook = _a[0], bn_ethFiatRate = _a[1];
                        matches = this.calculateMatchingOrders(orderBook.buyOrders, orderBook.sellOrders, bn_ethFiatRate, gasLimit);
                        return [2 /*return*/, matches];
                }
            });
        });
    };
    /**
     * Fetches, parses and orders the current, full orderBook from Exchange
     * @return {Promise} the current, ordered orderBook in the format of:
     *                  { buyOrders: [{id, maker, direction, bn_amount (in Wei), bn_ethAmount, amount (in eth), bn_price (in PPM)],
     *                  sellOrders: [{id, maker, direction, bn_amount (without decimals), amount (in AEUR), bn_price (in PPM)}]
     */
    Exchange.prototype.fetchOrderBook = function () {
        return __awaiter(this, void 0, void 0, function () {
            var isLegacyExchangeContract, chunkSize, orderCounts, buyCount, sellCount, buyOrders, queryCount, i, fetchedOrders, sellOrders, i, fetchedOrders;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        isLegacyExchangeContract = typeof this.instance.methods.CHUNK_SIZE === "function";
                        chunkSize = isLegacyExchangeContract ? constants_1.LEGACY_CONTRACTS_CHUNK_SIZE : constants_1.CHUNK_SIZE;
                        return [4 /*yield*/, this.instance.methods.getActiveOrderCounts().call({ gas: 4000000 })];
                    case 1:
                        orderCounts = _a.sent();
                        buyCount = parseInt(orderCounts.buyTokenOrderCount, 10);
                        sellCount = parseInt(orderCounts.sellTokenOrderCount, 10);
                        buyOrders = [];
                        queryCount = Math.ceil(buyCount / constants_1.LEGACY_CONTRACTS_CHUNK_SIZE);
                        i = 0;
                        _a.label = 2;
                    case 2:
                        if (!(i < queryCount)) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.getOrders(constants_1.TOKEN_BUY, i * chunkSize)];
                    case 3:
                        fetchedOrders = _a.sent();
                        buyOrders = buyOrders.concat(fetchedOrders.buyOrders);
                        _a.label = 4;
                    case 4:
                        i++;
                        return [3 /*break*/, 2];
                    case 5:
                        sellOrders = [];
                        queryCount = Math.ceil(sellCount / chunkSize);
                        i = 0;
                        _a.label = 6;
                    case 6:
                        if (!(i < queryCount)) return [3 /*break*/, 9];
                        return [4 /*yield*/, this.getOrders(constants_1.TOKEN_SELL, i * chunkSize)];
                    case 7:
                        fetchedOrders = _a.sent();
                        sellOrders = sellOrders.concat(fetchedOrders.sellOrders);
                        _a.label = 8;
                    case 8:
                        i++;
                        return [3 /*break*/, 6];
                    case 9:
                        buyOrders.sort(this.isOrderBetter);
                        sellOrders.sort(this.isOrderBetter);
                        return [2 /*return*/, { buyOrders: buyOrders, sellOrders: sellOrders }];
                }
            });
        });
    };
    Exchange.prototype.getOrders = function (orderDirection, offset) {
        return __awaiter(this, void 0, void 0, function () {
            var blockGasLimit, isLegacyExchangeContract, chunkSize, result, _a, _b, orders;
            var _this = this;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        blockGasLimit = this.ethereumConnection.safeGasLimit;
                        isLegacyExchangeContract = typeof this.instance.methods.CHUNK_SIZE === "function";
                        chunkSize = isLegacyExchangeContract ? constants_1.LEGACY_CONTRACTS_CHUNK_SIZE : constants_1.CHUNK_SIZE;
                        if (!(orderDirection === constants_1.TOKEN_BUY)) return [3 /*break*/, 5];
                        if (!isLegacyExchangeContract) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.instance.methods.getActiveBuyOrders(offset).call({ gas: blockGasLimit })];
                    case 1:
                        _a = _c.sent();
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, this.instance.methods.getActiveBuyOrders(offset, chunkSize).call({ gas: blockGasLimit })];
                    case 3:
                        _a = _c.sent();
                        _c.label = 4;
                    case 4:
                        result = _a;
                        return [3 /*break*/, 10];
                    case 5:
                        if (!isLegacyExchangeContract) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.instance.methods.getActiveSellOrders(offset).call({ gas: blockGasLimit })];
                    case 6:
                        _b = _c.sent();
                        return [3 /*break*/, 9];
                    case 7: return [4 /*yield*/, this.instance.methods.getActiveSellOrders(offset, chunkSize).call({ gas: blockGasLimit })];
                    case 8:
                        _b = _c.sent();
                        _c.label = 9;
                    case 9:
                        result = _b;
                        _c.label = 10;
                    case 10:
                        orders = result.reduce(function (res, order) {
                            var bn_amount = new BigNumber(order[3]);
                            if (!bn_amount.eq(0)) {
                                var parsed = {
                                    id: parseInt(order[0], 10),
                                    maker: "0x" + new BigNumber(order[1]).toString(16).padStart(40, "0"),
                                    bn_price: new BigNumber(order[2]),
                                    bn_amount: bn_amount,
                                    price: 0,
                                    direction: 0,
                                    bn_ethAmount: '',
                                    amount: 0
                                };
                                parsed.price = parsed.bn_price / constants_1.PPM_DIV;
                                if (orderDirection === constants_1.TOKEN_BUY) {
                                    parsed.direction = constants_1.TOKEN_BUY;
                                    parsed.bn_ethAmount = parsed.bn_amount.div(constants_1.ONE_ETH_IN_WEI);
                                    parsed.amount = parseFloat(parsed.bn_ethAmount);
                                    res.buyOrders.push(parsed);
                                }
                                else {
                                    parsed.direction = constants_1.TOKEN_SELL;
                                    parsed.amount = parseFloat((parsed.bn_amount / _this.augmintToken.decimalsDiv).toFixed(2));
                                    res.sellOrders.push(parsed);
                                }
                            }
                            return res;
                        }, { buyOrders: [], sellOrders: [] });
                        return [2 /*return*/, orders];
                }
            });
        });
    };
    Exchange.prototype.isOrderBetter = function (o1, o2) {
        if (o1.direction !== o2.direction) {
            throw new Error("isOrderBetter(): order directions must be the same" + o1 + o2);
        }
        var dir = o1.direction === constants_1.TOKEN_SELL ? 1 : -1;
        return o1.price * dir > o2.price * dir || (o1.price === o2.price && o1.id > o2.id) ? 1 : -1;
    };
    /**
     * Sends a matchMultipleOrders transaction
     * Intended to use when account wallet is available (e.g. MetamMask)  * @param {string} account    tx sender account
     * @param {string} account    tx sender account
     * @param  {*} matchingOrders
     * @returns {Promise}     A web3.js Promi event object sent to the network. Resolves when mined and you can subscribe to events, eg. .on("confirmation")
     * @memberof Exchange
     */
    Exchange.prototype.matchMultipleOrders = function (account, matchingOrders) {
        return __awaiter(this, void 0, void 0, function () {
            var matchMultipleOrdersTx;
            return __generator(this, function (_a) {
                matchMultipleOrdersTx = this.getMatchMultipleOrdersTx(matchingOrders.buyIds, matchingOrders.sellIds);
                return [2 /*return*/, matchMultipleOrdersTx.send({ from: account, gas: matchingOrders.gasEstimate })];
            });
        });
    };
    /**
     * Signs a matchMultipleOrders transaction with a private key and sends it (with web3.js sendSignedTransaction)     *
     * Intended to use when private key is available, e.g. backend services
     * @param  {string} account     tx signer ethereum account
     * @param  {string} privateKey  Private key of the Ethereum account to sign the tx with. Include leading 0x
     * @param  {object} matchingOrders    Returned by getMatchingOrders in format of {buyIds:[], sellIds: [], gasEstimate}
     * @return {Promise}           A web3.js Promi event object sent to the network. Resolves when mined and you can subscribe to events, eg. .on("confirmation")
     * @memberof Exchange
     */
    Exchange.prototype.signAndSendMatchMultipleOrders = function (account, privateKey, matchingOrders) {
        return __awaiter(this, void 0, void 0, function () {
            var matchMultipleOrdersTx, encodedABI, txToSign, signedTx;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        matchMultipleOrdersTx = this.getMatchMultipleOrdersTx(matchingOrders.buyIds, matchingOrders.sellIds);
                        encodedABI = matchMultipleOrdersTx.encodeABI();
                        txToSign = {
                            from: account,
                            to: this.address,
                            gasLimit: matchingOrders.gasEstimate,
                            data: encodedABI
                        };
                        return [4 /*yield*/, this.web3.eth.accounts.signTransaction(txToSign, privateKey)];
                    case 1:
                        signedTx = _a.sent();
                        return [2 /*return*/, this.web3.eth.sendSignedTransaction(signedTx.rawTransaction)];
                }
            });
        });
    };
    /**
     * Returns a web3 transaction to match the passed buyIds and sellIds. Call .send() or sign it on the returned tx.
     * @param  {array} buyIds   array with a list of BUY order IDs (ordered)
     * @param  {array} sellIds  array with a list of SELL order IDs (ordered)
     * @return {Promise}         web3 transaction which can be executed with .send({account, gas})
     * @memberof Exchange
     */
    Exchange.prototype.getMatchMultipleOrdersTx = function (buyIds, sellIds) {
        if (sellIds.length === 0 || sellIds.length !== buyIds.length) {
            throw new Error("invalid buyIds/sellIds recevied - no ids or the the params are not equal.");
        }
        var tx = this.instance.methods.matchMultipleOrders(buyIds, sellIds);
        return tx;
    };
    /**
     * calculate matching pairs from ordered ordebook for sending in Exchange.matchMultipleOrders ethereum tx
     * @param  {object} _buyOrders     must be ordered by price descending then by id ascending
     * @param  {array} _sellOrders    must be ordered by price ascending then by id ascending
     * @param  {BigNumber} bn_ethFiatRate current ETHFiat rate to use for calculation
     * @param  {number} gasLimit       return as many matches as it fits to gasLimit based on gas cost estimate.
     * @return {object}                pairs of matching order id , ordered by execution sequence { buyIds: [], sellIds: [], gasEstimate }
     */
    Exchange.prototype.calculateMatchingOrders = function (_buyOrders, _sellOrders, bn_ethFiatRate, gasLimit) {
        var sellIds = [];
        var buyIds = [];
        if (_buyOrders.length === 0 || _sellOrders.length === 0) {
            return { buyIds: buyIds, sellIds: sellIds, gasEstimate: 0 };
        }
        var lowestSellPrice = _sellOrders[0].price;
        var highestBuyPrice = _buyOrders[0].price;
        var buyOrders = _buyOrders
            .filter(function (o) { return o.price >= lowestSellPrice; })
            .map(function (o) { return ({ id: o.id, price: o.price, bn_ethAmount: o.bn_ethAmount }); });
        var sellOrders = _sellOrders
            .filter(function (o) { return o.price <= highestBuyPrice; })
            .map(function (o) { return ({ id: o.id, price: o.price, bn_tokenAmount: new BigNumber(o.amount) }); });
        var buyIdx = 0;
        var sellIdx = 0;
        var gasEstimate = 0;
        var nextGasEstimate = cost.MATCH_MULTIPLE_FIRST_MATCH_GAS;
        while (buyIdx < buyOrders.length && sellIdx < sellOrders.length && nextGasEstimate <= gasLimit) {
            var sellOrder = sellOrders[sellIdx];
            var buyOrder = buyOrders[buyIdx];
            sellIds.push(sellOrder.id);
            var id = buyOrder.id;
            buyIds.push(id);
            var tradedEth = void 0;
            var tradedTokens = void 0;
            var matchPrice = buyOrder.id > sellOrder.id ? sellOrder.price : buyOrder.price;
            buyOrder.bn_tokenValue = bn_ethFiatRate
                .div(matchPrice)
                .mul(buyOrder.bn_ethAmount)
                .round(2);
            sellOrder.bn_ethValue = sellOrder.bn_tokenAmount
                .mul(matchPrice)
                .div(bn_ethFiatRate)
                .round(18);
            if (sellOrder.bn_tokenAmount.lt(buyOrder.bn_tokenValue)) {
                tradedEth = sellOrder.bn_ethValue;
                tradedTokens = sellOrder.bn_tokenAmount;
            }
            else {
                tradedEth = buyOrder.bn_ethAmount;
                tradedTokens = buyOrder.bn_tokenValue;
            }
            // console.debug(
            //     `MATCH:  BUY: id: ${buyOrder.id} price: ${
            //         buyOrder.price
            //     } Amount: ${buyOrder.bn_ethAmount.toString()} ETH tokenValue: ${buyOrder.bn_tokenValue.toString()}
            // SELL: id: ${sellOrder.id} price: ${
            //         sellOrder.price
            //     } Amount: ${sellOrder.bn_tokenAmount.toString()} AEUR  ethValue: ${sellOrder.bn_ethValue.toString()}
            // Traded: ${tradedEth.toString()} ETH <-> ${tradedTokens.toString()} AEUR @${(matchPrice * 100).toFixed(
            //         2
            //     )}% on ${bn_ethFiatRate.toString()} ETHEUR`
            // );
            buyOrder.bn_ethAmount = buyOrder.bn_ethAmount.sub(tradedEth);
            buyOrder.bn_tokenValue = buyOrder.bn_tokenValue.sub(tradedTokens);
            if (buyOrder.bn_ethAmount.eq(0)) {
                buyIdx++;
            }
            sellOrder.bn_ethValue = sellOrder.bn_ethValue.sub(tradedEth);
            sellOrder.bn_tokenAmount = sellOrder.bn_tokenAmount.sub(tradedTokens);
            if (sellOrder.bn_tokenAmount.eq(0)) {
                sellIdx++;
            }
            gasEstimate = nextGasEstimate;
            nextGasEstimate += cost.MATCH_MULTIPLE_ADDITIONAL_MATCH_GAS;
        }
        return { buyIds: buyIds, sellIds: sellIds, gasEstimate: gasEstimate };
    };
    return Exchange;
}(Contract_1.default));
exports.default = Exchange;
module.exports = Exchange;
//# sourceMappingURL=Exchange.js.map