import { LoanManager as LoanManagerInstance } from "../generated/index";
import { LoanManager_ABI_ec709c3341045caa3a75374b8cfc7286 as LegacyLoanManagerInstanceWithChunkSize } from "../generated/types/LoanManager_ABI_ec709c3341045caa3a75374b8cfc7286";
import { AbstractContract } from "./AbstractContract";
import { AugmintToken } from "./AugmintToken";
import { CHUNK_SIZE, LEGACY_CONTRACTS_CHUNK_SIZE } from "./constants";
import { EthereumConnection } from "./EthereumConnection";
import { NEW_FIRST_LOAN_GAS, NEW_LOAN_GAS, PLACE_ORDER_GAS } from "./gas";
import { Loan, ILoanTuple } from "./Loan";
import { ILoanProductTuple, LoanProduct } from "./LoanProduct";
import { Rates } from "./Rates";
import { Tokens, Wei } from "./units";
import { TransactionObject } from "../generated/types/types";
import { Transaction } from "./Transaction";

export interface ILoanManagerOptions {
    token: AugmintToken;
    rates: Rates;
    ethereumConnection: EthereumConnection;
}

/**
 * Augmint LoanManager contract class
 * @class LoanManager
 * @extends Contract
 */
export class LoanManager extends AbstractContract {
    public instance: LoanManagerInstance;
    public augmintTokenAddress: Promise<string>;
    public ratesAddress: Promise<string>;

    private web3: any;

    private token: AugmintToken;
    private rates: Rates;
    private ethereumConnection: EthereumConnection;

    constructor(deployedContractInstance: LoanManagerInstance, options: ILoanManagerOptions) {
        super(deployedContractInstance);

        this.instance = deployedContractInstance;
        this.ethereumConnection = options.ethereumConnection;
        this.web3 = this.ethereumConnection.web3;
        this.rates = options.rates;
        this.token = options.token;
    }

    static get LoanProduct(): typeof LoanProduct {
        return LoanProduct;
    }

    public async getActiveProducts(): Promise<LoanProduct[]> {
        return this.getProducts(true);
    }

    public async getAllProducts(): Promise<LoanProduct[]> {
        return this.getProducts(false);
    }

    public async newEthBackedLoan(product: LoanProduct, ethAmount: number, userAccount: string): Promise<Transaction> {
        let gasEstimate: number;
        const loanCount: number = await this.getLoanCount();

        if (loanCount === 0) {
            gasEstimate = NEW_FIRST_LOAN_GAS;
        } else {
            gasEstimate = NEW_LOAN_GAS;
        }

        const weiAmount:Wei = Wei.of(ethAmount); // new BigNumber(ethAmount).mul(ONE_ETH_IN_WEI);
        const web3Tx: TransactionObject<void> = this.instance.methods.newEthBackedLoan(product.id);

        return new Transaction(this.ethereumConnection, web3Tx, {
            gasLimit: gasEstimate,
            from: userAccount,
            value: weiAmount.amount
        });
    }

    public async fetchLoansForAccount(userAccount: string): Promise<Loan[]> {
        const loanManagerInstance = this.instance;
        // TODO: resolve timing of loanManager refresh in order to get loanCount from loanManager:
        // @ts-ignore  TODO: how to detect better without ts-ignore?
        const isLegacyLoanContract = typeof loanManagerInstance.methods.CHUNK_SIZE === "function";
        const chunkSize = isLegacyLoanContract ? LEGACY_CONTRACTS_CHUNK_SIZE : CHUNK_SIZE;
        const loanCount = await loanManagerInstance.methods
            .getLoanCountForAddress(userAccount)
            .call()
            .then(res => parseInt(res, 10));

        let loans:Loan[] = [];

        const queryCount = Math.ceil(loanCount / chunkSize);

        for (let i = 0; i < queryCount; i++) {
            const loansArray:string[][] = isLegacyLoanContract
                ? await (loanManagerInstance as LegacyLoanManagerInstanceWithChunkSize).methods.getLoansForAddress(userAccount, i * chunkSize).call()
                : await loanManagerInstance.methods.getLoansForAddress(userAccount, i * chunkSize, chunkSize).call();
            loans = loans.concat(loansArray.map((loan:ILoanTuple) => new Loan(loan, loanManagerInstance.address)));
        }

        return loans;
    }

    public async repayLoan(loan: Loan, repaymentAmount: Tokens, userAccount: string) {}

    public async collectLoans(loans: Loan[], userAccount: string) {}

    public async fetchLoans() {}

    private async getProducts(onlyActive: boolean): Promise<LoanProduct[]> {
        // @ts-ignore  TODO: how to detect better without ts-ignore?
        const isLegacyLoanContractWithChunkSize: boolean = typeof this.instance.methods.CHUNK_SIZE === "function";
        const chunkSize: number = isLegacyLoanContractWithChunkSize ? LEGACY_CONTRACTS_CHUNK_SIZE : CHUNK_SIZE;

        const productCount: number = await this.instance.methods
            .getProductCount()
            .call()
            .then((res: string) => parseInt(res, 10));

        let products: LoanProduct[] = [];
        const queryCount: number = Math.ceil(productCount / chunkSize);

        for (let i: number = 0; i < queryCount; i++) {
            const productTuples: ILoanProductTuple[] = isLegacyLoanContractWithChunkSize
                ? ((await (this.instance as LegacyLoanManagerInstanceWithChunkSize).methods
                      .getProducts(i * chunkSize)
                      .call()) as ILoanProductTuple[])
                : ((await this.instance.methods.getProducts(i * chunkSize, chunkSize).call()) as ILoanProductTuple[]);

            const productInstances: LoanProduct[] = productTuples
                .filter((p: ILoanProductTuple) => p[2] !== "0") // solidity can return only fixed size arrays so 0 terms means no product
                .map((tuple: ILoanProductTuple) => new LoanProduct(tuple));

            products = products.concat(productInstances);
        }

        return products.filter((p: LoanProduct) => p.isActive || !onlyActive);
    }

    private getLoanCount(): Promise<number> {
        return this.instance.methods
            .getLoanCount()
            .call()
            .then((res: string) => parseInt(res, 10));
    }
}
