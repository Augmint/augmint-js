import { MIN_LOAN_AMOUNT_ADJUSTMENT } from "./constants";
import { AugmintJsError } from "./Errors";
import { Ratio, Tokens, Wei } from "./units";

export interface ILoanValues {
    disbursedAmount: Tokens;
    collateralAmount: Wei;
    repaymentAmount: Tokens;
    interestAmount: Tokens;
    repayBefore: Date;
}

/**  result from LoanManager contract's getProduct:
 *   [id, minDisbursedAmount, term, discountRate, collateralRatio, defaultingFeePt, maxLoanAmount, isActive, minCollateralRatio ]
 */
export type ILoanProductTuple = [string, string, string, string, string, string, string, string, string];
export class LoanProduct {
    public readonly id: number;

    public readonly termInSecs: number;

    public readonly interestRatePa: number;
    public readonly discountRate: Ratio;
    public readonly defaultingFeePt: Ratio;
    public readonly collateralRatio: Ratio;

    public readonly minDisbursedAmount: Tokens;
    public readonly adjustedMinDisbursedAmount: Tokens;
    public readonly maxLoanAmount: Tokens;

    public readonly isActive: boolean;
    public readonly loanManagerAddress: string;

    public readonly initialCollateralRatio: Ratio;
    public readonly minCollateralRatio: Ratio;


    constructor(loanProductTuple: ILoanProductTuple, loanManagerAddress: string) {
        // Solidity LoanManager contract .getProducts() tuple:
        // [id, minDisbursedAmount, term, discountRate, collateralRatio, defaultingFeePt, maxLoanAmount, isActive, minCollateralRatio ]
        const [
            sId,
            sMinDisbursedAmount,
            sTerm,
            sDiscountRate,
            sCollateralRatio,
            sDefaultingFeePt,
            sMaxLoanAmount,
            sIsActive,
            sMinCollateralRatio
        ]: string[] = loanProductTuple;

        if (sTerm === "0") {
            throw new AugmintJsError(
                "LoanManager.LoanProduct internal error: tried to instantiate a LoanProduct with 0 term. Did you try to create a Product from a dummy LoanProductTuple? "
            );
        }

        const termInSecs: number = parseInt(sTerm, 10);
        const discountRate: Ratio = Ratio.parse(sDiscountRate);

        // this is an informative p.a. interest to displayed to the user - not intended to be used for calculations.
        //  The  interest  p.a. can be lower (but only lower or eq) depending on loan amount because of rounding
        const termInDays: number = termInSecs / 60 / 60 / 24;
        const interestRatePa: number =
            Math.round(((1 / discountRate.toNumber() - 1) / termInDays) * 365 * 10000) / 10000;

        const minDisbursedAmount: Tokens = Tokens.parse(sMinDisbursedAmount);

        // adjusted minAmount. rational: ETH/EUR rate change in the background while sending the tx resulting tx rejected
        const adjustedMinDisbursedAmount: Tokens = minDisbursedAmount.mul(MIN_LOAN_AMOUNT_ADJUSTMENT);

        this.id = parseInt(sId);
        this.termInSecs = termInSecs;
        this.discountRate = discountRate;
        this.interestRatePa = interestRatePa;
        this.minDisbursedAmount = minDisbursedAmount;
        this.adjustedMinDisbursedAmount = adjustedMinDisbursedAmount;
        this.maxLoanAmount = Tokens.parse(sMaxLoanAmount);
        this.defaultingFeePt = Ratio.parse(sDefaultingFeePt);
        this.isActive = sIsActive === "1";

        if(sMinCollateralRatio) {
            this.initialCollateralRatio = Ratio.parse(sCollateralRatio);
            this.minCollateralRatio = Ratio.parse(sMinCollateralRatio);
        } else {
            this.collateralRatio = Ratio.parse(sCollateralRatio);
        }


        this.loanManagerAddress = loanManagerAddress;
    }

    get isMarginLoan(): boolean {
        return !!(this.minCollateralRatio && this.initialCollateralRatio)
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
        const repaymentAmount: Tokens = disbursedAmount.div(this.discountRate);

        const collateralValueInTokens: Tokens = repaymentAmount.div(this.collateralRatio);
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
