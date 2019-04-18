import Contract from "./Contract";
import { DECIMALS, DECIMALS_DIV, ONE_ETH_IN_WEI } from "./constants";
import BigNumber from "bignumber.js"
const RatesArtifact = require("../abiniser/abis/Rates_ABI_73a17ebb0acc71773371c6a8e1c8e6ce.json");

export default class Rates extends Contract {
    constructor() {
        super();
    }

    async getBnEthFiatRate(currency) {
        return new BigNumber(
            (await this.instance.methods
                .convertFromWei(this.web3.utils.asciiToHex(currency), ONE_ETH_IN_WEI.toString())
                .call()) / DECIMALS_DIV // // TODO: change to augmintToken.decimalsDiv
        );
    }

    async getEthFiatRate(currency) {
        return parseFloat((await this.getBnEthFiatRate(currency)).toString());
    }

    async getAugmintRate(currency) {
        const bytesCCY = this.web3.utils.asciiToHex(currency);
        const storedRateInfo = await this.instance.methods.rates(bytesCCY).call();
        return {
            rate: parseInt(storedRateInfo.rate) / DECIMALS_DIV, // TODO: change to augmintToken.decimalsDiv
            lastUpdated: new Date(parseInt(storedRateInfo.lastUpdated) * 1000)
        };
    }

    getSetRateTx(currency, price) {
        const rateToSend = price * DECIMALS_DIV;
        if (Math.round(rateToSend) !== rateToSend) {
            throw new Error(
                ` getSetRateTx error: provided price of ${price} has more decimals than allowed by AugmintToken decimals of ${
                    DECIMALS
                }`
            );
        }
        const bytesCCY = this.web3.utils.asciiToHex(currency);
        const tx = this.instance.methods.setRate(bytesCCY, rateToSend);

        return tx;
    }

    async connect(ethereumConnection, ratesAddress) {
        return await super.connect(ethereumConnection, RatesArtifact, ratesAddress);
    }
}
