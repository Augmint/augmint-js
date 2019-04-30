import { Contract } from "web3-eth-contract";
import deployments from "../generated/deployments";
import { AugmintContracts, Exchange as ExchangeInstance, Rates as RatesInstance, TokenAEur } from "../generated/index";
import { AugmintToken } from "./AugmintToken";
import * as constants from "./constants";
import { DeployedContract } from "./DeployedContract";
import { DeployedContractList } from "./DeployedContractList";
import { EthereumConnection, IOptions } from "./EthereumConnection";
import { Exchange } from "./Exchange";
import * as gas from "./gas";
import { Rates } from "./Rates";
import * as Errors from "./Errors";

interface IDeployedContracts {
    [propName: string]: DeployedContractList;
}

interface ILatestContracts {
    [propName: string]: DeployedContract<Contract>;
}

export class Augmint {
    public static async create(connectionOptions: IOptions, environment: string) {
        const ethereumConnection: EthereumConnection = new EthereumConnection(connectionOptions);
        await ethereumConnection.connect();
        return new Augmint(ethereumConnection, environment);
    }

    public ethereumConnection: EthereumConnection;
    public deployedContracts: IDeployedContracts;
    public latestContracts: ILatestContracts;
    public web3: any;

    private _token: AugmintToken;
    private _rates: Rates;
    private _exchange: Exchange;
    private _environment: string;

    private constructor(ethereumConnection: EthereumConnection, environment: string) {
        this.ethereumConnection = ethereumConnection;
        this.web3 = this.ethereumConnection.web3;
        if (!environment) {
            this._environment = this.ethereumConnection.networkId.toString(10);
        }
        this.deployedContracts = deployments[this._environment];

        if (this.deployedContracts) {
            this.latestContracts = {};
            Object.keys(this.deployedContracts).forEach((contractName: string) => {
                this.latestContracts[contractName] = this.deployedContracts[contractName].getCurrentContract();
            });
        }
    }

    static get constants() {
        return constants;
    }

    static get gas() {
        return gas;
    }

    static get EthereumConnection() {
        return EthereumConnection;
    }

    static get AugmintToken() {
        return AugmintToken;
    }

    static get Errors() {
        return Errors;
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
                web3: this.web3,
                decimals: this.token.decimals,
                decimalsDiv: this.token.decimalsDiv,
                constants: constants
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
                web3: this.web3,
                decimalsDiv: this.token.decimalsDiv,
                peggedSymbol: this.token.peggedSymbol,
                rates: this.rates,
                safeBlockGasLimit: this.ethereumConnection.safeBlockGasLimit,
                ONE_ETH_IN_WEI: constants.ONE_ETH_IN_WEI
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
            legacyContracts = this.deployedContracts[AugmintContracts.Exchange].getLegacyContracts();
        } else {
            legacyContracts = this.deployedContracts[AugmintContracts.Exchange].getContractFromAddresses(addresses);
            if (legacyContracts.length !== addresses.length) {
                throw new Error("legacy contracts length mismatch!");
            }
        }
        const options = {
            web3: this.web3,
            decimalsDiv: this.token.decimalsDiv,
            peggedSymbol: this.token.peggedSymbol,
            rates: this.rates,
            safeBlockGasLimit: this.ethereumConnection.safeBlockGasLimit,
            ONE_ETH_IN_WEI: constants.ONE_ETH_IN_WEI
        };
        return legacyContracts.map(
            (contract: DeployedContract<ExchangeInstance>) => new Exchange(contract.connect(this.web3), options)
        );
    }
}
