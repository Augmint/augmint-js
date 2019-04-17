const BigNumber = require("bignumber.js");
const { constants } = require("./constants.js");
const Contract = require("./Contract.js");
const RatesArtifact = require("./abiniser/abis/Rates_ABI_73a17ebb0acc71773371c6a8e1c8e6ce.json");
const Errors = require("./Errors.js");

class Rates extends Contract {
    constructor() {
        super();
    }

    async getBnEthFiatRate(currency) {
        const rate = await this.instance.methods
            .convertFromWei(this.web3.utils.asciiToHex(currency), constants.ONE_ETH_IN_WEI.toString())
            .call()
            .catch(error => {
                if (error.message.includes("revert rates[bSymbol] must be > 0")) {
                    throw new Errors.ZeroRateError(
                        `getBnEthFiatRate returned zero rate for currency: ${currency}. Is it supported and has rate set in Rates contract?`
                    );
                } else {
                    throw error;
                }
            });

        return new BigNumber(
            rate / constants.DECIMALS_DIV // // TODO: change to augmintToken.decimalsDiv
        );
    }

    async getEthFiatRate(currency) {
        return parseFloat((await this.getBnEthFiatRate(currency)).toString());
    }

    async getAugmintRate(currency) {
        const bytesCCY = this.web3.utils.asciiToHex(currency);
        const storedRateInfo = await this.instance.methods.rates(bytesCCY).call();
        return {
            rate: parseInt(storedRateInfo.rate) / constants.DECIMALS_DIV, // TODO: change to augmintToken.decimalsDiv
            lastUpdated: new Date(parseInt(storedRateInfo.lastUpdated) * 1000)
        };
    }

    getSetRateTx(currency, price) {
        const rateToSend = price * constants.DECIMALS_DIV;
        if (Math.round(rateToSend) !== rateToSend) {
            throw new Error(
                ` getSetRateTx error: provided price of ${price} has more decimals than allowed by AugmintToken decimals of ${
                    constants.DECIMALS
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

module.exports = Rates;
