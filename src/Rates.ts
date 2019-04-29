import BigNumber from "bignumber.js";
import * as RatesAbi from "../abiniser/abis/Rates_ABI_73a17ebb0acc71773371c6a8e1c8e6ce.json";
import { Rates_ABI_73a17ebb0acc71773371c6a8e1c8e6ce as RatesContract } from "../abiniser/types/Rates_ABI_73a17ebb0acc71773371c6a8e1c8e6ce";
import { TransactionObject } from "../abiniser/types/types.js";
import { DECIMALS, DECIMALS_DIV, ONE_ETH_IN_WEI } from "./constants";
import { Contract } from "./Contract";
import { InvalidPriceError, ZeroRateError } from "./Errors";
import { EthereumConnection } from "./EthereumConnection";
import { SET_RATE_GAS_LIMIT } from "./gas";
import { Transaction } from "./Transaction";

export interface IRateInfo {
    bnRate: BigNumber /** The rate without decimals */;
    rate: number /** rate with token decimals */;
    lastUpdated: Date;
}

export class Rates extends Contract {
    // overwrite Contract's  property to have typings
    public instance: RatesContract; /** web3.js Rates contract instance  */

    constructor() {
        super();
    }

    public async getBnEthFiatRate(currency: string): Promise<BigNumber> {
        const rate: string = await this.instance.methods
            .convertFromWei(this.web3.utils.asciiToHex(currency), ONE_ETH_IN_WEI.toString())
            .call()
            .catch((error: Error) => {
                if (error.message.includes("revert rates[bSymbol] must be > 0")) {
                    throw new ZeroRateError(
                        `getBnEthFiatRate returned zero rate for currency: ${currency}. Is it supported and has rate set in Rates contract?`
                    );
                } else {
                    throw error;
                }
            });

        return new BigNumber(rate);
    }

    public async getEthFiatRate(currency: string): Promise<number> {
        const bnEthFiatRate: BigNumber = await this.getBnEthFiatRate(currency);
        return parseFloat(bnEthFiatRate.div(DECIMALS_DIV).toFixed(DECIMALS));
    }

    public async getAugmintRate(currency: string): Promise<IRateInfo> {
        const bytesCCY: string = this.web3.utils.asciiToHex(currency);
        const storedRateInfo: { rate: string; lastUpdated: string } = await this.instance.methods
            .rates(bytesCCY)
            .call();

        return {
            bnRate: new BigNumber(storedRateInfo.rate),
            rate: parseInt(storedRateInfo.rate) / DECIMALS_DIV, // TODO: change to augmintToken.decimalsDiv
            lastUpdated: new Date(parseInt(storedRateInfo.lastUpdated) * 1000)
        };
    }

    public setRate(currency: string, price: number): Transaction {
        const rateToSend: number = price * DECIMALS_DIV;

        if (Math.round(rateToSend) !== rateToSend) {
            throw new InvalidPriceError(
                ` getSetRateTx error: provided price of ${price} has more decimals than allowed by AugmintToken decimals of ${DECIMALS}`
            );
        }

        const bytesCCY: string = this.web3.utils.asciiToHex(currency);

        const web3Tx: TransactionObject<void> = this.instance.methods.setRate(bytesCCY, rateToSend);
        const transaction: Transaction = new Transaction(this.ethereumConnection, web3Tx, {
            gasLimit: SET_RATE_GAS_LIMIT,
            // setting to: in case it's going to be signed
            // NB: signing/sending this particular tx works without it somehow
            // but others are throwing unhandled rejection errors (web3 beta36) so setting a good example
            to: this.address
        });

        return transaction;
    }

    public async connect(ethereumConnection: EthereumConnection): Promise<any> {
        return await super.connect(ethereumConnection, RatesAbi);
    }
}
