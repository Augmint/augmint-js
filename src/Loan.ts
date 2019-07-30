import { LOAN_STATES } from "./constants";
import { Ratio, Tokens, Wei } from "./units";

const collateralStatusTexts: string[] = ["in escrow", "released", "in escrow", "collected & leftover refunded"];
const aDay: number = 24 * 60 * 60;
const sevenDays: number = aDay * 7;
const threeDays: number = aDay * 3;

const currentTime: () => number = (): number => Math.floor(Date.now() / 1000);

/*
// [loanId, collateralAmount, repaymentAmount, borrower, productId, state, maturity, disbursementTime, loanAmount, interestAmount]
export type ILoanTuple = [string, string, string, string, string, string, string, string, string, string];
*/

// [loanId, collateralAmount, repaymentAmount, borrower, productId, state, maturity, disbursementTime, loanAmount, interestAmount, marginCallRate, isCollectable]
export type ILoanTuple = [string, string, string, string, string, string, string, string, string, string, string, string];

export class Loan {
    public readonly id: number;
    public readonly collateralAmount: Wei;
    public readonly borrower: string;
    public readonly productId: number;
    public readonly state: number;
    public readonly maturity: number;
    public readonly disbursementTime: number;
    public readonly interestAmount: Tokens;
    public readonly loanAmount: Tokens;
    public readonly repaymentAmount: Tokens;
    public readonly loanManagerAddress: string;
    public readonly marginCallRate: Tokens;
    public readonly tokenAddress: string;
    private readonly _isCollectable: boolean;

    constructor(loan: ILoanTuple, loanManagerAddress: string, tokenAddress: string) {
        const [
            configId,
            configCollateralAmount,
            configRepaymentAmount,
            configBorrower,
            configProductId,
            configState,
            configMaturity,
            configDisbursementTime,
            configLoanAmount,
            configInterestAmount,
            configMarginCallRate,
            configIsCollectable
        ]: ILoanTuple = loan;

        this.loanManagerAddress = loanManagerAddress;
        this.tokenAddress = tokenAddress;

        const maturity:number = parseInt(configMaturity, 10);
        if (maturity > 0) {
            const disbursementTime:number = parseInt(configDisbursementTime, 10);

            const state: number = parseInt(configState, 10);

            this.id = parseInt(configId, 10);
            this.collateralAmount = Wei.parse(configCollateralAmount);
            this.borrower = configBorrower;
            this.productId = parseInt(configProductId, 10);
            this.state = state;
            this.maturity = maturity;
            this.disbursementTime = disbursementTime;
            this.interestAmount = Tokens.parse(configInterestAmount);
            this.loanAmount = Tokens.parse(configLoanAmount);
            this.repaymentAmount = Tokens.parse(configRepaymentAmount);

            if(configMarginCallRate !== undefined) {
                this.marginCallRate = Tokens.parse(configMarginCallRate);
                this._isCollectable = configIsCollectable === '1';
            }
        }
    }


    get isMarginLoan(): boolean {
        return !!this.marginCallRate
    }

    get term(): number {
        return this.maturity - this.disbursementTime;
    }

    get isRepayable(): boolean {
        return this.state === LOAN_STATES.Open && currentTime() < this.maturity;
    }

    get isCollectable(): boolean {
        return this.isMarginLoan ? this._isCollectable : this.state === LOAN_STATES.Defaulted;
    }

    get isDue(): boolean {
        return this.state === LOAN_STATES.Open && (this.maturity - currentTime() < sevenDays);
    }

    // TODO: update for margin loans!!!
    get loanStateText(): string {
        switch (this.state) {
            case LOAN_STATES.Open:
                if (this.maturity - currentTime() < sevenDays) {
                    return "Payment Due";
                } else {
                    return "Open";
                }
            case LOAN_STATES.Repaid:
                return "Repaid";
            case LOAN_STATES.Defaulted:
                return "Defaulted (not yet collected)";
            case LOAN_STATES.Collected:
                return "Defaulted and collected";
        }
        return "Invalid state";
    }

    get collateralStatus(): string {
        return collateralStatusTexts[this.state] || "Invalid status";
    }

    get dueState(): string {
        return this.state === LOAN_STATES.Open
            ? this.maturity - currentTime() < threeDays
                ? "danger"
                : "warning"
            : "";
    }

    public calculateCollateralRatio(currentRate: Tokens): Ratio {
        return this.collateralAmount.toTokens(currentRate).divToRatio(this.repaymentAmount);
    }
}
