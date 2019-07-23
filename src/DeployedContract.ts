import { Contract } from "web3-eth-contract";
import * as AbiList from "../generated/abis"

export interface IDeploymentItem {
    abiFileName: string;
    deployedAddress: string;
}

const connectedInstances = new Map();

export class DeployedContract<T extends Contract> {
    public abiFileName: string;
    public deployedAddress: string;

    constructor(deployedItem: IDeploymentItem) {
        this.abiFileName = deployedItem.abiFileName;
        this.deployedAddress = deployedItem.deployedAddress;
    }

    get instanceHash():string {
        return `${this.abiFileName}_${this.deployedAddress}`;
    }

    public connect(web3:any):T {
        let connectedInstance = connectedInstances.get(this.instanceHash);
        if(!connectedInstance) {
            connectedInstance = this.connectToAddress(web3, this.deployedAddress);
            connectedInstances.set(this.instanceHash, connectedInstance)
        }
        return connectedInstance;
    }

    public connectToAddress(web3: any, address: string): T {
        const abiFile:any = AbiList[this.abiFileName];
        return new web3.eth.Contract(abiFile, address);
    }

    public connectToAddressWithEthers(ethers: any, address: string): T {
        const abiFile:any = AbiList[this.abiFileName];
        const provider:any = ethers.provider;
        return new ethers.Contract(address, abiFile, provider);
    }
}
