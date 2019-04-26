import { Contract } from "web3-eth-contract";
import { DeployedContract } from "../abiniser/DeployedContract";
import { Augmint } from "./Augmint";

export class ContractWrapper {
    public instance: Contract;
    public augmint: Augmint;
    public address:string;
    constructor(deployedContract: DeployedContract<Contract>, augmint: Augmint) {
        this.address = deployedContract.deployedAddress;
        this.instance = deployedContract.connect(augmint.web3);
        this.augmint = augmint;
    }
}
