import { EthereumConnection } from "./EthereumConnection";
import { Contract } from "./Contract";
import { AugmintToken } from "./AugmintToken";
import { CHUNK_SIZE, OrderDirection, LEGACY_CONTRACTS_CHUNK_SIZE, ONE_ETH_IN_WEI, PPM_DIV } from "./constants";
import { Rates } from "./Rates";
import BigNumber from "bignumber.js";
import { MATCH_MULTIPLE_ADDITIONAL_MATCH_GAS, MATCH_MULTIPLE_FIRST_MATCH_GAS } from "./gas";

const ExchangeArtifact = require("../abiniser/abis/Exchange_ABI_d3e7f8a261b756f9c40da097608b21cd.json");

interface Parsed {
    id: number;
    maker: string;
    bn_price: BigNumber;
    bn_amount;
    price: BigNumber;
    direction: OrderDirection;
    bn_ethAmount: BigNumber;
    amount: number;
}

/**
 * Augmint Exchange contract class
 * @class Exchange
 * @extends Contract
 */
export class Exchange extends Contract {
    rates: Rates;
    augmintToken: AugmintToken;
    tokenPeggedSymbol: string; /** fiat symbol this exchange is linked to (via Exchange.augmintToken) */
    tokenSymbol: string; /** token symbol this exchange contract instance is linked to  */
    constructor() {
        super();
    }

    async connect(ethereumConnection: EthereumConnection, exchangeAddress: string) {
        await super.connect(ethereumConnection, ExchangeArtifact, exchangeAddress);

        this.rates = new Rates();
        await this.rates.connect(this.ethereumConnection);

        const [tokenAddressAtExchange, ratesAddressAtExchange] = await Promise.all([
            this.instance.methods.augmintToken().call(),
            this.instance.methods.rates().call()
        ]);

        if (ratesAddressAtExchange !== this.rates.address) {
            throw new Error(
                `Exchange: latest Rates contract deployment address ${
                    this.rates.address
                } for provided ABI doesn't match rates contract address ${ratesAddressAtExchange} at deployed Exchange contract`
            );
        }

        this.augmintToken = new AugmintToken();
        await this.augmintToken.connect(this.ethereumConnection);

        if (tokenAddressAtExchange !== this.augmintToken.address) {
            throw new Error(
                `Exchange: latest AugmintToken contract deployment address at ${
                    this.augmintToken.address
                }  doesn't match AugmintToken contract address set at latest deployed Exchange contract: ${tokenAddressAtExchange}.
                Connecting to legacy Exchanges is not supported yet`
            );
        }

        this.tokenPeggedSymbol = this.augmintToken.peggedSymbol;
        this.tokenSymbol = this.augmintToken.symbol;

        return this.instance;
    }

    /**
     * Fetches current OrderBook and returns as many matching orderIds (at current ETHFiat rate) as fits into the provided gas limit.
     *  if no gasLimit provided then ethereumConnection.safeBlockGasLimit is used
     * The returned matchingOrders can be passed to signAndSendMatchMultiple or matchMultiple functions
     * @param  {number}  [gasLimit=EthereumConnection.safeBlockGasLimit]   return as many matches as it fits to gasLimit based on gas cost estimate.
     * @return {Promise}            pairs of matching order id , ordered by execution sequence
                                   { buyIds: [], sellIds: [], gasEstimate }
     */
    async getMatchingOrders(gasLimit = this.ethereumConnection.safeBlockGasLimit) {
        const [orderBook, bn_ethFiatRate] = await Promise.all([
            this.fetchOrderBook(),
            this.rates.getBnEthFiatRate(this.tokenPeggedSymbol)
        ]);

        const matches = this.calculateMatchingOrders(
            orderBook.buyOrders,
            orderBook.sellOrders,
            bn_ethFiatRate,
            gasLimit
        );

        return matches;
    }

    /**
     * Fetches, parses and orders the current, full orderBook from Exchange
     * @return {Promise} the current, ordered orderBook in the format of:
     *                  { buyOrders: [{id, maker, direction, bn_amount (in Wei), bn_ethAmount, amount (in eth), bn_price (in PPM)],
     *                  sellOrders: [{id, maker, direction, bn_amount (without decimals), amount (in AEUR), bn_price (in PPM)}]
     */
    async fetchOrderBook() {
        // TODO: handle when order changes while iterating
        const isLegacyExchangeContract = typeof this.instance.methods.CHUNK_SIZE === "function";
        const chunkSize = isLegacyExchangeContract ? LEGACY_CONTRACTS_CHUNK_SIZE : CHUNK_SIZE;

        const orderCounts = await this.instance.methods.getActiveOrderCounts().call({ gas: 4000000 });
        const buyCount = parseInt(orderCounts.buyTokenOrderCount, 10);
        const sellCount = parseInt(orderCounts.sellTokenOrderCount, 10);

        // retreive all orders
        let buyOrders = [];
        let queryCount = Math.ceil(buyCount / LEGACY_CONTRACTS_CHUNK_SIZE);

        for (let i = 0; i < queryCount; i++) {
            const fetchedOrders = await this.getOrders(OrderDirection.TOKEN_BUY, i * chunkSize);
            buyOrders = buyOrders.concat(fetchedOrders.buyOrders);
        }

        let sellOrders = [];
        queryCount = Math.ceil(sellCount / chunkSize);
        for (let i = 0; i < queryCount; i++) {
            const fetchedOrders = await this.getOrders(OrderDirection.TOKEN_SELL, i * chunkSize);
            sellOrders = sellOrders.concat(fetchedOrders.sellOrders);
        }

        buyOrders.sort(this.isOrderBetter);
        sellOrders.sort(this.isOrderBetter);

        return { buyOrders, sellOrders };
    }

    async getOrders(orderDirection: OrderDirection, offset) {
        const blockGasLimit = this.ethereumConnection.safeGasLimit;

        const isLegacyExchangeContract = typeof this.instance.methods.CHUNK_SIZE === "function";
        const chunkSize = isLegacyExchangeContract ? LEGACY_CONTRACTS_CHUNK_SIZE : CHUNK_SIZE;

        let result;
        if (orderDirection === OrderDirection.TOKEN_BUY) {
            result = isLegacyExchangeContract
                ? await this.instance.methods.getActiveBuyOrders(offset).call({ gas: blockGasLimit })
                : await this.instance.methods.getActiveBuyOrders(offset, chunkSize).call({ gas: blockGasLimit });
        } else {
            result = isLegacyExchangeContract
                ? await this.instance.methods.getActiveSellOrders(offset).call({ gas: blockGasLimit })
                : await this.instance.methods.getActiveSellOrders(offset, chunkSize).call({ gas: blockGasLimit });
        }

        // result format: [id, maker, price, amount]
        const orders = result.reduce(
            (res, order) => {
                const bn_amount = new BigNumber(order[3]);
                if (!bn_amount.eq(0)) {
                    const parsed: Parsed = {
                        id: parseInt(order[0], 10),
                        maker: `0x${new BigNumber(order[1]).toString(16).padStart(40, "0")}`, // leading 0s if address starts with 0
                        bn_price: new BigNumber(order[2]),
                        bn_amount,
                        price: new BigNumber(0),
                        direction: 0,
                        bn_ethAmount: new BigNumber(0),
                        amount: 0
                    };

                    parsed.price = parsed.bn_price.div(PPM_DIV);

                    if (orderDirection === OrderDirection.TOKEN_BUY) {
                        parsed.direction = OrderDirection.TOKEN_BUY;
                        parsed.bn_ethAmount = parsed.bn_amount.div(ONE_ETH_IN_WEI);
                        parsed.amount = parseFloat(parsed.bn_ethAmount.toString(10));

                        res.buyOrders.push(parsed);
                    } else {
                        parsed.direction = OrderDirection.TOKEN_SELL;
                        parsed.amount = parseFloat((parsed.bn_amount / this.augmintToken.decimalsDiv).toFixed(2));

                        res.sellOrders.push(parsed);
                    }
                }
                return res;
            },
            { buyOrders: [], sellOrders: [] }
        );

        return orders;
    }

    isOrderBetter(o1, o2) {
        if (o1.direction !== o2.direction) {
            throw new Error("isOrderBetter(): order directions must be the same" + o1 + o2);
        }

        const dir = o1.direction === OrderDirection.TOKEN_SELL ? 1 : -1;

        return o1.price * dir > o2.price * dir || (o1.price === o2.price && o1.id > o2.id) ? 1 : -1;
    }

    /**
     * Sends a matchMultipleOrders transaction
     * Intended to use when account wallet is available (e.g. MetamMask)  * @param {string} account    tx sender account
     * @param {string} account    tx sender account
     * @param  {*} matchingOrders
     * @returns {Promise}     A web3.js Promi event object sent to the network. Resolves when mined and you can subscribe to events, eg. .on("confirmation")
     * @memberof Exchange
     */
    async matchMultipleOrders(account, matchingOrders) {
        const matchMultipleOrdersTx = this.getMatchMultipleOrdersTx(matchingOrders.buyIds, matchingOrders.sellIds);

        return matchMultipleOrdersTx.send({
            from: account,
            gas: matchingOrders.gasEstimate
        });
    }

    /**
     * Signs a matchMultipleOrders transaction with a private key and sends it (with web3.js sendSignedTransaction)     *
     * Intended to use when private key is available, e.g. backend services
     * @param  {string} account     tx signer ethereum account
     * @param  {string} privateKey  Private key of the Ethereum account to sign the tx with. Include leading 0x
     * @param  {object} matchingOrders    Returned by getMatchingOrders in format of {buyIds:[], sellIds: [], gasEstimate}
     * @return {Promise}           A web3.js Promi event object sent to the network. Resolves when mined and you can subscribe to events, eg. .on("confirmation")
     * @memberof Exchange
     */
    async signAndSendMatchMultipleOrders(account, privateKey, matchingOrders) {
        const matchMultipleOrdersTx = this.getMatchMultipleOrdersTx(matchingOrders.buyIds, matchingOrders.sellIds);

        const encodedABI = matchMultipleOrdersTx.encodeABI();

        const txToSign = {
            from: account,
            to: this.address,
            gasLimit: matchingOrders.gasEstimate,
            data: encodedABI
        };

        const signedTx = await this.web3.eth.accounts.signTransaction(txToSign, privateKey);

        return this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    }

    /**
     * Returns a web3 transaction to match the passed buyIds and sellIds. Call .send() or sign it on the returned tx.
     * @param  {array} buyIds   array with a list of BUY order IDs (ordered)
     * @param  {array} sellIds  array with a list of SELL order IDs (ordered)
     * @return {Promise}         web3 transaction which can be executed with .send({account, gas})
     * @memberof Exchange
     */
    getMatchMultipleOrdersTx(buyIds, sellIds) {
        if (sellIds.length === 0 || sellIds.length !== buyIds.length) {
            throw new Error("invalid buyIds/sellIds recevied - no ids or the the params are not equal.");
        }

        const tx = this.instance.methods.matchMultipleOrders(buyIds, sellIds);

        return tx;
    }

    /**
     * calculate matching pairs from ordered ordebook for sending in Exchange.matchMultipleOrders ethereum tx
     * @param  {object} _buyOrders     must be ordered by price descending then by id ascending
     * @param  {array} _sellOrders    must be ordered by price ascending then by id ascending
     * @param  {BigNumber} bn_ethFiatRate current ETHFiat rate to use for calculation
     * @param  {number} gasLimit       return as many matches as it fits to gasLimit based on gas cost estimate.
     * @return {object}                pairs of matching order id , ordered by execution sequence { buyIds: [], sellIds: [], gasEstimate }
     */
    calculateMatchingOrders(_buyOrders, _sellOrders, bn_ethFiatRate, gasLimit) {
        const sellIds: Array<string> = [];
        const buyIds: Array<string> = [];

        if (_buyOrders.length === 0 || _sellOrders.length === 0) {
            return { buyIds, sellIds, gasEstimate: 0 };
        }
        const lowestSellPrice = _sellOrders[0].price;
        const highestBuyPrice = _buyOrders[0].price;

        const buyOrders = _buyOrders
            .filter(o => o.price >= lowestSellPrice)
            .map(o => ({ id: o.id, price: o.price, bn_ethAmount: o.bn_ethAmount }));
        const sellOrders = _sellOrders
            .filter(o => o.price <= highestBuyPrice)
            .map(o => ({
                id: o.id,
                price: o.price,
                bn_tokenAmount: new BigNumber(o.amount)
            }));

        let buyIdx = 0;
        let sellIdx = 0;
        let gasEstimate = 0;
        let nextGasEstimate = MATCH_MULTIPLE_FIRST_MATCH_GAS;

        while (buyIdx < buyOrders.length && sellIdx < sellOrders.length && nextGasEstimate <= gasLimit) {
            const sellOrder = sellOrders[sellIdx];
            const buyOrder = buyOrders[buyIdx];
            sellIds.push(sellOrder.id);
            const { id } = buyOrder;
            buyIds.push(id);

            let tradedEth;
            let tradedTokens;

            const matchPrice = buyOrder.id > sellOrder.id ? sellOrder.price : buyOrder.price;

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
            } else {
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
            nextGasEstimate += MATCH_MULTIPLE_ADDITIONAL_MATCH_GAS;
        }

        return { buyIds, sellIds, gasEstimate };
    }
}
