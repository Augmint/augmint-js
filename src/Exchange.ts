import BigNumber from "bignumber.js";
import { Exchange as ExchangeInstance } from "../generated/index";
import { TransactionObject } from "../generated/types/types";
import { AbstractContract } from "./AbstractContract";
import { CHUNK_SIZE, LEGACY_CONTRACTS_CHUNK_SIZE, ONE_ETH_IN_WEI, PPM_DIV } from "./constants";
import { MATCH_MULTIPLE_ADDITIONAL_MATCH_GAS, MATCH_MULTIPLE_FIRST_MATCH_GAS } from "./gas";
import { Rates } from "./Rates";
import { Transaction } from "./Transaction";
import { EthereumConnection } from "./EthereumConnection";

export enum OrderDirection {
    TOKEN_BUY /** Buy order: orderDirection is 0 in contract */,
    TOKEN_SELL /** Sell order: orderDirection is 1 in contract */
}

export type ISellOrder = IGenericOrder;
export interface IBuyOrder extends IGenericOrder {
    bnEthAmount: BigNumber /** Buy order bnAmount in ETH */;
}

export interface IOrderBook {
    buyOrders: IBuyOrder[];
    sellOrders: ISellOrder[];
}

export interface IMatchingOrders {
    buyIds: number[];
    sellIds: number[];
    gasEstimate: number;
}

interface IGenericOrder {
    id: number;
    maker: string;
    direction: OrderDirection;
    bnAmount: BigNumber /** Buy order amount in Wei | Sell order amount in tokens, without decimals */;
    amount: number /** Buy order amount in ETH | Sell order amount in tokens with decimals */;
    bnPrice: BigNumber /** price in PPM (parts per million) | price in PPM (parts per million) */;
    price: number /** price with decimals */;
}

type IOrderTuple = [string, string, string, string]; /** result from contract: [id, maker, price, amount] */

interface IBuyOrderCalc extends IBuyOrder {
    bnTokenValue?: BigNumber;
}

interface ISellOrderCalc extends ISellOrder {
    bnEthValue?: BigNumber;
}

interface IExchangeOptions {
    peggedSymbol: Promise<string>;
    rates: Rates;
    decimalsDiv: Promise<number>;
    ONE_ETH_IN_WEI: number;
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
    private tokenPeggedSymbol: Promise<
        string
    >; /** fiat symbol this exchange is linked to (via Exchange.augmintToken) */
    private rates: Rates;
    private decimalsDiv: Promise<number>;
    private ONE_ETH_IN_WEI: number;
    private ethereumConnection: EthereumConnection;

    constructor(deployedContractInstance: ExchangeInstance, options: IExchangeOptions) {
        super(deployedContractInstance);
        this.instance = deployedContractInstance;
        this.ethereumConnection = options.ethereumConnection;
        this.web3 = this.ethereumConnection.web3;
        this.safeBlockGasLimit = this.ethereumConnection.safeBlockGasLimit;
        this.tokenPeggedSymbol = options.peggedSymbol;
        this.rates = options.rates;
        this.decimalsDiv = options.decimalsDiv;
        this.ONE_ETH_IN_WEI = options.ONE_ETH_IN_WEI;
    }

    /**
     * Fetches current OrderBook and returns as many matching orderIds (at current ETHFiat rate) as fits into the provided gas limit.
     *  if no gasLimit provided then ethereumConnection.safeBlockGasLimit is used
     * The returned matchingOrders can be passed to signAndSendMatchMultiple or matchMultiple functions
     * @param  {number}  [gasLimit=EthereumConnection.safeBlockGasLimit]   return as many matches as it fits to gasLimit based on gas cost estimate.
     * @return {Promise}            pairs of matching order id , ordered by execution sequence { buyIds: [], sellIds: [], gasEstimate }
     */
    public async getMatchingOrders(gasLimit: number = this.safeBlockGasLimit): Promise<IMatchingOrders> {
        const tokenPeggedSymbol = await this.tokenPeggedSymbol;
        const [orderBook, bnEthFiatRate]: [IOrderBook, BigNumber] = await Promise.all([
            this.getOrderBook(),
            this.rates.getBnEthFiatRate(tokenPeggedSymbol)
        ]);

        return this.calculateMatchingOrders(orderBook.buyOrders, orderBook.sellOrders, bnEthFiatRate, gasLimit);
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
        let buyOrders: IBuyOrder[] = [];
        let queryCount: number = Math.ceil(buyCount / LEGACY_CONTRACTS_CHUNK_SIZE);

        for (let i: number = 0; i < queryCount; i++) {
            const fetchedOrders: IOrderBook = await this.getOrders(OrderDirection.TOKEN_BUY, i * chunkSize);
            buyOrders = buyOrders.concat(fetchedOrders.buyOrders);
        }

        let sellOrders: ISellOrder[] = [];
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
        const decimalsDiv = await this.decimalsDiv;
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
                const bnAmount: BigNumber = new BigNumber(order[3]);
                if (!bnAmount.eq(0)) {
                    const bnPrice: BigNumber = new BigNumber(order[2]);
                    const amount: number =
                        orderDirection === OrderDirection.TOKEN_BUY
                            ? parseFloat(bnAmount.div(this.ONE_ETH_IN_WEI).toFixed(15))
                            : parseFloat(bnAmount.div(decimalsDiv).toFixed(2));
                    const parsed: IGenericOrder = {
                        id: parseInt(order[0], 10),
                        maker: `0x${new BigNumber(order[1]).toString(16).padStart(40, "0")}`, // leading 0s if address starts with 0
                        bnPrice,
                        bnAmount,
                        amount,
                        price: parseFloat(bnPrice.div(PPM_DIV).toString()),
                        direction: orderDirection
                    };

                    if (orderDirection === OrderDirection.TOKEN_BUY) {
                        const bnEthAmount: BigNumber = bnAmount.div(ONE_ETH_IN_WEI);
                        const buyOrder: IBuyOrder = { ...parsed, bnEthAmount };

                        res.buyOrders.push(buyOrder);
                    } else {
                        res.sellOrders.push(parsed as ISellOrder);
                    }
                }
                return res;
            },
            { buyOrders: [], sellOrders: [] }
        );

        return orders;
    }

    public isOrderBetter(o1: IGenericOrder, o2: IGenericOrder): number {
        if (o1.direction !== o2.direction) {
            throw new Error("isOrderBetter(): order directions must be the same" + o1 + o2);
        }

        const dir: number = o1.direction === OrderDirection.TOKEN_SELL ? 1 : -1;

        return o1.price * dir > o2.price * dir || (o1.price === o2.price && o1.id > o2.id) ? 1 : -1;
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
     * @param  {BigNumber} bnEthFiatRate current ETHFiat rate to use for calculation
     * @param  {number} gasLimit       return as many matches as it fits to gasLimit based on gas cost estimate.
     * @return {object}                pairs of matching order id , ordered by execution sequence { buyIds: [], sellIds: [], gasEstimate }
     */
    public calculateMatchingOrders(
        _buyOrders: IBuyOrder[],
        _sellOrders: ISellOrder[],
        bnEthFiatRate: BigNumber,
        gasLimit: number
    ): IMatchingOrders {
        const sellIds: number[] = [];
        const buyIds: number[] = [];

        if (_buyOrders.length === 0 || _sellOrders.length === 0) {
            return { buyIds, sellIds, gasEstimate: 0 };
        }
        const lowestSellPrice: BigNumber = _sellOrders[0].bnPrice;
        const highestBuyPrice: BigNumber = _buyOrders[0].bnPrice;

        const buyOrders: IBuyOrderCalc[] = _buyOrders
            .filter((o: IBuyOrder) => o.bnPrice.gte(lowestSellPrice))
            .map((o: IBuyOrderCalc) => o as IBuyOrderCalc);

        const sellOrders: ISellOrderCalc[] = _sellOrders
            .filter((o: ISellOrder) => o.bnPrice.lte(highestBuyPrice))
            .map((o: ISellOrderCalc) => o as ISellOrderCalc);

        let buyIdx: number = 0;
        let sellIdx: number = 0;
        let gasEstimate: number = 0;
        let nextGasEstimate: number = MATCH_MULTIPLE_FIRST_MATCH_GAS;

        while (buyIdx < buyOrders.length && sellIdx < sellOrders.length && nextGasEstimate <= gasLimit) {
            const sellOrder: ISellOrderCalc = sellOrders[sellIdx];
            const buyOrder: IBuyOrderCalc = buyOrders[buyIdx];
            sellIds.push(sellOrder.id);
            buyIds.push(buyOrder.id);

            let tradedEth: BigNumber;
            let tradedTokens: BigNumber;

            const bnMatchPrice: BigNumber = buyOrder.id > sellOrder.id ? sellOrder.bnPrice : buyOrder.bnPrice;

            buyOrder.bnTokenValue = bnEthFiatRate
                .mul(PPM_DIV)
                .div(bnMatchPrice)
                .mul(buyOrder.bnEthAmount)
                .round();

            sellOrder.bnEthValue = sellOrder.bnAmount
                .mul(bnMatchPrice)
                .div(bnEthFiatRate)
                .div(PPM_DIV);

            if (sellOrder.bnAmount.lt(buyOrder.bnTokenValue)) {
                tradedEth = sellOrder.bnEthValue;
                tradedTokens = sellOrder.bnAmount;
            } else {
                tradedEth = buyOrder.bnEthAmount;
                tradedTokens = buyOrder.bnTokenValue;
            }

            //     const DECIMALS_DIV = 100; // in order debug to work with tests (instead of this.augmintToken.decimalsDiv)
            //     console.debug(
            //         `MATCH:  BUY: id: ${buyOrder.id} bnPrice: ${buyOrder.bnPrice.div(PPM_DIV)}% Amount: ${
            //             buyOrder.bnEthAmount
            //         } ETH tokenValue: ${buyOrder.bnTokenValue.div(DECIMALS_DIV)}
            // SELL: id: ${sellOrder.id} bnPrice: ${sellOrder.bnPrice.div(PPM_DIV)}% Amount: ${sellOrder.bnAmount.div(
            //             DECIMALS_DIV
            //         )} AEUR  ethValue: ${sellOrder.bnEthValue}
            // Traded: ${tradedEth.toString()} ETH <-> ${tradedTokens.div(DECIMALS_DIV)} AEUR @${bnMatchPrice.div(
            //             PPM_DIV
            //         )}% on ${bnEthFiatRate.div(DECIMALS_DIV)} ETHEUR`
            //     );

            buyOrder.bnEthAmount = buyOrder.bnEthAmount.sub(tradedEth);
            buyOrder.bnTokenValue = buyOrder.bnTokenValue.sub(tradedTokens);

            if (buyOrder.bnEthAmount.eq(0)) {
                buyIdx++;
            }

            sellOrder.bnEthValue = sellOrder.bnEthValue.sub(tradedEth);
            sellOrder.bnAmount = sellOrder.bnAmount.sub(tradedTokens);
            if (sellOrder.bnAmount.eq(0)) {
                sellIdx++;
            }

            gasEstimate = nextGasEstimate;
            nextGasEstimate += MATCH_MULTIPLE_ADDITIONAL_MATCH_GAS;
        }

        return { buyIds, sellIds, gasEstimate };
    }
}
