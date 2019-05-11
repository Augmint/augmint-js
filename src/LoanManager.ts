import BN from "bn.js";
import { LoanManager as LoanManagerInstance } from "../generated/index";
import { LoanManager_ABI_ec709c3341045caa3a75374b8cfc7286 as LegacyLoanManagerInstanceWithChunkSize } from "../generated/types/LoanManager_ABI_ec709c3341045caa3a75374b8cfc7286";
// import { TransactionObject } from "../generated/types/types";
import { AbstractContract } from "./AbstractContract";
import { AugmintToken } from "./AugmintToken";
import { CHUNK_SIZE, LEGACY_CONTRACTS_CHUNK_SIZE } from "./constants";
import { EthereumConnection } from "./EthereumConnection";
import { ILoanProductTuple, LoanProduct } from "./LoanProduct";
import { Rates } from "./Rates";
// import { Transaction } from "./Transaction";

export interface ILoanManagerOptions {
    token: AugmintToken;
    rates: Rates;
    ethereumConnection: EthereumConnection;
}

export interface ILoanValues {
    disbursedAmount: BN;
    collateralAmount: BN;
    interestAmount: BN;
    defaultingFeeAmount: BN;
    repayBefore: Date;
}

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

    // public async getProduct(productId: number): Promise<ILoanProduct> {}

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

        for (let i = 0; i < queryCount; i++) {
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
}
