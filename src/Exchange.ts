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
import { Ratio, Tokens, Wei } from "./units";

export class OrderBook {
    public static compareBuyOrders(o1: IBuyOrder, o2: IBuyOrder): number {
        const cmp: number = o2.price.cmp(o1.price);
        return cmp !== 0 ? cmp : o1.id - o2.id;
    }

    public static compareSellOrders(o1: ISellOrder, o2: ISellOrder): number {
        const cmp: number = o1.price.cmp(o2.price);
        return cmp !== 0 ? cmp : o1.id - o2.id;
    }

    constructor(public buyOrders: IBuyOrder[], public sellOrders: ISellOrder[]) {
        buyOrders.sort(OrderBook.compareBuyOrders);
        sellOrders.sort(OrderBook.compareSellOrders);
    }

    /**
     * calculate matching pairs from ordered ordebook for sending in Exchange.matchMultipleOrders ethereum tx
     * @param  {Tokens} ethFiatRate current ETHFiat rate to use for calculation
     * @param  {number} gasLimit       return as many matches as it fits to gasLimit based on gas cost estimate.
     * @return {object}                pairs of matching order id , ordered by execution sequence { buyIds: [], sellIds: [], gasEstimate }
     */
    public getMatchingOrders(ethFiatRate: Tokens, gasLimit: number): IMatchingOrders {
        const sellIds: number[] = [];
        const buyIds: number[] = [];

        if (this.buyOrders.length === 0 || this.sellOrders.length === 0) {
            return { buyIds, sellIds, gasEstimate: 0 };
        }
        const lowestSellPrice: Ratio = this.sellOrders[0].price;
        const highestBuyPrice: Ratio = this.buyOrders[0].price;

        const clone = o => Object.assign({}, o);
        const buys: IBuyOrder[] = this.buyOrders.filter(o => o.price.gte(lowestSellPrice)).map(clone);

        const sells: ISellOrder[] = this.sellOrders.filter(o => o.price.lte(highestBuyPrice)).map(clone);

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
            const price: Ratio = buy.id > sell.id ? sell.price : buy.price;

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
}

export interface IMatchingOrders {
    buyIds: number[];
    sellIds: number[];
    gasEstimate: number;
}

export interface IOrder {
    id: number;
    maker: string;
    price: Ratio;
    amount: Tokens | Wei;
}

export interface IBuyOrder extends IOrder {
    amount: Wei;
}

export interface ISellOrder extends IOrder {
    amount: Tokens;
}

type IOrderTuple = [string, string, string, string]; /** result from contract: [id, maker, price, amount] */

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
// tslint:disable-next-line:max-classes-per-file
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
        const [buyOrders, sellOrders]: [IBuyOrder[], ISellOrder[]] = await Promise.all([
            this.getOrders(true, chunkSize) as Promise<IBuyOrder[]>,
            this.getOrders(false, chunkSize) as Promise<ISellOrder[]>
        ]);
        return new OrderBook(buyOrders, sellOrders);
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

    public placeSellTokenOrder(price: Ratio, amount: Tokens): Transaction {
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

    public placeBuyTokenOrder(price: Ratio, amount: Wei): Transaction {
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
        return result.reduce((res: IOrder[], order: IOrderTuple) => {
            const amount: BN = new BN(order[3]);
            if (!amount.isZero()) {
                res.push({
                    id: parseInt(order[0], 10),
                    maker: `0x${new BN(order[1]).toString(16).padStart(40, "0")}`, // leading 0s if address starts with 0
                    price: Ratio.parse(order[2]),
                    amount: buy ? new Wei(amount) : new Tokens(amount)
                });
            }
            return res;
        }, []);
    }
}
