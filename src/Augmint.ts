import deployments from "../generated/deployments";
import {
    AugmintContracts,
    Exchange as ExchangeInstance,
    LoanManager as LoanManagerInstance,
    Rates as RatesInstance,
    TokenAEur
} from "../generated/index";
import { AugmintToken } from "./AugmintToken";
import * as constants from "./constants";
import { DeployedContract, IDeploymentItem } from "./DeployedContract";
import { DeployedEnvironment, ILatestContracts } from "./DeployedEnvironment";
import * as Errors from "./Errors";
import { EthereumConnection, IOptions } from "./EthereumConnection";
import { Exchange, IExchangeOptions } from "./Exchange";
import * as gas from "./gas";
import { Loan } from "./Loan";
import { LoanManager } from "./LoanManager";
import { LoanProduct } from "./LoanProduct";
import { Rates } from "./Rates";
import { Transaction } from "./Transaction";
import { Tokens, Wei } from "./units";
import { collectPromises } from "./utils/generic";

interface IDeployedEnvironmentStub {
    [propName: string]: IDeploymentItem[];
}

interface ILoanCount {
    loanManagerAddress: string
    loanCount: number
}

export class Augmint {
    public static async create(connectionOptions: IOptions, environment?: DeployedEnvironment): Promise<Augmint> {
        const ethereumConnection: EthereumConnection = new EthereumConnection(connectionOptions);
        await ethereumConnection.connect();

        if (!environment) {
            const networkId: string = ethereumConnection.networkId.toString(10);
            const selectedDeployedEnvironment: DeployedEnvironment | undefined =
                deployments.find(item => item.name === networkId);
                environment = selectedDeployedEnvironment;
        }
        if (!environment) {
            throw new Error("Missing environment, cannot create Augmint");
        }
        return new Augmint(ethereumConnection, environment);
    }

    public static generateDeploymentEnvironment(
        environmentName: string,
        stubs: IDeployedEnvironmentStub[]
    ): DeployedEnvironment {
        const deployedEnvironment: DeployedEnvironment = new DeployedEnvironment(environmentName);
        Object.keys(stubs).forEach(stub => {
            const role: string = stub;
            const contractListStub: Array<DeployedContract<any>> = stubs[stub];
            deployedEnvironment.addRole(role, contractListStub.map(contractStub => new DeployedContract(contractStub)));
        });
        return deployedEnvironment;
    }

    public ethereumConnection: EthereumConnection;
    public deployedEnvironment: DeployedEnvironment;
    public latestContracts: ILatestContracts;
    public web3: any;

    private _token: AugmintToken;
    private _rates: Rates;
    private _exchange: Exchange;
    private loanManagers: Map<string, LoanManager> = new Map<string, LoanManager>();

    private constructor(ethereumConnection: EthereumConnection, environment: DeployedEnvironment) {
        this.ethereumConnection = ethereumConnection;
        this.web3 = this.ethereumConnection.web3;
        this.deployedEnvironment = environment;
        this.latestContracts = this.deployedEnvironment.getLatestContracts();

        if (this.deployedEnvironment.contracts[AugmintContracts.LoanManager]) {
            this.deployedEnvironment.contracts[AugmintContracts.LoanManager]
                .forEach(contract => this.loanManagers.set(contract.deployedAddress.toLowerCase(),
                    new LoanManager(contract.connect(this.web3), this.ethereumConnection)));
        }
    }

    static get constants(): typeof constants {
        return constants;
    }

    static get gas(): typeof gas {
        return gas;
    }

    static get EthereumConnection(): typeof EthereumConnection {
        return EthereumConnection;
    }

    static get AugmintToken(): typeof AugmintToken {
        return AugmintToken;
    }

    static get Errors(): typeof Errors {
        return Errors;
    }

    static get Transaction(): typeof Transaction {
        return Transaction;
    }

    static get Exchange(): typeof Exchange {
        return Exchange;
    }

    static get LoanManager(): typeof LoanManager {
        return LoanManager;
    }

    get token(): AugmintToken {
        if (!this._token) {
            const tokenContract: DeployedContract<TokenAEur> = this.deployedEnvironment.getLatestContract(
                AugmintContracts.TokenAEur
            );
            this._token = new AugmintToken(tokenContract.connect(this.web3), this.ethereumConnection);
        }
        return this._token;
    }

    get rates(): Rates {
        if (!this._rates) {
            const ratesContract: DeployedContract<RatesInstance> = this.deployedEnvironment.getLatestContract(
                AugmintContracts.Rates
            );
            this._rates = new Rates(ratesContract.connect(this.web3), this.ethereumConnection);
        }
        return this._rates;
    }

    get exchange(): Exchange {
        if (!this._exchange) {
            const exchangeContract: DeployedContract<ExchangeInstance> = this.deployedEnvironment.getLatestContract(
                AugmintContracts.Exchange
            );
            this._exchange = new Exchange(exchangeContract.connect(this.web3), {
                token: this.token,
                rates: this.rates,
                ethereumConnection: this.ethereumConnection
            });
        }
        return this._exchange;
    }

    public getLegacyTokens(addresses: string[] = []): AugmintToken[] {
        let legacyTokens: Array<DeployedContract<TokenAEur>> = [];

        if (addresses.length === 0) {
            legacyTokens = this.deployedEnvironment.getLegacyContracts(AugmintContracts.TokenAEur);
        } else {
            legacyTokens = this.deployedEnvironment.getContractFromAddresses(AugmintContracts.TokenAEur, addresses);
            if (legacyTokens.length !== addresses.length) {
                throw new Error("legacy contracts length mismatch!");
            }
        }

        return legacyTokens.map(
            (tokenContract: DeployedContract<TokenAEur>) =>
                new AugmintToken(tokenContract.connect(this.web3), this.ethereumConnection)
        );
    }

    //  myaugmint.getLegacyExchanges(Augmint.constants.SUPPORTED_LEGACY_EXCHANGES)
    public getLegacyExchanges(addresses: string[] = []): Exchange[] {
        let legacyContracts: Array<DeployedContract<ExchangeInstance>> = [];
        if (addresses.length === 0) {
            legacyContracts = this.deployedEnvironment.getLegacyContracts(AugmintContracts.Exchange);
        } else {
            legacyContracts = this.deployedEnvironment.getContractFromAddresses(AugmintContracts.Exchange, addresses);
            if (legacyContracts.length !== addresses.length) {
                throw new Error("legacy contracts length mismatch!");
            }
        }
        const options: IExchangeOptions = {
            token: this.token, // FIXME: This should come from the exchange contract's augmintToken property
            rates: this.rates,
            ethereumConnection: this.ethereumConnection
        };
        return legacyContracts.map(
            (contract: DeployedContract<ExchangeInstance>) => new Exchange(contract.connect(this.web3), options)
        );
    }

    //  augmint.getLegacyLoanManagers(Augmint.constants.SUPPORTED_LEGACY_LOANMANAGERS)
    public getLegacyLoanManagers(addresses: string[] = []): LoanManager[] {
        let legacyContracts: Array<DeployedContract<LoanManagerInstance>> = [];
        if (addresses.length === 0) {
            legacyContracts = this.deployedEnvironment.getLegacyContracts(AugmintContracts.LoanManager);
        } else {
            legacyContracts = this.deployedEnvironment.getContractFromAddresses(
                AugmintContracts.LoanManager,
                addresses
            );
            if (legacyContracts.length !== addresses.length) {
                throw new Error("legacy contracts length mismatch!");
            }
        }
        return legacyContracts.map(
            (contract: DeployedContract<LoanManagerInstance>) =>
                new LoanManager(contract.connect(this.web3), this.ethereumConnection)
        );
    }

    public async getLoansForAccount(userAccount: string): Promise<Loan[]> {
        return await collectPromises(
            this.getAllLoanManagers(),
            loanManager => loanManager.getLoansForAccount(userAccount)
        );
    }

    public async getLoanProducts(activeOnly: boolean): Promise<LoanProduct[]> {
        return await collectPromises(
            this.getAllLoanManagers(),
            loanManager => activeOnly ? loanManager.getActiveProducts() : loanManager.getAllProducts()
        );
    }

    public async repayLoan(loan: Loan, repaymentAmount: Tokens, userAccount: string): Promise<Transaction> {
        const loanManager: LoanManager = this.getLoanManagerByAddress(loan.loanManagerAddress)
        const tokenAddress: string = await loanManager.tokenAddress;
        const tokenContract: DeployedContract<TokenAEur> = this.deployedEnvironment.getContractFromAddress(
            AugmintContracts.TokenAEur,
            tokenAddress
        );
        const token: AugmintToken = new AugmintToken(tokenContract.connect(this.web3), this.ethereumConnection);
        return loanManager.repayLoan(loan, repaymentAmount, userAccount, token);
    }

    public async newEthBackedLoan(loanProduct: LoanProduct, weiAmount: Wei, userAccount: string, minRate?:Tokens): Promise<Transaction> {
        const loanManager: LoanManager = this.getLoanManagerByAddress(loanProduct.loanManagerAddress)
        return loanManager.newEthBackedLoan(loanProduct, weiAmount, userAccount, minRate);
    }

    public async getAllLoans(): Promise<Loan[]> {
        return await collectPromises(
            this.getAllLoanManagers(),
            loanManager => loanManager.getAllLoans()
        );
    }

    public async getLoansToCollect(): Promise<Loan[]> {
        const allLoans: Loan[] = await this.getAllLoans();
        return allLoans.filter((loan: Loan) => loan.isCollectable);
    }

    public collectLoans(loansToCollect: Loan[], userAccount: string): Transaction[] {
        let currentAddress: string | null = null;
        let loanManager: LoanManager | null = null;
        const result: Transaction[] = [];
        let loans: Loan[] = [];
        loansToCollect.sort((a: Loan, b: Loan) => (a.loanManagerAddress < b.loanManagerAddress ? 1 : -1));
        for (const loan of loansToCollect) {
            if (currentAddress !== loan.loanManagerAddress) {
                if (currentAddress !== null && loanManager !== null) {
                    result.push(loanManager.collectLoans(loans, userAccount));
                }
                loanManager = this.getLoanManagerByAddress(loan.loanManagerAddress);
                loans = [];
            }
            currentAddress = loan.loanManagerAddress;
            loans.push(loan);
        }
        if (loanManager) {
            result.push(loanManager.collectLoans(loans, userAccount));
        }
        return result
    }

    public async getLoanCounts(): Promise<ILoanCount[]> {
        const result:ILoanCount[] = [];
        for (const loanManager of this.getAllLoanManagers()) {
            const loanCount:number = await loanManager.getLoanCount();
            result.push({
                loanManagerAddress: loanManager.address,
                loanCount
            })
        }
        return result;
    }

    public addExtraCollateral(loan: Loan, weiAmount: Wei, userAccount: string ): Transaction {
        const loanManager: LoanManager = this.getLoanManagerByAddress(loan.loanManagerAddress);
        return loanManager.addExtraCollateral(loan, weiAmount, userAccount)
    }

    public getAllLoanManagers(): LoanManager[] {
        return Array.from(this.loanManagers.values());
    }

    private getLoanManagerByAddress(address: string): LoanManager {
        const loanManager: LoanManager | undefined = this.loanManagers.get(address.toLowerCase());
        if (!loanManager) {
            throw new Error("environment configuration error: there is no loanmanager at " + address);
        }
        return loanManager;
    }
}
