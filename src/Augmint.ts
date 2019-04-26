/*
import { AugmintToken } from "./AugmintToken";
import * as constants from "./constants";
import * as gas from "./gas";
import { IOptions } from "./EthereumConnection";
export { gas, constants };
*/
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
import { AugmintContracts } from "../abiniser/index";

interface IDeployedContracts {
    [propName: string]: DeployedContractList;
}

interface ILatestContracts {
    [propName: string]: DeployedContract<Contract>;
}

export class Augmint {
    public static instance: Augmint;
    public static connect(connectionOptions: IOptions) {
        if(!Augmint.instance) {
            const etherConecction = new EthereumConnection(connectionOptions);
            Augmint.instance = new Augmint(etherConecction);
        }
        return Augmint.instance;
    }

    public ethereumConnection: EthereumConnection;
    public deployedContracts: IDeployedContracts;
    public latestContracts: ILatestContracts;
    public web3: any;

    private _token: AugmintToken;

    private constructor(ethereumConnection: EthereumConnection) {
        this.ethereumConnection = ethereumConnection;
        this.web3 = this.ethereumConnection.web3;
        const networkId = this.ethereumConnection.networkId;

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
            Object.keys(this.deployedContracts).forEach(contractName => {
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

    get token():AugmintToken {
        if(!this._token) {
            const tokenContractInstance = this.latestContracts[AugmintContracts.TokenAEur].connect(this.web3)
            this._token = new AugmintToken(tokenContractInstance, this)
        }
        return this._token;
    }


}
