import { Contract } from "web3-eth-contract";
import { DeployedContract } from "./DeployedContract";

type DeployedContractArray = Array<DeployedContract<Contract>>;

export class DeployedContractList {
    private contractList: DeployedContractArray = [];
    constructor(contractList: DeployedContractArray) {
        this.contractList = contractList;
    }

    public getCurrentContract(): DeployedContract<Contract> {
        const currentContract = this.contractList.find(item => item.current);
        if (currentContract) {
            return currentContract;
        } else {
            throw new Error("Could not find current contract!");
        }
    }

    public getLegacyContracts(): DeployedContractArray {
        return this.contractList.filter(item => !item.current);
    }

    public getContractFromAddresses(addresses: string[]): DeployedContractArray {
        return this.contractList.filter((item: DeployedContract<Contract>) => {
            const contractAddress: string = item.deployedAddress;
            const lowerCaseAddresses: string[] = addresses.map((addr: string) => addr.toLowerCase());
            return lowerCaseAddresses.indexOf(contractAddress.toLowerCase()) > -1;
        });
    }

    public getByAddress(address: string): DeployedContract<Contract> {
        const contract = this.contractList.find(item => item.deployedAddress.toLowerCase() === address.toLowerCase());
        if (contract) {
            return contract;
        } else {
            throw new Error(`Could not find contract at ${address} !`);
        }
    }
}
