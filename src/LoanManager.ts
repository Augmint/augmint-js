import BN from "bn.js";
import { LoanManager as LoanManagerInstance } from "../generated/index";
import { LoanManager_ABI_ec709c3341045caa3a75374b8cfc7286 as LegacyLoanManagerInstanceWithChunkSize } from "../generated/types/LoanManager_ABI_ec709c3341045caa3a75374b8cfc7286";
// import { TransactionObject } from "../generated/types/types";
import { AbstractContract } from "./AbstractContract";
import { AugmintToken } from "./AugmintToken";
import { BN_PPM_DIV, CHUNK_SIZE, LEGACY_CONTRACTS_CHUNK_SIZE, MIN_LOAN_AMOUNT_ADJUSTMENT, PPM_DIV } from "./constants";
import { EthereumConnection } from "./EthereumConnection";
import { Rates } from "./Rates";
// import { Transaction } from "./Transaction";

export interface ILoanManagerOptions {
    token: AugmintToken;
    rates: Rates;
    ethereumConnection: EthereumConnection;
}

export interface ILoanProduct {
    id: number;

    termInSecs: number;

    interestRatePa: number;
    discountRate: BN;
    defaultingFeePt: BN;
    collateralRatio: BN;

    minDisbursedAmount: BN;
    adjustedMinDisbursedAmount: BN;
    maxLoanAmount: BN;

    isActive: boolean;

    // calculateLoanFromCollateral(collateralAmount: BN): ILoanValues;
    // calculateLoanFromDisbursedAmount(disbursedAmount: BN): ILoanValues;
}

export interface ILoanValues {
    disbursedAmount: BN;
    collateralAmount: BN;
    interestAmount: BN;
    defaultingFeeAmount: BN;
    repayBefore: Date;
}

/**  result from LoanManager contract's getProduct:
 *   [id, minDisbursedAmount, term, discountRate, collateralRatio, defaultingFeePt, maxLoanAmount, isActive ]
 */
type ILoanProductTuple = [string, string, string, string, string, string, string, string];

/**
 * Augmint LoanManager contract class
 * @class LoanManager
 * @extends Contract
 */
export class LoanManager extends AbstractContract {
    public instance: LoanManagerInstance;
    private web3: any;

    private token: AugmintToken;
    private rates: Rates;
    private ethereumConnection: EthereumConnection;
    private _products: ILoanProduct[];

    constructor(deployedContractInstance: LoanManagerInstance, options: ILoanManagerOptions) {
        super(deployedContractInstance);

        this.instance = deployedContractInstance;
        this.ethereumConnection = options.ethereumConnection;
        this.web3 = this.ethereumConnection.web3;
        this.rates = options.rates;
        this.token = options.token;
    }

    public async getActiveProducts(): Promise<ILoanProduct[]> {
        return this.getProducts(true);
    }

    public async getAllProducts(): Promise<ILoanProduct[]> {
        return this.getProducts(false);
    }

    // public async getProduct(productId: number): Promise<ILoanProduct> {}

    private async getProducts(onlyActive: boolean): Promise<ILoanProduct[]> {
        if (!this._products) {
            // @ts-ignore  TODO: how to detect better without ts-ignore?
            const isLegacyLoanContractWithChunkSize: boolean = typeof this.instance.methods.CHUNK_SIZE === "function";
            const chunkSize: number = isLegacyLoanContractWithChunkSize ? LEGACY_CONTRACTS_CHUNK_SIZE : CHUNK_SIZE;

            const productCount: number = await this.instance.methods
                .getProductCount()
                .call()
                .then((res: string) => parseInt(res, 10));

            let products: ILoanProduct[] = [];
            const queryCount: number = Math.ceil(productCount / chunkSize);

            for (let i = 0; i < queryCount; i++) {
                const productTuples: ILoanProductTuple[] = isLegacyLoanContractWithChunkSize
                    ? ((await (this.instance as LegacyLoanManagerInstanceWithChunkSize).methods
                          .getProducts(i * chunkSize)
                          .call()) as ILoanProductTuple[])
                    : ((await this.instance.methods
                          .getProducts(i * chunkSize, chunkSize)
                          .call()) as ILoanProductTuple[]);

                const parsedProducts: ILoanProduct[] = this.parseProducts(productTuples);

                products = products.concat(parsedProducts);
            }
            this._products = products;
        }

        return this._products.filter((p: ILoanProduct) => p.isActive || !onlyActive);
    }

    private parseProducts(productTuples: ILoanProductTuple[]): ILoanProduct[] {
        const products: ILoanProduct[] = productTuples.reduce((result: ILoanProduct[], tup: ILoanProductTuple) => {
            // [id, minDisbursedAmount, term, discountRate, collateralRatio, defaultingFeePt, maxLoanAmount, isActive ]
            const [
                sId,
                sMinDisbursedAmount,
                sTerm,
                sDiscountRate,
                sCollateralRatio,
                sDefaultingFeePt,
                sMaxLoanAmount,
                sIsActive
            ]: string[] = tup;

            const termInSecs: number = parseInt(sTerm, 10);

            if (termInSecs > 0) {
                // solidity can return only fixed size arrays so 0 terms means no valute in array

                // this is an informative p.a. interest to displayed to the user - not intended to be used for calculations.
                //  The  interest  p.a. can be lower (but only lower or eq) depending on loan amount because of rounding
                const termInDays: number = termInSecs / 60 / 60 / 24;
                const interestRatePa: number =
                    Math.round(((1 / (parseInt(sDiscountRate) / PPM_DIV) - 1) / termInDays) * 365 * 10000) / 10000;

                const minDisbursedAmount: BN = new BN(sMinDisbursedAmount);

                // adjusted minAmount. rational: ETH/EUR rate change in the background while sending the tx resulting tx rejected
                const adjustedMinDisbursedAmount: BN = new BN(
                    minDisbursedAmount
                        .mul(MIN_LOAN_AMOUNT_ADJUSTMENT)
                        .div(BN_PPM_DIV)
                        .toString() // test deepEqual fails otherwise. don't ask. TODO: revisit this when we decided on bigint lib.
                );

                result.push({
                    id: parseInt(sId),
                    termInSecs,
                    discountRate: new BN(sDiscountRate),
                    interestRatePa,
                    collateralRatio: new BN(sCollateralRatio),
                    minDisbursedAmount,
                    adjustedMinDisbursedAmount,
                    maxLoanAmount: new BN(sMaxLoanAmount),
                    defaultingFeePt: new BN(sDefaultingFeePt),
                    isActive: sIsActive === "1"
                });
            }
            return result;
        }, []);

        return products;
    }
}
