import BN from "bn.js";
import { BN_PPM_DIV, MIN_LOAN_AMOUNT_ADJUSTMENT, PPM_DIV } from "./constants";
import { AugmintJsError } from "./Errors";

/**  result from LoanManager contract's getProduct:
 *   [id, minDisbursedAmount, term, discountRate, collateralRatio, defaultingFeePt, maxLoanAmount, isActive ]
 */
export type ILoanProductTuple = [string, string, string, string, string, string, string, string];
export class LoanProduct {
    public readonly id: number;

    public readonly termInSecs: number;

    public readonly interestRatePa: number;
    public readonly discountRate: BN;
    public readonly defaultingFeePt: BN;
    public readonly collateralRatio: BN;

    public readonly minDisbursedAmount: BN;
    public readonly adjustedMinDisbursedAmount: BN;
    public readonly maxLoanAmount: BN;

    public readonly isActive: boolean;

    constructor(loanProductTuple: ILoanProductTuple) {
        // Solidity LoanManager contract .getProducts() tuple:
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
        ]: string[] = loanProductTuple;

        if (sTerm === "0") {
            throw new AugmintJsError(
                "LoanManager.LoanProduct internal error: tried to instantiate a LoanProduct with 0 term. Did you try to create a Product from a dummy LoanProductTuple? "
            );
        }

        const termInSecs: number = parseInt(sTerm, 10);

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

        this.id = parseInt(sId);
        this.termInSecs = termInSecs;
        this.discountRate = new BN(sDiscountRate);
        this.interestRatePa = interestRatePa;
        this.collateralRatio = new BN(sCollateralRatio);
        this.minDisbursedAmount = minDisbursedAmount;
        this.adjustedMinDisbursedAmount = adjustedMinDisbursedAmount;
        this.maxLoanAmount = new BN(sMaxLoanAmount);
        this.defaultingFeePt = new BN(sDefaultingFeePt);
        this.isActive = sIsActive === "1";
    }

    // calculateLoanFromCollateral(collateralAmount: BN): ILoanValues;
    // calculateLoanFromDisbursedAmount(disbursedAmount: BN): ILoanValues;
}
