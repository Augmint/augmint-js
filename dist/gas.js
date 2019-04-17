"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NEW_LOAN_GAS = 240000; // As of now it's on ganache: 167,196-167390 - 182,000???
exports.NEW_FIRST_LOAN_GAS = 240000; // 227390
exports.REPAY_GAS = 150000; // AugmintToken.transferAndNotify, as of now on testRpc: first: 105,354, tehn : 120305 ?
exports.COLLECT_BASE_GAS = 90000; // as of now on testRpc: 1 loan = first: 73,333, consecutive:  64,683
exports.COLLECT_ONE_GAS = 20000; // as of now: ca. 10000
exports.TRANSFER_AUGMINT_TOKEN_GAS = 100000; // on testrpc: first: 75189 - 75405, rinkeby first: 76629
//consecutive : no narr: 45405 - 60405 (higher when sent to account which never received)
// w narrative: 46733 - 56693
exports.PLACE_ORDER_GAS = 200000;
exports.MATCH_ORDERS_GAS = 150000; // a single matchOrders
// base cost for matchMultipleOrders
// actual on ganache: 80667 but requires higher b/c Exchange contract's matchMultipleOrders stops matching if gasLeft < 100k
exports.MATCH_MULTIPLE_FIRST_MATCH_GAS = 200000;
// additional cost for each match for matchMultipleOrder.
// actual on ganache: 2nd: +57760. then between 45652-47767, sometimes 5783?
exports.MATCH_MULTIPLE_ADDITIONAL_MATCH_GAS = 50000;
// actuals on ganache: sell cancel: 31891-43725 / buy cancel: 24264-28470
//    last sell order cancel reverts in ganache with 60000 gas limit despite it runs w/ 31891 gas... likely a ganache bug
exports.CANCEL_ORDER_GAS = 70000;
exports.LEGACY_BALANCE_CONVERT_GAS = 200000;
exports.NEW_LOCK_GAS = 200000; // actual on ganache: 176761
exports.NEW_FIRST_LOCK_GAS = 240000; // actual on ganache: 206761
exports.RELEASE_LOCK_GAS = 100000; // actual on ganache: 62515
exports.SET_RATE_GAS_LIMIT = 80000;
//# sourceMappingURL=gas.js.map