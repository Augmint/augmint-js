import { Contract } from "web3-eth-contract";
import { AugmintContracts } from "../generated/index";
import { DeployedContract } from "./DeployedContract";
import { DeployedContractArray, DeployedContractList } from "./DeployedContractList";

export interface IDeployedContracts {
    [propName: string]: DeployedContractList;
}

export interface ILatestContracts {
    [propName: string]: DeployedContract<Contract>;
}

export class DeployedEnvironment {
    public contracts: IDeployedContracts;
    public name: string;
    constructor(name: string) {
        this.name = name;
    }

    public addContractList(contractName: AugmintContracts, contractList: DeployedContractList): void {
        this.contracts[contractName] = contractList;
    }

    public getLatestContracts(): ILatestContracts {
        const latestContracts: ILatestContracts = {};
        Object.keys(this.contracts).forEach((contractName: string) => {
            latestContracts[contractName] = this.contracts[contractName].getCurrentContract();
        });
        return latestContracts;
    }

    public getLatestContract(name: string): DeployedContract<Contract> {
        const contractList: DeployedContractList = this.contracts[name];
        return contractList.getCurrentContract();
    }

    public getLegacyContracts(name: AugmintContracts): DeployedContractArray {
        const contractList: DeployedContractList = this.contracts[name];
        return contractList.getLegacyContracts();
    }

    public getContractFromAddresses(name: AugmintContracts, addresses: string[]): DeployedContractArray {
        const contractList: DeployedContractList = this.contracts[name];
        return contractList.getContractFromAddresses(addresses);
    }
}
