import { Contract } from "web3-eth-contract";

export class AbstractContract {
    private _address: string;

    constructor(instance: Contract) {
        this._address = instance.options.address
    }

    public get address(): string {
        return this._address;
    }
}
