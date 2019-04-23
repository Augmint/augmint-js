import BigNumber from "bignumber.js";
import * as RatesAbi from "../abiniser/abis/Rates_ABI_73a17ebb0acc71773371c6a8e1c8e6ce.json";
import { Rates_ABI_73a17ebb0acc71773371c6a8e1c8e6ce as RatesContract } from "../abiniser/types/Rates_ABI_73a17ebb0acc71773371c6a8e1c8e6ce";
import { TransactionObject } from "../abiniser/types/types.js";
import { DECIMALS, DECIMALS_DIV, ONE_ETH_IN_WEI } from "./constants";
import { Contract } from "./Contract";
import { ZeroRateError } from "./Errors";
import { EthereumConnection } from "./EthereumConnection";

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

    public getSetRateTx(currency: string, price: number): TransactionObject<void> {
        const rateToSend: number = price * DECIMALS_DIV;
        if (Math.round(rateToSend) !== rateToSend) {
            throw new Error(
                ` getSetRateTx error: provided price of ${price} has more decimals than allowed by AugmintToken decimals of ${DECIMALS}`
            );
        }
        const bytesCCY: string = this.web3.utils.asciiToHex(currency);
        const tx: TransactionObject<void> = this.instance.methods.setRate(bytesCCY, rateToSend);

        return tx;
    }

    public async connect(ethereumConnection: EthereumConnection): Promise<any> {
        return await super.connect(ethereumConnection, RatesAbi);
    }
}
