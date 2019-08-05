import { Contract } from "web3-eth-contract";
import { AugmintContracts, LoanManager as LoanManagerInstance, TokenAEur } from "../generated/index";
import { LoanManager_ABI_ec709c3341045caa3a75374b8cfc7286 } from "../generated/types/LoanManager_ABI_ec709c3341045caa3a75374b8cfc7286";
import { LoanManager_ABI_fdf5fde95aa940c6dbfb8353c572c5fb } from "../generated/types/LoanManager_ABI_fdf5fde95aa940c6dbfb8353c572c5fb";
import { TransactionObject } from "../generated/types/types";
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

type LoanManagerPreChukSize = LoanManager_ABI_ec709c3341045caa3a75374b8cfc7286; // pre chunk size
type LoanManagerPreMarginLoan = LoanManager_ABI_fdf5fde95aa940c6dbfb8353c572c5fb | LoanManager_ABI_ec709c3341045caa3a75374b8cfc7286;


function isLoanManagerV0(instance: LoanManagerInstance): instance is LoanManagerPreChukSize {
    return (instance as LoanManagerPreChukSize).methods.CHUNK_SIZE !== undefined;
}

function isLoanManagerPreMarginLoan(instance: LoanManagerInstance): instance is LoanManagerPreMarginLoan {
    return !("addExtraCollateral" in  instance.methods);
}

/**
 * Augmint LoanManager contract class
 * @class LoanManager
 * @extends Contract
 */
export class LoanManager extends AbstractContract {
    public static contractName: string = AugmintContracts.LoanManager;
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
        if(!this.augmintTokenAddress) {
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

    public async newEthBackedLoan(product: LoanProduct, weiAmount: Wei, userAccount: string, minRate?: Tokens): Promise<Transaction> {
        let gasEstimate: number;
        const loanCount: number = await this.getLoanCount();

        if (loanCount === 0) {
            gasEstimate = NEW_FIRST_LOAN_GAS;
        } else {
            gasEstimate = NEW_LOAN_GAS;
        }

        let web3Tx: TransactionObject<void>;
        if(!isLoanManagerPreMarginLoan(this.instance)) {
            if(!minRate) {
                throw new AugmintJsError('missing minRate in loanmanager!')
            }
            web3Tx = this.instance.methods.newEthBackedLoan(product.id, minRate.toString());
        } else {
            if(minRate) {
                throw new AugmintJsError('unexpected minRate in loanmanager!')
            }
            web3Tx = this.instance.methods.newEthBackedLoan(product.id)
        }

        return new Transaction(this.ethereumConnection, web3Tx, {
            gasLimit: gasEstimate,
            from: userAccount,
            value: weiAmount.amount
        });
    }

    public async getLoansForAccount(userAccount: string): Promise<Loan[]> {
        const loanManagerInstance:LoanManagerInstance = this.instance;
        const chunkSize: number = isLoanManagerV0(loanManagerInstance) ? LEGACY_CONTRACTS_CHUNK_SIZE : CHUNK_SIZE;
        const loanCount: number = await loanManagerInstance.methods
            .getLoanCountForAddress(userAccount)
            .call()
            .then((res: string) => parseInt(res, 10));

        let loans: Loan[] = [];

        const queryCount: number = Math.ceil(loanCount / chunkSize);
        const tokenAddress: string = await this.tokenAddress;

        for (let i: number = 0; i < queryCount; i++) {
            const loansArray: string[][] = isLoanManagerV0(loanManagerInstance)
                ? await loanManagerInstance.methods
                      .getLoansForAddress(userAccount, i * chunkSize)
                      .call()
                : await loanManagerInstance.methods.getLoansForAddress(userAccount, i * chunkSize, chunkSize).call();
            loans = loans.concat(loansArray.map((loan: ILoanTuple) => new Loan(loan, this.address, tokenAddress)));
        }

        return loans;
    }

    public repayLoan(
        loan: Loan,
        repaymentAmount: Tokens,
        userAccount: string,
        augmintToken: AugmintToken
    ): Transaction {
        const augmintTokenInstance:TokenAEur = augmintToken.instance;

        const web3Tx: TransactionObject<void> = augmintTokenInstance.methods.transferAndNotify(
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

        const loanIdsToCollect: number[] = loansToCollect.map((loan:Loan) => loan.id);

        const web3Tx: TransactionObject<void> = this.instance.methods.collect(loanIdsToCollect);

        return new Transaction(this.ethereumConnection, web3Tx, {
            gasLimit: gasEstimate,
            from: userAccount
        });
    }

    public async getAllLoans(): Promise<Loan[]> {
        try {
            const loanManagerInstance:LoanManagerInstance = this.instance;
            const chunkSize:number = isLoanManagerV0(loanManagerInstance) ? LEGACY_CONTRACTS_CHUNK_SIZE : CHUNK_SIZE;

            const loanCount: number = await this.getLoanCount();
            const tokenAddress: string = await this.tokenAddress;
            let loansToCollect: Loan[] = [];

            const queryCount: number = Math.ceil(loanCount / chunkSize);
            for (let i: number = 0; i < queryCount; i++) {
                const loansArray: string[][] = isLoanManagerV0(loanManagerInstance)
                    ? await loanManagerInstance.methods.getLoans(i * chunkSize).call()
                    : await loanManagerInstance.methods.getLoans(i * chunkSize, chunkSize).call();
                loansToCollect = loansToCollect.concat(
                    loansArray.map((loan: ILoanTuple) => new Loan(loan, this.address, tokenAddress))
                );
            }

            return loansToCollect;
        } catch (error) {
            throw new Error("fetchAllLoansTx failed.\n" + error);
        }
    }

    public getLoanCount(): Promise<number> {
        return this.instance.methods
            .getLoanCount()
            .call()
            .then((res: string) => parseInt(res, 10));
    }

    public addExtraCollateral(loan: Loan, weiAmount: Wei, userAccount: string): Transaction {
        if (loan.isMarginLoan && !isLoanManagerPreMarginLoan(this.instance)) {
            const web3Tx: TransactionObject<void> = this.instance.methods.addExtraCollateral(loan.id);
            return new Transaction(this.ethereumConnection, web3Tx, {
                from: userAccount,
                value: weiAmount.amount
            });
        } else {
            throw new AugmintJsError('invalid call to addExtraCollateral');
        }
    }

    private async getProducts(onlyActive: boolean): Promise<LoanProduct[]> {
        const chunkSize: number = isLoanManagerV0(this.instance) ? LEGACY_CONTRACTS_CHUNK_SIZE : CHUNK_SIZE;

        const productCount: number = await this.instance.methods
            .getProductCount()
            .call()
            .then((res: string) => parseInt(res, 10));

        let products: LoanProduct[] = [];
        const queryCount: number = Math.ceil(productCount / chunkSize);

        for (let i: number = 0; i < queryCount; i++) {
            const productTuples: ILoanProductTuple[] = isLoanManagerV0(this.instance)
                ? ((await this.instance.methods.getProducts(i * chunkSize).call()) as ILoanProductTuple[])
                : ((await this.instance.methods.getProducts(i * chunkSize, chunkSize).call()) as ILoanProductTuple[]);

            const productInstances: LoanProduct[] = productTuples
                .filter((p: ILoanProductTuple) => p[2] !== "0") // solidity can return only fixed size arrays so 0 terms means no product
                .map((tuple: ILoanProductTuple) => new LoanProduct(tuple, this.address));

            products = products.concat(productInstances);
        }

        return products.filter((p: LoanProduct) => p.isActive || !onlyActive);
    }

}
