import BigNumber from "bignumber.js";
import { Rates as RatesInstance } from "../generated/index";
import { TransactionObject } from "../generated/types/types";
import { InvalidPriceError, ZeroRateError } from "./Errors";
import { SET_RATE_GAS_LIMIT } from "./gas";
import { Transaction } from "./Transaction";
import { DECIMALS, DECIMALS_DIV, ONE_ETH_IN_WEI } from "./constants";

export interface IRateInfo {
    bnRate: BigNumber /** The rate without decimals */;
    rate: number /** rate with token decimals */;
    lastUpdated: Date;
}

export interface IRatesOptions {
    web3: any
    decimals: Promise<number>
    decimalsDiv: Promise<number>
    constants: any
}

export class Rates {
    // overwrite Contract's  property to have typings
    public instance: RatesInstance; /** web3.js Rates contract instance  */
    private web3: any;
    private decimals: Promise<number>;
    private decimalsDiv: Promise<number>;
    private constants: any;



    constructor(deployedContractInstance:RatesInstance, options: IRatesOptions) {
        this.instance = deployedContractInstance;
        this.web3 = options.web3;
        this.decimals = options.decimals;
        this.decimalsDiv = options.decimalsDiv;
        this.constants = options.constants;
    }

    public async getBnEthFiatRate(currency: string): Promise<BigNumber> {
        const rate: string = await this.instance.methods
            .convertFromWei(this.web3.utils.asciiToHex(currency), this.constants.ONE_ETH_IN_WEI.toString())
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
        return parseFloat(bnEthFiatRate.div(this.constants.DECIMALS_DIV).toFixed(this.constants.DECIMALS));
    }

    public async getAugmintRate(currency: string): Promise<IRateInfo> {
        const decimalsDiv = await this.decimalsDiv;
        const bytesCCY: string = this.web3.utils.asciiToHex(currency);
        const storedRateInfo: { rate: string; lastUpdated: string } = await this.instance.methods
            .rates(bytesCCY)
            .call();

        return {
            bnRate: new BigNumber(storedRateInfo.rate),
            rate: parseInt(storedRateInfo.rate) / decimalsDiv, // TODO: change to augmintToken.decimalsDiv
            lastUpdated: new Date(parseInt(storedRateInfo.lastUpdated) * 1000)
        };
    }

    public setRate(currency: string, price: number): Transaction {
        const rateToSend: number = price * this.constants.DECIMALS_DIV;

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
}
