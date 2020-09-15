import { Contract } from "web3-eth-contract";
import { DeployedContract } from "./DeployedContract";

export type IDeployedContractList = DeployedContract<Contract>[];

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

    public getContractFromAddresses(name: string, _addresses: string[]): IDeployedContractList {
        const contractList: IDeployedContractList = this.contracts[name];
        const addresses: string[] = _addresses.map((addr: string) => addr.toLowerCase());

        return contractList.filter(
            (contract: DeployedContract<Contract>) => addresses.indexOf(contract.deployedAddress.toLowerCase()) > -1
        );
    }

    public getContractFromAddress(name: string, address: string): DeployedContract<Contract> {
        const contract: DeployedContract<Contract> | undefined = this.getContract(name, address);
        if (!contract) {
            throw new Error("missing contract: did not find " + name + " at " + address);
        }
        return contract;
    }

    public getAbiHash(name: string, address: string): string | undefined {
        const contract: DeployedContract<Contract> | undefined = this.getContract(name, address);
        return contract && contract.abiFileName.split("_").pop();
    }

    private getContract(name: string, address: string): DeployedContract<Contract> | undefined {
        const contracts: DeployedContract<Contract>[] | undefined = this.contracts[name];
        return (
            contracts &&
            contracts.find(
                (item: DeployedContract<Contract>) => item.deployedAddress.toLowerCase() === address.toLowerCase()
            )
        );
    }
}
