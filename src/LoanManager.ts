import { LoanManager as LoanManagerInstance, TokenAEur } from "../generated/index";
import { LoanManagerAbiEc709C3341045Caa3A75374B8Cfc7286 } from "../generated/types/LoanManager_ABI_ec709c3341045caa3a75374b8cfc7286";
import { LoanManagerAbiFdf5Fde95Aa940C6Dbfb8353C572C5Fb } from "../generated/types/LoanManager_ABI_fdf5fde95aa940c6dbfb8353c572c5fb";
import { NonPayableTransactionObject, PayableTransactionObject } from "../generated/types/types";
import { AbstractContract } from "./AbstractContract";
import { AugmintToken } from "./AugmintToken";
import { CHUNK_SIZE, LEGACY_CONTRACTS_CHUNK_SIZE } from "./constants";
import { AugmintJsError } from "./Errors";
import { EthereumConnection } from "./EthereumConnection";
import { COLLECT_BASE_GAS, COLLECT_ONE_GAS, NEW_FIRST_LOAN_GAS, NEW_LOAN_GAS, REPAY_GAS } from "./gas";
import { ILoanTuple, Loan } from "./Loan";
import { ILoanProductTuple, LoanProduct } from "./LoanProduct";
import { Transaction } from "./Transaction";
import { Tokens, Wei } from "./units";

type LoanManagerPreChunkSize = LoanManagerAbiEc709C3341045Caa3A75374B8Cfc7286; // pre chunk size
type LoanManagerPreMarginLoan =
    | LoanManagerAbiFdf5Fde95Aa940C6Dbfb8353C572C5Fb
    | LoanManagerAbiEc709C3341045Caa3A75374B8Cfc7286;

function isLoanManagerV0(instance: LoanManagerInstance): instance is LoanManagerPreChunkSize {
    return (instance as LoanManagerPreChunkSize).methods.CHUNK_SIZE !== undefined;
}

function isLoanManagerPreMarginLoan(instance: LoanManagerInstance): instance is LoanManagerPreMarginLoan {
    return !("addExtraCollateral" in instance.methods);
}

/**
 * Augmint LoanManager contract class
 * @class LoanManager
 * @extends Contract
 */
export class LoanManager extends AbstractContract {
    public instance: LoanManagerInstance;
    public augmintTokenAddress: Promise<string>;

    private web3: any;

    private ethereumConnection: EthereumConnection;

    constructor(deployedContractInstance: LoanManagerInstance, ethereumConnection: EthereumConnection) {
        super(deployedContractInstance);

        this.instance = deployedContractInstance;
        this.ethereumConnection = ethereumConnection;
        this.web3 = this.ethereumConnection.web3;
    }

    static get LoanProduct(): typeof LoanProduct {
        return LoanProduct;
    }

    static get Loan(): typeof Loan {
        return Loan;
    }

    get tokenAddress(): Promise<string> {
        if (!this.augmintTokenAddress) {
            this.augmintTokenAddress = this.instance.methods.augmintToken().call();
        }
        return this.augmintTokenAddress;
    }

    public async getActiveProducts(): Promise<LoanProduct[]> {
        return this.getProducts(true);
    }

    public async getAllProducts(): Promise<LoanProduct[]> {
        return this.getProducts(false);
    }

    public async newEthBackedLoan(
        product: LoanProduct,
        weiAmount: Wei,
        userAccount: string,
        minRate?: Tokens
    ): Promise<Transaction> {
        const loanCount: number = await this.getLoanCount();
        const gasEstimate: number = loanCount === 0 ? NEW_FIRST_LOAN_GAS : NEW_LOAN_GAS;

        let web3Tx: PayableTransactionObject<void>;
        if (!isLoanManagerPreMarginLoan(this.instance)) {
            if (!minRate) {
                throw new AugmintJsError("missing minRate in loanmanager!");
            }
            web3Tx = this.instance.methods.newEthBackedLoan(product.id, minRate.toString());
        } else {
            if (minRate) {
                throw new AugmintJsError("unexpected minRate in loanmanager!");
            }
            web3Tx = this.instance.methods.newEthBackedLoan(product.id);
        }

        return new Transaction(this.ethereumConnection, web3Tx, {
            gasLimit: gasEstimate,
            from: userAccount,
            value: weiAmount.amount
        });
    }

    public async getLoansForAccount(userAccount: string): Promise<Loan[]> {
        const chunkSize: number = isLoanManagerV0(this.instance) ? LEGACY_CONTRACTS_CHUNK_SIZE : CHUNK_SIZE;
        const loans: Loan[] = [];
        let i: number = 0;
        let fetched: Loan[];
        do {
            fetched = await this.getLoansForAccountChunk(userAccount, i * chunkSize, chunkSize);
            loans.push(...fetched);
            i += 1;
        } while (fetched.length === chunkSize);
        return loans;
    }

    public repayLoan(
        loan: Loan,
        repaymentAmount: Tokens,
        userAccount: string,
        augmintToken: AugmintToken
    ): Transaction {
        const augmintTokenInstance: TokenAEur = augmintToken.instance;

        const web3Tx: NonPayableTransactionObject<void> = augmintTokenInstance.methods.transferAndNotify(
            this.address,
            repaymentAmount.toString(),
            loan.id
        );

        return new Transaction(this.ethereumConnection, web3Tx, {
            gasLimit: REPAY_GAS,
            from: userAccount
        });
    }

    public collectLoans(loansToCollect: Loan[], userAccount: string): Transaction {
        const gasEstimate: number = COLLECT_BASE_GAS + COLLECT_ONE_GAS * loansToCollect.length;

        const loanIdsToCollect: number[] = loansToCollect.map((loan: Loan) => loan.id);

        const web3Tx: NonPayableTransactionObject<void> = this.instance.methods.collect(loanIdsToCollect);

        return new Transaction(this.ethereumConnection, web3Tx, {
            gasLimit: gasEstimate,
            from: userAccount
        });
    }

    public async getAllLoans(): Promise<Loan[]> {
        const chunkSize: number = isLoanManagerV0(this.instance) ? LEGACY_CONTRACTS_CHUNK_SIZE : CHUNK_SIZE;
        const loans: Loan[] = [];
        let i: number = 0;
        let fetched: Loan[];
        do {
            fetched = await this.getAllLoansChunk(i * chunkSize, chunkSize);
            loans.push(...fetched);
            i += 1;
        } while (fetched.length === chunkSize);
        return loans;
    }

    public getLoanCount(): Promise<number> {
        return this.instance.methods
            .getLoanCount()
            .call()
            .then((res: string) => parseInt(res, 10));
    }

    public addExtraCollateral(loan: Loan, weiAmount: Wei, userAccount: string): Transaction {
        if (loan.isMarginLoan && !isLoanManagerPreMarginLoan(this.instance)) {
            const web3Tx: PayableTransactionObject<void> = this.instance.methods.addExtraCollateral(loan.id);
            return new Transaction(this.ethereumConnection, web3Tx, {
                from: userAccount,
                value: weiAmount.amount
            });
        } else {
            throw new AugmintJsError("invalid call to addExtraCollateral");
        }
    }

    private async getLoansForAccountChunk(userAccount: string, offset: number, chunkSize: number): Promise<Loan[]> {
        const tokenAddress: string = await this.tokenAddress;
        const loansArray: string[][] = isLoanManagerV0(this.instance)
            ? await this.instance.methods.getLoansForAddress(userAccount, offset).call()
            : await this.instance.methods.getLoansForAddress(userAccount, offset, chunkSize).call();
        return loansArray
            .filter((p: ILoanTuple) => p[3] !== "0")
            .map((loan: ILoanTuple) => new Loan(loan, this.address, tokenAddress));
    }

    private async getAllLoansChunk(offset: number, chunkSize: number): Promise<Loan[]> {
        const tokenAddress: string = await this.tokenAddress;
        const loansArray: string[][] = isLoanManagerV0(this.instance)
            ? await this.instance.methods.getLoans(offset).call()
            : await this.instance.methods.getLoans(offset, chunkSize).call();
        return loansArray
            .filter((p: ILoanTuple) => p[3] !== "0")
            .map((loan: ILoanTuple) => new Loan(loan, this.address, tokenAddress));
    }

    private async getProductsChunk(offset: number, chunkSize: number): Promise<LoanProduct[]> {
        const prodArray: string[][] = isLoanManagerV0(this.instance)
            ? await this.instance.methods.getProducts(offset).call()
            : await this.instance.methods.getProducts(offset, chunkSize).call();
        return prodArray
            .filter((p: ILoanProductTuple) => p[2] !== "0") // solidity can return only fixed size arrays so 0 terms means no product
            .map((tuple: ILoanProductTuple) => new LoanProduct(tuple, this.address));
    }

    private async getProducts(onlyActive: boolean): Promise<LoanProduct[]> {
        const chunkSize: number = isLoanManagerV0(this.instance) ? LEGACY_CONTRACTS_CHUNK_SIZE : CHUNK_SIZE;
        const products: LoanProduct[] = [];
        let i: number = 0;
        let fetched: LoanProduct[];
        do {
            fetched = await this.getProductsChunk(i * chunkSize, chunkSize);
            products.push(...fetched);
            i += 1;
        } while (fetched.length === chunkSize);
        return products.filter((p: LoanProduct) => p.isActive || !onlyActive);
    }
}
