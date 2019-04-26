import BigNumber from "bignumber.js";
import { Rates as RatesInstance } from "../abiniser/index";
import { TransactionObject } from "../abiniser/types/types";
import { ZeroRateError } from "./Errors";
import { Augmint } from "./Augmint";

export interface IRateInfo {
    bnRate: BigNumber /** The rate without decimals */;
    rate: number /** rate with token decimals */;
    lastUpdated: Date;
}

export class Rates {
    // overwrite Contract's  property to have typings
    public instance: RatesInstance; /** web3.js Rates contract instance  */
    private augmint: Augmint;

    constructor(instance: RatesInstance, augmint: Augmint) {
        this.instance = instance;
        this.augmint = augmint;
    }

    public async getBnEthFiatRate(currency: string): Promise<BigNumber> {
        const rate: string = await this.instance.methods
            .convertFromWei(this.augmint.web3.utils.asciiToHex(currency), Augmint.constants.ONE_ETH_IN_WEI.toString())
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
        return parseFloat(bnEthFiatRate.div(Augmint.constants.DECIMALS_DIV).toFixed(Augmint.constants.DECIMALS));
    }

    public async getAugmintRate(currency: string): Promise<IRateInfo> {
        const decimalsDiv = await this.augmint.token.decimalsDiv;
        const bytesCCY: string = this.augmint.web3.utils.asciiToHex(currency);
        const storedRateInfo: { rate: string; lastUpdated: string } = await this.instance.methods
            .rates(bytesCCY)
            .call();

        return {
            bnRate: new BigNumber(storedRateInfo.rate),
            rate: parseInt(storedRateInfo.rate) / decimalsDiv, // TODO: change to augmintToken.decimalsDiv
            lastUpdated: new Date(parseInt(storedRateInfo.lastUpdated) * 1000)
        };
    }

    public async getSetRateTx(currency: string, price: number): Promise<TransactionObject<void>> {
        const decimals = await this.augmint.token.decimals;
        const decimalsDiv = await this.augmint.token.decimalsDiv;
        const rateToSend: number = price * decimalsDiv;
        if (Math.round(rateToSend) !== rateToSend) {
            throw new Error(
                ` getSetRateTx error: provided price of ${price} has more decimals than allowed by AugmintToken decimals of ${decimals}`
            );
        }
        const bytesCCY: string = this.augmint.web3.utils.asciiToHex(currency);
        const tx: TransactionObject<void> = this.instance.methods.setRate(bytesCCY, rateToSend);

        return tx;
    }
}
