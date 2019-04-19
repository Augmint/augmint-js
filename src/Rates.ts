import { Contract } from "./Contract";
import { DECIMALS, DECIMALS_DIV, ONE_ETH_IN_WEI } from "./constants";
import BigNumber from "bignumber.js";
import * as RatesArtifact from "../abiniser/abis/Rates_ABI_73a17ebb0acc71773371c6a8e1c8e6ce.json";
import { ZeroRateError, AugmintJsError } from "./Errors";
import { EthereumConnection } from "./EthereumConnection";

export class Rates extends Contract {
    constructor() {
        super();
    }

    public async getBnEthFiatRate(currency: string): Promise<any> {
        const rate = await this.instance.methods
            .convertFromWei(this.web3.utils.asciiToHex(currency), ONE_ETH_IN_WEI.toString())
            .call()
            .catch(error => {
                if (error.message.includes("revert rates[bSymbol] must be > 0")) {
                    throw new ZeroRateError(
                        `getBnEthFiatRate returned zero rate for currency: ${currency}. Is it supported and has rate set in Rates contract?`
                    );
                } else {
                    throw error;
                }
            });

        return new BigNumber(
            rate / DECIMALS_DIV // // TODO: change to augmintToken.decimalsDiv
        );
    }

    public async getEthFiatRate(currency: string): Promise<number> {
        return parseFloat((await this.getBnEthFiatRate(currency)).toString());
    }

    public async getAugmintRate(currency: string): Promise<{ rate: Number; lastUpdated: Date }> {
        const bytesCCY = this.web3.utils.asciiToHex(currency);
        const storedRateInfo = await this.instance.methods.rates(bytesCCY).call();
        return {
            rate: parseInt(storedRateInfo.rate) / DECIMALS_DIV, // TODO: change to augmintToken.decimalsDiv
            lastUpdated: new Date(parseInt(storedRateInfo.lastUpdated) * 1000)
        };
    }

    public getSetRateTx(currency: string, price: number): Promise<any> {
        const rateToSend = price * DECIMALS_DIV;
        if (Math.round(rateToSend) !== rateToSend) {
            throw new Error(
                ` getSetRateTx error: provided price of ${price} has more decimals than allowed by AugmintToken decimals of ${DECIMALS}`
            );
        }
        const bytesCCY = this.web3.utils.asciiToHex(currency);
        const tx = this.instance.methods.setRate(bytesCCY, rateToSend);

        return tx;
    }

    public async connect(ethereumConnection: EthereumConnection): Promise<any> {
        return await super.connect(ethereumConnection, RatesArtifact);
    }
}
