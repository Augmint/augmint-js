import { Address } from "./Address";
import { LOAN_STATES } from "./constants";
import { Tokens, Wei } from "./units";

const collateralStatusTexts: string[] = ["in escrow", "released", "in escrow", "collected & leftover refunded"];
const aDay: number = 24 * 60 * 60;
const sevenDays: number = aDay * 7;
const threeDays: number = aDay * 3;

const currentTime: () => number = (): number => Math.floor(Date.now() / 1000);

export type ILoanTuple = [string, string, string, string, string, string, string, string, string, string];
export class Loan {
    public readonly id: number;
    public readonly collateralAmount: Wei;
    public readonly borrower: Address;
    public readonly productId: number;
    public readonly state: number;
    public readonly maturity: number;
    public readonly disbursementTime: number;
    public readonly interestAmount: Tokens;
    public readonly loanAmount: Tokens;
    public readonly repaymentAmount: Tokens;
    public readonly loanManagerAddress: string;

    constructor(loan: ILoanTuple, loanManagerAddress: string) {
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
            configInterestAmount
        ]: ILoanTuple = loan;

        this.loanManagerAddress = loanManagerAddress;

        const maturity = parseInt(configMaturity, 10);
        if (maturity > 0) {
            const disbursementTime = parseInt(configDisbursementTime, 10);

            const state: number = parseInt(configState, 10);

            this.id = parseInt(configId, 10);
            this.collateralAmount = Wei.parse(configCollateralAmount);
            this.borrower = Address.parse(configBorrower);
            this.productId = parseInt(configProductId, 10);
            this.state = state;
            this.maturity = maturity;
            this.disbursementTime = disbursementTime;
            this.interestAmount = Tokens.parse(configInterestAmount);
            this.loanAmount = Tokens.parse(configLoanAmount);
            this.repaymentAmount = Tokens.parse(configRepaymentAmount);
        }
    }

    get term(): number {
        return this.maturity - this.disbursementTime;
    }

    get isRepayable(): boolean {
        return this.state === LOAN_STATES.Open;
    }

    get isCollectable(): boolean {
        return this.state === LOAN_STATES.Defaulted;
    }

    get isDue(): boolean {
        return this.state === LOAN_STATES.Open;
    }

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
}
