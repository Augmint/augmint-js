import BN from "bn.js";
import { Wei, Tokens, Percent } from "./units";
import { Exchange as ExchangeInstance } from "../generated/index";
import { TransactionObject } from "../generated/types/types";
import { AbstractContract } from "./AbstractContract";
import { AugmintToken } from "./AugmintToken";
import { CHUNK_SIZE, LEGACY_CONTRACTS_CHUNK_SIZE } from "./constants";
import { EthereumConnection } from "./EthereumConnection";
import { MATCH_MULTIPLE_ADDITIONAL_MATCH_GAS, MATCH_MULTIPLE_FIRST_MATCH_GAS, PLACE_ORDER_GAS } from "./gas";
import { Rates } from "./Rates";
import { Transaction } from "./Transaction";
import {IBuyOrder} from "../dist/src/Exchange";
import {doc} from "prettier";
import fill = doc.builders.fill;

interface ISimpleBuyData {
    tokens: Tokens;
    ethers: Wei;
    limitPrice: Percent;
    averagePrice: Percent;
}

export class OrderBook {
    constructor (
        public buyOrders: IBuyOrder[],
        public sellOrders: ISellOrder[]
    ) {
        buyOrders.sort(OrderBook.compareBuyOrders);
        sellOrders.sort(OrderBook.compareSellOrders);
    }

    public static compareBuyOrders(o1: IBuyOrder, o2: IBuyOrder): number {
        const cmp = o2.price.cmp(o1.price);
        return cmp !== 0 ? cmp : o1.id - o2.id;
    }

    public static compareSellOrders(o1: ISellOrder, o2: ISellOrder): number {
        const cmp = o1.price.cmp(o2.price);
        return cmp !== 0 ? cmp : o1.id - o2.id;
    }

    public static minTokens(t1: Tokens, t2: Tokens): Tokens {
        const comp = t1.cmp(t2);
        console.log(comp);
        return Tokens.of(0);
    }

    public getBuySellOrders() : {buys: IBuyOrder[], sells: ISellOrder[]} {
        const lowestSellPrice: Percent = this.sellOrders[0].price;
        const highestBuyPrice: Percent = this.buyOrders[0].price;

        const clone = o => Object.assign({}, o);
        const buys: IBuyOrder[] = this.buyOrders
            .filter(o => o.price.gte(lowestSellPrice)).map(clone);

        const sells: ISellOrder[] = this.sellOrders
            .filter(o => o.price.lte(highestBuyPrice)).map(clone);

        return {
            buys,
            sells,
        }
    }

    /**
     * calculate matching pairs from ordered ordebook for sending in Exchange.matchMultipleOrders ethereum tx
     * @param  {Tokens} ethFiatRate current ETHFiat rate to use for calculation
     * @param  {number} gasLimit       return as many matches as it fits to gasLimit based on gas cost estimate.
     * @return {object}                pairs of matching order id , ordered by execution sequence { buyIds: [], sellIds: [], gasEstimate }
     */
    public getMatchingOrders(
        ethFiatRate: Tokens,
        gasLimit: number
    ): IMatchingOrders {
        const sellIds: number[] = [];
        const buyIds: number[] = [];

        if (this.buyOrders.length === 0 || this.sellOrders.length === 0) {
            return { buyIds, sellIds, gasEstimate: 0 };
        }

        const {buys, sells} = this.getBuySellOrders();

        let buyIdx: number = 0;
        let sellIdx: number = 0;
        let gasEstimate: number = 0;
        let nextGasEstimate: number = MATCH_MULTIPLE_FIRST_MATCH_GAS;

        while (buyIdx < buys.length && sellIdx < sells.length && nextGasEstimate <= gasLimit) {

            const sell: ISellOrder = sells[sellIdx];
            const buy: IBuyOrder = buys[buyIdx];
            sellIds.push(sell.id);
            buyIds.push(buy.id);

            // matching logic follows smart contract _fillOrder implementation
            // see https://github.com/Augmint/augmint-contracts/blob/staging/contracts/Exchange.sol
            const price: Percent = buy.id > sell.id ? sell.price : buy.price;

            const sellWei: Wei = sell.amount.toWeiAt(ethFiatRate, price);

            let tradedWei: Wei;
            let tradedTokens: Tokens;
            if (sellWei.lte(buy.amount)) {
                tradedWei = sellWei;
                tradedTokens = sell.amount;
            } else {
                tradedWei = buy.amount;
                tradedTokens = tradedWei.toTokensAt(ethFiatRate, price);
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

    public estimateSimpleBuy(tokens: Tokens, ethFiatRate: Tokens): ISimpleBuyData {
        let remainingTokens: Tokens = tokens;
        let filledEthers: Wei = Wei.of(0);
        let lastPrice: Percent = Percent.of(0);

        for (let i = 0; i <= this.sellOrders.length; i++) {
            const order: ISellOrder = this.sellOrders[i];
            if (remainingTokens.isZero()) {
                break;
            } else {
                const boughtTokens: Tokens = OrderBook.minTokens(remainingTokens, order.amount);
                const spentEthers: Wei = boughtTokens.toWeiAt(ethFiatRate, order.price);
                remainingTokens = remainingTokens.sub(boughtTokens);
                filledEthers = filledEthers.add(spentEthers);
                lastPrice = order.price
            }
        }
        const totalBoughtTokens: Tokens = tokens.sub(remainingTokens);
        // const averagePrice = filledEthers.div(totalBoughtTokens);
        return {
            tokens: totalBoughtTokens,
            ethers: filledEthers,
            limitPrice: lastPrice,
            // averagePrice
        };
    }

    public estimateSimpleSell(tokens: Tokens, ethFiatRate: Tokens): ISimpleBuyData {
        let remainingTokens: Tokens = tokens;
        let filledEthers: Wei = Wei.of(0);
        let lastPrice: Percent = Percent.of(0);

        for (let i = 0; i <= this.buyOrders.length; i++) {
            const order: IBuyOrder = this.buyOrders[i];

            if (remainingTokens.isZero()) {
                break;
            } else {
                const orderTokens: Tokens = order.amount.toTokensAt(ethFiatRate, order.price);
                const soldTokens: Tokens = OrderBook.minTokens(remainingTokens, orderTokens);
                const spentEthers: Wei = soldTokens.toWeiAt(ethFiatRate, order.price);
                remainingTokens = remainingTokens.sub(soldTokens);
                filledEthers = filledEthers.add(spentEthers);
                lastPrice = order.price
            }
        }
        const totalBoughtTokens: Tokens = tokens.sub(remainingTokens);
        // const averagePrice = filledEthers.div(totalBoughtTokens);
        return {
            tokens: totalBoughtTokens,
            ethers: filledEthers,
            limitPrice: lastPrice,
            // averagePrice
        };
    }

    /**
     * calculate price for n amount of token to sell or buy
     * @param  {amount} amount of token to sell or buy
     * @param  {buy} buyOrders or sellOrders
     * @return {object} simple buy data { tokens, ethers, limitPrice, averagePrice }
     */

//     public calculateSimpleBuyData(tokenAmount: Tokens, buy: boolean, ethFiatRate: Tokens): ISimpleBuyData {
//         let filledTokens: Tokens = Tokens.of(0);
//         let filledEthers: Wei = Wei.of(0);
//         const prices: any = { total: new Percent(0), list: [] };
//
//         const orders = buy ? this.buyOrders : this.sellOrders;
//
//         orders.forEach(order => {
//             let orderEthers;
//             let orderTokens;
//             if (buy) {
//                 const o = order as IBuyOrder;
//                 orderEthers = o.amount;
//                 orderTokens = order.amount.toTokensAt(ethFiatRate, order.price);
//             } else {
//                 const o = order as ISellOrder;
//                 orderEthers = o.amount.toWeiAt(ethFiatRate, order.price);
//                 orderTokens = o.amount;
//             }
//
//
//             let addedAmount: Tokens = Tokens.of(0);
//             if (filledTokens.lt(tokenAmount)) {
//                 if (order.amount.gte(tokenAmount.add(filledTokens))) {
//                     addedAmount = tokenAmount;
//                 } else if (order.amount.lt(tokenAmount.add(filledTokens)) && tokenAmount.sub(filledTokens).lt(item.amount)) {
//                     addedAmount = tokenAmount.sub(filledTokens);
//                 } else if (order.amount.lt(tokenAmount.add(filledTokens)) && tokenAmount.sub(filledTokens).gte(item.amount)) {
//                     addedAmount = order.amount;
//                     ethers = ethers.add(order.ethers);
//                 }
//                 // tokens += addedAmount;
//                 // ethers += item.ethers * addedAmount / item.amount;
//                 // prices.total += item.price * addedAmount;
//                 // prices.list.push(item.price);
//                 filledTokens = filledTokens.add(addedAmount);
//                 filledEthers = filledEthers.add(item.ethers.mul());
//                 prices.total = prices.total.add(item.price.mult(Percent.of(addedAmount.toNumber())));
//                 prices.list.push(item.price.toNumber());
//             }
//         });
//
//         const limit: number = buy ? Math.max(...prices.list) : Math.min(...prices.list);
//         const limitPrice: Percent = Percent.of(limit);
//         const averagePrice: Percent = prices.total.div(Percent.of(tokens.toNumber()));
//
//         return {
//             filledTokens,
//             filledEthers,
//             limitPrice,
//             averagePrice
//         };
//     }
}

export interface IMatchingOrders {
    buyIds: number[];
    sellIds: number[];
    gasEstimate: number;
}

export interface IOrder {
    id: number;
    maker: string;
    price: Percent;
    amount: Tokens | Wei;
}

export interface IBuyOrder extends IOrder {
    amount: Wei
}

export interface ISellOrder extends IOrder {
    amount: Tokens
}

type IOrderTuple = [string, string, string, string];

/** result from contract: [id, maker, price, amount] */

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
        const [orderBook, ethFiatRate]: [OrderBook, Tokens] = await Promise.all([
            this.getOrderBook(),
            this.rates.getEthFiatRate(tokenPeggedSymbol)
        ]);

        return orderBook.getMatchingOrders(ethFiatRate, gasLimit);
    }

    /**
     * Fetches, parses and orders the current, full orderBook from Exchange
     *
     * @returns {Promise<OrderBook>}   the current, ordered orderBook
     * @memberof Exchange
     */
    public async getOrderBook(): Promise<OrderBook> {
        // TODO: handle when order changes while iterating
        // @ts-ignore  TODO: remove ts - ignore and handle properly when legacy contract support added
        const isLegacyExchangeContract: boolean = typeof this.instance.methods.CHUNK_SIZE === "function";
        const chunkSize: number = isLegacyExchangeContract ? LEGACY_CONTRACTS_CHUNK_SIZE : CHUNK_SIZE;
        const [buyOrders, sellOrders] = await Promise.all([
            this.getOrders(true, chunkSize) as Promise<IBuyOrder[]>,
            this.getOrders(false, chunkSize) as Promise<ISellOrder[]>
        ]);
        return new OrderBook(buyOrders, sellOrders);
    }

    private async getOrders(buy: boolean, chunkSize: number): Promise<IOrder[]> {
        const orders: IOrder[] = [];
        let i: number = 0;
        let fetched: IOrder[];
        do {
            fetched = await this.getOrdersChunk(buy, i * chunkSize);
            orders.push(...fetched);
            i += chunkSize;
        } while (fetched.length === chunkSize);
        return orders;
    }

    private async getOrdersChunk(buy: boolean, offset: number): Promise<IOrder[]> {
        const blockGasLimit: number = this.safeBlockGasLimit;
        // @ts-ignore  TODO: remove ts-ignore and handle properly when legacy contract support added
        const isLegacyExchangeContract: boolean = typeof this.instance.methods.CHUNK_SIZE === "function";
        const chunkSize: number = isLegacyExchangeContract ? LEGACY_CONTRACTS_CHUNK_SIZE : CHUNK_SIZE;

        let result: IOrderTuple[];
        if (buy) {
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
        return result.reduce(
            (res: IOrder[], order: IOrderTuple) => {
                const amount: BN = new BN(order[3]);
                if (!amount.isZero()) {
                    res.push({
                        id: parseInt(order[0], 10),
                        maker: `0x${new BN(order[1]).toString(16).padStart(40, "0")}`, // leading 0s if address starts with 0
                        price: Percent.parse(order[2]),
                        amount: buy ? new Wei(amount) : new Tokens(amount)
                    });
                }
                return res;
            },
            []
        );
    }

    public placeSellTokenOrder(price: Percent, amount: Tokens): Transaction {
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

    public placeBuyTokenOrder(price: Percent, amount: Wei): Transaction {
        const web3Tx: TransactionObject<string> = this.instance.methods.placeBuyTokenOrder(price.toString());

        const transaction: Transaction = new Transaction(this.ethereumConnection, web3Tx, {
            gasLimit: PLACE_ORDER_GAS,
            to: this.address,
            value: amount
        });

        return transaction;
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

    static get OrderBook(): typeof OrderBook {
        return OrderBook;
    }
}
