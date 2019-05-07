import BN from "bn.js";
import { Rates as RatesInstance } from "../generated/index";
import { TransactionObject } from "../generated/types/types";
import { AbstractContract } from "./AbstractContract";
import { ONE_ETH_IN_WEI } from "./constants";
import { ZeroRateError } from "./Errors";
import { EthereumConnection } from "./EthereumConnection";
import { SET_RATE_GAS_LIMIT } from "./gas";
import { Transaction } from "./Transaction";

export interface IRateInfo {
    rate: BN;
    lastUpdated: Date;
}

export class Rates extends AbstractContract {
    // overwrite Contract's  property to have typings
    public instance: RatesInstance; /** web3.js Rates contract instance  */
    private web3: any;
    private ethereumConnection: EthereumConnection;

    constructor(deployedContractInstance: RatesInstance, ethereumConnection: EthereumConnection) {
        super(deployedContractInstance);
        this.instance = deployedContractInstance;
        this.ethereumConnection = ethereumConnection;
        this.web3 = this.ethereumConnection.web3;
    }

    public async getEthFiatRate(currency: string): Promise<BN> {
        const rate: string = await this.instance.methods
            .convertFromWei(this.web3.utils.asciiToHex(currency), ONE_ETH_IN_WEI.toString())
            .call()
            .catch((error: Error) => {
                if (error.message.includes("revert rates[bSymbol] must be > 0")) {
                    throw new ZeroRateError(
                        `getEthFiatRate returned zero rate for currency: ${currency}. Is it supported and has rate set in Rates contract?`
                    );
                } else {
                    throw error;
                }
            });

        return rate;
    }

    public async getAugmintRate(currency: string): Promise<IRateInfo> {
        const bytesCCY: string = this.web3.utils.asciiToHex(currency);
        const storedRateInfo: { rate: string; lastUpdated: string } = await this.instance.methods
            .rates(bytesCCY)
            .call();

        return {
            rate: storedRateInfo.rate,
            lastUpdated: new Date(parseInt(storedRateInfo.lastUpdated) * 1000)
        };
    }

    public setRate(currency: string, price: BN): Transaction {

        const bytesCCY: string = this.web3.utils.asciiToHex(currency);

        const web3Tx: TransactionObject<void> = this.instance.methods.setRate(bytesCCY, price.toString());
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
