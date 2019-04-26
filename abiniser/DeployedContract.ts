import { Contract } from "web3-eth-contract";
import * as AbiList from "./abis"

export interface IDeploymentItem {
    abiFileName: string;
    abiHash: string;
    contractName: string;
    deployedAddress: string;
    generatedAt: number;
    latestInAbi: boolean;
    current: boolean
}

export class DeployedContract<T extends Contract> {
    public abiFileName: string;
    public abiHash: string;
    public contractName: string;
    public deployedAddress: string;
    public generatedAt: number;
    public latestInAbi: boolean;
    public current: boolean;
    private instance:T;

    constructor(deployedItem: IDeploymentItem) {
        this.abiFileName = deployedItem.abiFileName;
        this.abiHash = deployedItem.abiHash;
        this.contractName = deployedItem.contractName;
        this.deployedAddress = deployedItem.deployedAddress;
        this.generatedAt = deployedItem.generatedAt;
        this.latestInAbi = deployedItem.latestInAbi;
        this.current = deployedItem.current;
    }

    public connect(web3:any):T {
        if(!this.instance) {
            const abiFile = AbiList[this.abiFileName];
            this.instance = new web3.eth.Contract(abiFile, this.deployedAddress)
        }
        return this.instance;
    }
}
