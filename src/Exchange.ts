import BN from "bn.js";
import { Exchange as ExchangeInstance } from "../generated/index";
import { TransactionObject } from "../generated/types/types";
import { AbstractContract } from "./AbstractContract";
import { AugmintToken } from "./AugmintToken";
import { CHUNK_SIZE, LEGACY_CONTRACTS_CHUNK_SIZE } from "./constants";
import { EthereumConnection } from "./EthereumConnection";
import { MATCH_MULTIPLE_ADDITIONAL_MATCH_GAS, MATCH_MULTIPLE_FIRST_MATCH_GAS, PLACE_ORDER_GAS } from "./gas";
import { Rates } from "./Rates";
import { Transaction } from "./Transaction";

export enum OrderDirection {
    TOKEN_BUY /** Buy order: orderDirection is 0 in contract */,
    TOKEN_SELL /** Sell order: orderDirection is 1 in contract */
}

export interface IOrderBook {
    buyOrders: IOrder[];
    sellOrders: IOrder[];
}

export interface IMatchingOrders {
    buyIds: number[];
    sellIds: number[];
    gasEstimate: number;
}

export interface IOrder {
    id: number;
    maker: string;
    direction: OrderDirection;
    amount: BN /** Buy order amount in Wei | Sell order amount in tokens, without decimals */;
    price: BN /** price in PPM (parts per million) | price in PPM (parts per million) */;
}

type IOrderTuple = [string, string, string, string]; /** result from contract: [id, maker, price, amount] */

interface ISimpleMatchingOrders {
    tokens: number;
    ethers: number;
    limitPrice: number;
    averagePrice: number;
}

export interface IExchangeOptions {
    token: AugmintToken;
    rates: Rates;
    ethereumConnection: EthereumConnection;
}

/**
 * Augmint Exchange contract class
 * @class Exchange
 * @extends Contract
 */
export class Exchange extends AbstractContract {
    public instance: ExchangeInstance;
    private web3: any;
    private safeBlockGasLimit: number;
    /** fiat symbol this exchange is linked to (via Exchange.augmintToken) */
    private token: AugmintToken;
    private tokenPeggedSymbol: Promise<string>;
    private rates: Rates;
    private ethereumConnection: EthereumConnection;

    constructor(deployedContractInstance: ExchangeInstance, options: IExchangeOptions) {
        super(deployedContractInstance);
        this.instance = deployedContractInstance;
        this.ethereumConnection = options.ethereumConnection;
        this.web3 = this.ethereumConnection.web3;
        this.safeBlockGasLimit = this.ethereumConnection.safeBlockGasLimit;
        this.rates = options.rates;
        this.token = options.token;
    }

    /**
     * Fetches current OrderBook and returns as many matching orderIds (at current ETHFiat rate) as fits into the provided gas limit.
     *  if no gasLimit provided then ethereumConnection.safeBlockGasLimit is used
     * The returned matchingOrders can be passed to signAndSendMatchMultiple or matchMultiple functions
     * @param  {number}  [gasLimit=EthereumConnection.safeBlockGasLimit]   return as many matches as it fits to gasLimit based on gas cost estimate.
     * @return {Promise}            pairs of matching order id , ordered by execution sequence { buyIds: [], sellIds: [], gasEstimate }
     */
    public async getMatchingOrders(gasLimit: number = this.safeBlockGasLimit): Promise<IMatchingOrders> {
        const tokenPeggedSymbol: string = await this.tokenPeggedSymbol;
        const [orderBook, ethFiatRate]: [IOrderBook, BN] = await Promise.all([
            this.getOrderBook(),
            this.rates.getEthFiatRate(tokenPeggedSymbol)
        ]);

        return this.calculateMatchingOrders(orderBook.buyOrders, orderBook.sellOrders, ethFiatRate, gasLimit);
    }

    /**
     * Fetches, parses and orders the current, full orderBook from Exchange
     *
     * @returns {Promise<IOrderBook>}   the current, ordered orderBook
     * @memberof Exchange
     */
    public async getOrderBook(): Promise<IOrderBook> {
        // TODO: handle when order changes while iterating
        // @ts-ignore  TODO: remove ts - ignore and handle properly when legacy contract support added
        const isLegacyExchangeContract: boolean = typeof this.instance.methods.CHUNK_SIZE === "function";
        const chunkSize: number = isLegacyExchangeContract ? LEGACY_CONTRACTS_CHUNK_SIZE : CHUNK_SIZE;

        const orderCounts: {
            buyTokenOrderCount: string;
            sellTokenOrderCount: string;
        } = await this.instance.methods.getActiveOrderCounts().call({ gas: 4000000 });
        const buyCount: number = parseInt(orderCounts.buyTokenOrderCount, 10);
        const sellCount: number = parseInt(orderCounts.sellTokenOrderCount, 10);

        // retreive all orders
        let buyOrders: IOrder[] = [];
        let queryCount: number = Math.ceil(buyCount / LEGACY_CONTRACTS_CHUNK_SIZE);

        for (let i: number = 0; i < queryCount; i++) {
            const fetchedOrders: IOrderBook = await this.getOrders(OrderDirection.TOKEN_BUY, i * chunkSize);
            buyOrders = buyOrders.concat(fetchedOrders.buyOrders);
        }

        let sellOrders: IOrder[] = [];
        queryCount = Math.ceil(sellCount / chunkSize);
        for (let i: number = 0; i < queryCount; i++) {
            const fetchedOrders: IOrderBook = await this.getOrders(OrderDirection.TOKEN_SELL, i * chunkSize);
            sellOrders = sellOrders.concat(fetchedOrders.sellOrders);
        }

        buyOrders.sort(this.isOrderBetter);
        sellOrders.sort(this.isOrderBetter);

        return { buyOrders, sellOrders };
    }

    public async getOrders(orderDirection: OrderDirection, offset: number): Promise<IOrderBook> {
        const blockGasLimit: number = this.safeBlockGasLimit;
        // @ts-ignore  TODO: remove ts-ignore and handle properly when legacy contract support added
        const isLegacyExchangeContract: boolean = typeof this.instance.methods.CHUNK_SIZE === "function";
        const chunkSize: number = isLegacyExchangeContract ? LEGACY_CONTRACTS_CHUNK_SIZE : CHUNK_SIZE;

        let result: IOrderTuple[];
        if (orderDirection === OrderDirection.TOKEN_BUY) {
            // prettier-ignore
            result = isLegacyExchangeContract
                // @ts-ignore  TODO: remove ts-ignore and handle properly when legacy contract support added
                ? await this.instance.methods.getActiveBuyOrders(offset).call({ gas: blockGasLimit })
                : await this.instance.methods.getActiveBuyOrders(offset, chunkSize).call({ gas: blockGasLimit });
        } else {
            // prettier-ignore
            result = isLegacyExchangeContract
                // @ts-ignore  TODO: remove ts - ignore and handle properly when legacy contract support added
                ? await this.instance.methods.getActiveSellOrders(offset).call({ gas: blockGasLimit })
                : await this.instance.methods.getActiveSellOrders(offset, chunkSize).call({ gas: blockGasLimit });
        }

        // result format: [id, maker, price, amount]
        const orders: IOrderBook = result.reduce(
            (res: IOrderBook, order: IOrderTuple) => {
                const amount: BN = new BN(order[3]);
                if (!amount.isZero()) {
                    const price: BN = new BN(order[2]);
                    const parsed: IOrder = {
                        id: parseInt(order[0], 10),
                        maker: `0x${new BN(order[1]).toString(16).padStart(40, "0")}`, // leading 0s if address starts with 0
                        price,
                        amount,
                        direction: orderDirection
                    };

                    if (orderDirection === OrderDirection.TOKEN_BUY) {
                        res.buyOrders.push(parsed);
                    } else {
                        res.sellOrders.push(parsed);
                    }
                }
                return res;
            },
            { buyOrders: [], sellOrders: [] }
        );

        return orders;
    }

    public placeSellTokenOrder(price: BN, amount: BN): Transaction {
        const web3Tx: TransactionObject<void> = this.token.instance.methods.transferAndNotify(
            this.address,
            amount.toString(),
            price.toString()
        );

        const transaction: Transaction = new Transaction(this.ethereumConnection, web3Tx, {
            gasLimit: PLACE_ORDER_GAS,
            to: this.address
        });

        return transaction;
    }

    public placeBuyTokenOrder(price: BN, amount: BN): Transaction {
        const web3Tx: TransactionObject<string> = this.instance.methods.placeBuyTokenOrder(price.toString());

        const transaction: Transaction = new Transaction(this.ethereumConnection, web3Tx, {
            gasLimit: PLACE_ORDER_GAS,
            to: this.address,
            value: amount
        });

        return transaction;
    }

    public isOrderBetter(o1: IOrder, o2: IOrder): number {
        if (o1.direction !== o2.direction) {
            throw new Error("isOrderBetter(): order directions must be the same" + o1 + o2);
        }

        const dir: BN = o1.direction === OrderDirection.TOKEN_SELL ? new BN(1) : new BN(-1);

        return o1.price.mul(dir).gt(o2.price.mul(dir)) || (o1.price.eq(o2.price) && o1.id > o2.id) ? 1 : -1;
    }

    /**
     *  Returns a [Transaction] object with which can be signed and sent or sent to the ethereum network
     *
     * @param {IMatchingOrders} matchingOrders  use [getMatchingOrders] method to get it
     * @returns {Transaction}
     * @memberof Exchange
     */
    public matchMultipleOrders(matchingOrders: IMatchingOrders): Transaction {
        if (matchingOrders.sellIds.length === 0 || matchingOrders.sellIds.length !== matchingOrders.buyIds.length) {
            throw new Error("invalid buyIds/sellIds recevied - no ids or the the params are not equal.");
        }

        const web3Tx: TransactionObject<string> = this.instance.methods.matchMultipleOrders(
            matchingOrders.buyIds,
            matchingOrders.sellIds
        );
        const transaction: Transaction = new Transaction(this.ethereumConnection, web3Tx, {
            gasLimit: matchingOrders.gasEstimate,
            // to: needs to be set if going to be signed.
            // (getting unhandled rejection errors if not set even tx is successful on ganache. beta36 )
            to: this.address
        });

        return transaction;
    }

    /**
     * calculate matching pairs from ordered ordebook for sending in Exchange.matchMultipleOrders ethereum tx
     * @param  {object} _buyOrders     must be ordered by price descending then by id ascending
     * @param  {array} _sellOrders    must be ordered by price ascending then by id ascending
     * @param  {BN} ethFiatRate current ETHFiat rate to use for calculation
     * @param  {number} gasLimit       return as many matches as it fits to gasLimit based on gas cost estimate.
     * @return {object}                pairs of matching order id , ordered by execution sequence { buyIds: [], sellIds: [], gasEstimate }
     */
    public calculateMatchingOrders(
        _buyOrders: IOrder[],
        _sellOrders: IOrder[],
        ethFiatRate: BN,
        gasLimit: number
    ): IMatchingOrders {
        const sellIds: number[] = [];
        const buyIds: number[] = [];

        if (_buyOrders.length === 0 || _sellOrders.length === 0) {
            return { buyIds, sellIds, gasEstimate: 0 };
        }
        const lowestSellPrice: BN = _sellOrders[0].price;
        const highestBuyPrice: BN = _buyOrders[0].price;

        const buyOrders: IOrder[] = _buyOrders
            .filter((o: IOrder) => o.price.gte(lowestSellPrice));

        const sellOrders: IOrder[] = _sellOrders
            .filter((o: IOrder) => o.price.lte(highestBuyPrice));

        let buyIdx: number = 0;
        let sellIdx: number = 0;
        let gasEstimate: number = 0;
        let nextGasEstimate: number = MATCH_MULTIPLE_FIRST_MATCH_GAS;

        const E12: BN = new BN("1000000000000");
        while (buyIdx < buyOrders.length && sellIdx < sellOrders.length && nextGasEstimate <= gasLimit) {

            const sell: IOrder = sellOrders[sellIdx];
            const buy: IOrder = buyOrders[buyIdx];
            sellIds.push(sell.id);
            buyIds.push(buy.id);

            // matching logic follows smart contract _fillOrder implementation
            // see https://github.com/Augmint/augmint-contracts/blob/staging/contracts/Exchange.sol
            const price: BN = buy.id > sell.id ? sell.price : buy.price;

            const sellWei: BN = sell.amount.mul(price).mul(E12).divRound(ethFiatRate);

            let tradedWei: BN;
            let tradedTokens: BN;
            if (sellWei.lte(buy.amount)) {
                tradedWei = sellWei;
                tradedTokens = sell.amount;
            } else {
                tradedWei = buy.amount;
                tradedTokens = buy.amount.mul(ethFiatRate).divRound(price.mul(E12));
            }

            buy.amount = buy.amount.sub(tradedWei);
            if (buy.amount.isZero()) {
                buyIdx++;
            }

            sell.amount = sell.amount.sub(tradedTokens);
            if (sell.amount.isZero()) {
                sellIdx++;
            }

            gasEstimate = nextGasEstimate;
            nextGasEstimate += MATCH_MULTIPLE_ADDITIONAL_MATCH_GAS;
        }

        return { buyIds, sellIds, gasEstimate };
    }

    public calculateSimpleBuyMatches(
        n: number,
        orders: any[],
        direction: OrderDirection
    ): ISimpleMatchingOrders {
        let tokens: number = 0;
        let ethers: number = 0;
        const prices: any = { total: 0, list: [] };

        orders.forEach((item: any) => {
            let addedAmount: number = 0;
            if (tokens < n) {
                if (item.amount >= n + tokens) {
                    addedAmount = n;
                } else if (item.amount < n + tokens && n - tokens < item.amount) {
                    addedAmount = n - tokens;
                } else if (item.amount < n + tokens && n - tokens >= item.amount) {
                    addedAmount = item.amount;
                    ethers += item.ethers;
                }
                tokens += addedAmount;
                ethers += item.ethers * addedAmount / item.amount;
                prices.total += item.price * addedAmount;
                prices.list.push(item.price);
            }
        });


        const limitPrice: number = direction === OrderDirection.TOKEN_BUY ? Math.max(...prices.list) : Math.min(...prices.list);
        const averagePrice: number = parseFloat((prices.total / tokens).toFixed(3));

        tokens = parseFloat(tokens.toFixed(2));
        ethers = parseFloat(ethers.toFixed(5));

        return {
            tokens,
            ethers,
            limitPrice,
            averagePrice
        };
    }
}
