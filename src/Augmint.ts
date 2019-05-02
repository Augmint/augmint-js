import { Contract } from "web3-eth-contract";
import deployments from "../generated/deployments";
import { AugmintContracts, Exchange as ExchangeInstance, Rates as RatesInstance, TokenAEur } from "../generated/index";
import { AugmintToken } from "./AugmintToken";
import * as constants from "./constants";
import { DeployedContract, IDeploymentItem } from "./DeployedContract";
import { DeployedContractList } from "./DeployedContractList";
import { DeployedEnvironment, ILatestContracts } from "./DeployedEnvironment";
import * as Errors from "./Errors";
import { EthereumConnection, IOptions } from "./EthereumConnection";
import { Exchange } from "./Exchange";
import * as gas from "./gas";
import { Rates } from "./Rates";
import { Transaction } from "./Transaction";

interface IDeployedEnvironmentStub {
    [propName: string]: IDeploymentItem[];
}

export class Augmint {
    public static async create(connectionOptions: IOptions, environment?: DeployedEnvironment): Promise<Augmint> {
        const ethereumConnection: EthereumConnection = new EthereumConnection(connectionOptions);
        await ethereumConnection.connect();
        return new Augmint(ethereumConnection, environment);
    }

    public static generateDeploymentEnvironment(
        environmentName: string,
        stubs: IDeployedEnvironmentStub[]
    ): DeployedEnvironment {
        const deployedEnvironment: DeployedEnvironment = new DeployedEnvironment(environmentName);
        Object.keys(stubs).forEach(stub => {
            const contractName = stub;
            const contractListStub = stubs[stub];
            deployedEnvironment.addContractList(
                contractName as AugmintContracts,
                new DeployedContractList(
                    contractListStub.map(contractStub => new DeployedContract(contractStub))
                )
            );
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
    private _environment: string;

    private constructor(ethereumConnection: EthereumConnection, environment?: DeployedEnvironment) {
        this.ethereumConnection = ethereumConnection;
        this.web3 = this.ethereumConnection.web3;
        if (!environment) {
            const networkId = this.ethereumConnection.networkId.toString(10);
            const selectedDeployedEnvironment = deployments.find(
                (item: DeployedEnvironment) => item.name === networkId
            );
            if (selectedDeployedEnvironment) {
                this.deployedEnvironment = selectedDeployedEnvironment;
            }
        } else {
            this.deployedEnvironment = environment;
        }

        if (this.deployedEnvironment) {
            this.latestContracts = this.deployedEnvironment.getLatestContracts();
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

    get token(): AugmintToken {
        if (!this._token) {
            const tokenContract: DeployedContract<TokenAEur> = this.latestContracts[AugmintContracts.TokenAEur];
            this._token = new AugmintToken(tokenContract.connect(this.web3), { web3: this.web3 });
        }
        return this._token;
    }

    get rates(): Rates {
        if (!this._rates) {
            const ratesContract: DeployedContract<RatesInstance> = this.latestContracts[AugmintContracts.Rates];
            this._rates = new Rates(ratesContract.connect(this.web3), {
                decimals: this.token.decimals,
                decimalsDiv: this.token.decimalsDiv,
                constants,
                ethereumConnection: this.ethereumConnection
            });
        }
        return this._rates;
    }

    get exchange(): Exchange {
        if (!this._exchange) {
            const exchangeContract: DeployedContract<ExchangeInstance> = this.latestContracts[
                AugmintContracts.Exchange
            ];
            this._exchange = new Exchange(exchangeContract.connect(this.web3), {
                decimalsDiv: this.token.decimalsDiv,
                peggedSymbol: this.token.peggedSymbol,
                rates: this.rates,
                ONE_ETH_IN_WEI: constants.ONE_ETH_IN_WEI,
                ethereumConnection: this.ethereumConnection
            });
        }
        return this._exchange;
    }

    get environment(): string {
        return this._environment;
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
        const options = {
            decimalsDiv: this.token.decimalsDiv,
            peggedSymbol: this.token.peggedSymbol,
            rates: this.rates,
            ONE_ETH_IN_WEI: constants.ONE_ETH_IN_WEI,
            ethereumConnection: this.ethereumConnection
        };
        return legacyContracts.map(
            (contract: DeployedContract<ExchangeInstance>) => new Exchange(contract.connect(this.web3), options)
        );
    }
}
