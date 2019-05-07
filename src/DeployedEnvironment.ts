import { Contract } from "web3-eth-contract";
import { DeployedContract } from "./DeployedContract";

export type IDeployedContractList = Array<DeployedContract<Contract>>;

export interface IDeployedContracts {
    [propName: string]: IDeployedContractList;
}

export interface ILatestContracts {
    [propName: string]: DeployedContract<Contract>;
}

export class DeployedEnvironment {
    public contracts: IDeployedContracts;
    public name: string;
    constructor(name: string) {
        this.name = name;
        this.contracts = {};
    }

    public addRole(role: string, contractList: IDeployedContractList): void {
        this.contracts[role] = contractList;
    }

    public getRole(role: string): IDeployedContractList {
        return this.contracts[role];
    }

    public getLatestContracts(): ILatestContracts {
        const latestContracts: ILatestContracts = {};
        Object.keys(this.contracts).forEach((contractName: string) => {
            latestContracts[contractName] = this.contracts[contractName][0];
        });
        return latestContracts;
    }

    public getLatestContract(name: string): DeployedContract<Contract> {
        const contractList: IDeployedContractList = this.contracts[name];
        return contractList[0];
    }

    public getLegacyContracts(name: string): IDeployedContractList {
        const contractList: IDeployedContractList = this.contracts[name];
        return contractList.slice(1);
    }

    public getContractFromAddresses(name: string, addresses: string[]): IDeployedContractList {
        const contractList: IDeployedContractList = this.contracts[name];
        return contractList.filter(
            (contract: DeployedContract<Contract>) =>
                addresses.map((addr: string) => addr.toLowerCase()).indexOf(contract.deployedAddress.toLowerCase()) > -1
        );
    }
}
