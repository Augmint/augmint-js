import { Contract } from "web3-eth-contract";
import * as AbiList from "../generated/abis"

export interface IDeploymentItem {
    abiFileName: string;
    deployedAddress: string;
    current: boolean
}

export class DeployedContract<T extends Contract> {
    public abiFileName: string;
    public deployedAddress: string;
    public current: boolean;
    private instance:T;

    constructor(deployedItem: IDeploymentItem) {
        this.abiFileName = deployedItem.abiFileName;
        this.deployedAddress = deployedItem.deployedAddress;
        this.current = deployedItem.current;
    }

    public connect(web3:any):T {
        if(!this.instance) {
            this.instance = this.connectToAddress(web3, this.deployedAddress)
        }
        return this.instance;
    }

    public connectToAddress(web3: any, address: string): T {
        const abiFile = AbiList[this.abiFileName];
        return new web3.eth.Contract(abiFile, address)
    }
}
