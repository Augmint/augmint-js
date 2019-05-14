import { Wei, Tokens, Percent } from "./units";
import { MIN_LOAN_AMOUNT_ADJUSTMENT } from "./constants";
import { AugmintJsError } from "./Errors";

export interface ILoanValues {
    disbursedAmount: Tokens;
    collateralAmount: Wei;
    repaymentAmount: Tokens;
    interestAmount: Tokens;
    repayBefore: Date;
}

/**  result from LoanManager contract's getProduct:
 *   [id, minDisbursedAmount, term, discountRate, collateralRatio, defaultingFeePt, maxLoanAmount, isActive ]
 */
export type ILoanProductTuple = [string, string, string, string, string, string, string, string];
export class LoanProduct {
    public readonly id: number;

    public readonly termInSecs: number;

    public readonly interestRatePa: number;
    public readonly discountRate: Percent;
    public readonly defaultingFeePt: Percent;
    public readonly collateralRatio: Percent;

    public readonly minDisbursedAmount: Tokens;
    public readonly adjustedMinDisbursedAmount: Tokens;
    public readonly maxLoanAmount: Tokens;

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
        const discountRate: Percent = Percent.parse(sDiscountRate);

        // this is an informative p.a. interest to displayed to the user - not intended to be used for calculations.
        //  The  interest  p.a. can be lower (but only lower or eq) depending on loan amount because of rounding
        const termInDays: number = termInSecs / 60 / 60 / 24;
        const interestRatePa: number =
         // Math.round(((1 / (parseInt(sDiscountRate) / PPM_DIV) - 1) / termInDays) * 365 * 10000) / 10000;
            Math.round(((1 / discountRate.toNumber() - 1) / termInDays) * 365 * 10000) / 10000;

        const minDisbursedAmount: Tokens = Tokens.parse(sMinDisbursedAmount);

        // adjusted minAmount. rational: ETH/EUR rate change in the background while sending the tx resulting tx rejected
        const adjustedMinDisbursedAmount: Tokens = minDisbursedAmount.mul(MIN_LOAN_AMOUNT_ADJUSTMENT);

        this.id = parseInt(sId);
        this.termInSecs = termInSecs;
        this.discountRate = discountRate;
        this.interestRatePa = interestRatePa;
        this.collateralRatio = Percent.parse(sCollateralRatio);
        this.minDisbursedAmount = minDisbursedAmount;
        this.adjustedMinDisbursedAmount = adjustedMinDisbursedAmount;
        this.maxLoanAmount = Tokens.parse(sMaxLoanAmount);
        this.defaultingFeePt = Percent.parse(sDefaultingFeePt);
        this.isActive = sIsActive === "1";
    }

    public calculateLoanFromCollateral(collateralAmount: Wei, ethFiatRate: Tokens): ILoanValues {
        const tokenValue: Tokens = collateralAmount.toTokens(ethFiatRate);
        const repaymentAmount: Tokens = tokenValue.mul(this.collateralRatio);
        const disbursedAmount: Tokens = repaymentAmount.mul(this.discountRate);
        const interestAmount: Tokens = repaymentAmount.sub(disbursedAmount);

        const repayBefore: Date = new Date();
        repayBefore.setSeconds(repayBefore.getSeconds() + this.termInSecs);

        return {
            disbursedAmount,
            collateralAmount,
            repaymentAmount,
            interestAmount,
            repayBefore
        };
    }

    public calculateLoanFromDisbursedAmount(disbursedAmount: Tokens, ethFiatRate: Tokens): ILoanValues {

        let repaymentAmount: Tokens = disbursedAmount.div(this.discountRate);

        let collateralValueInTokens: Tokens = repaymentAmount.div(this.collateralRatio);
        const collateralAmount: Wei = collateralValueInTokens.toWei(ethFiatRate);

        const repayBefore: Date = new Date();
        repayBefore.setSeconds(repayBefore.getSeconds() + this.termInSecs);

        const result: ILoanValues = {
            disbursedAmount,
            collateralAmount,
            repaymentAmount,
            interestAmount: repaymentAmount.sub(disbursedAmount),
            repayBefore
        };

        return result;
    }
}
