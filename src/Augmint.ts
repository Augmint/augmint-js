import { Contract } from "web3-eth-contract";
import { DeployedContract } from "../abiniser/DeployedContract";
import { DeployedContractList } from "../abiniser/DeployedContractList";
import * as LocalDeployments from "../abiniser/deployments.mainnet";
import * as MainnetDeployments from "../abiniser/deployments.mainnet";
import * as RinkebyDeployments from "../abiniser/deployments.rinkeby";
import * as constants from "./constants";
import { EthereumConnection, IOptions } from "./EthereumConnection";
import * as gas from "./gas";
import { AugmintToken } from "./AugmintToken";
import { AugmintContracts, TokenAEur } from "../abiniser/index";
import { Rates } from "./Rates";
import { Exchange } from "./Exchange";
import { Rates as RatesInstance } from "../abiniser/index";
import { Exchange as ExchangeInstance } from "../abiniser/index";

interface IDeployedContracts {
    [propName: string]: DeployedContractList;
}

interface ILatestContracts {
    [propName: string]: DeployedContract<Contract>;
}

export class Augmint {
    public ethereumConnection: EthereumConnection;
    public deployedContracts: IDeployedContracts;
    public latestContracts: ILatestContracts;
    public web3: any;

    private _token: AugmintToken;
    private _rates: Rates;
    private _exchange: Exchange;

    constructor(connectionOptions: IOptions) {
        this.ethereumConnection = new EthereumConnection(connectionOptions);
        this.web3 = this.ethereumConnection.web3;
        const networkId: number = this.ethereumConnection.networkId;

        switch (networkId) {
            case 1:
                this.deployedContracts = MainnetDeployments;
                break;
            case 4:
                this.deployedContracts = RinkebyDeployments;
                break;
            case 999:
                this.deployedContracts = LocalDeployments;
                break;
        }

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

    get token(): AugmintToken {
        if (!this._token) {
            const tokenContract: DeployedContract<TokenAEur> = this.latestContracts[AugmintContracts.TokenAEur];
            this._token = new AugmintToken(tokenContract, this);
        }
        return this._token;
    }

    get rates(): Rates {
        if (!this._rates) {
            const ratesContract: DeployedContract<RatesInstance> = this.latestContracts[AugmintContracts.Rates];
            this._rates = new Rates(ratesContract, this);
        }
        return this._rates;
    }

    get exchange(): Exchange {
        if (!this._exchange) {
            const exchangeContract: DeployedContract<ExchangeInstance> = this.latestContracts[
                AugmintContracts.Exchange
            ];
            this._exchange = new Exchange(exchangeContract, this);
        }
        return this._exchange;
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
        return legacyContracts.map((contract: DeployedContract<ExchangeInstance>) => new Exchange(contract, this));
    }
}
