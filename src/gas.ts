export const NEW_LOAN_GAS: number = 240000; // As of now it's on ganache: 167,196-167390 - 182,000???
export const NEW_FIRST_LOAN_GAS: number = 240000; // 227390
export const REPAY_GAS: number = 150000; // AugmintToken.transferAndNotify, as of now on testRpc: first: 105,354, tehn : 120305 ?
export const COLLECT_BASE_GAS: number = 90000; // as of now on testRpc: 1 loan = first: 73,333, consecutive:  64,683
export const COLLECT_ONE_GAS: number = 40000; // as of now: ca. 10000

export const TRANSFER_AUGMINT_TOKEN_GAS: number = 100000; // on testrpc: first: 75189 - 75405, rinkeby first: 76629
// consecutive : no narr: 45405 - 60405 (higher when sent to account which never received)
// w narrative: 46733 - 56693

export const PLACE_ORDER_GAS: number = 200000;

export const MATCH_ORDERS_GAS: number = 150000; // a single matchOrders

// base cost for matchMultipleOrders
// actual on ganache: 80667 but requires higher b/c Exchange contract's matchMultipleOrders stops matching if gasLeft < 100k
export const MATCH_MULTIPLE_FIRST_MATCH_GAS: number = 200000;

// additional cost for each match for matchMultipleOrder.
// actual on ganache: 2nd: +57760. then between 45652-47767, sometimes 5783?
export const MATCH_MULTIPLE_ADDITIONAL_MATCH_GAS: number = 50000;

// actuals on ganache: sell cancel: 31891-43725 / buy cancel: 24264-28470
//    last sell order cancel reverts in ganache with 60000 gas limit despite it runs w/ 31891 gas... likely a ganache bug
export const CANCEL_ORDER_GAS: number = 70000;

export const LEGACY_BALANCE_CONVERT_GAS: number = 200000;

export const NEW_LOCK_GAS: number = 200000; // actual on ganache: 176761
export const NEW_FIRST_LOCK_GAS: number = 240000; // actual on ganache: 206761

export const RELEASE_LOCK_GAS: number = 100000; // actual on ganache: 62515

export const SET_RATE_GAS_LIMIT: number = 80000;
