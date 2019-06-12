import BN from "bn.js";

export class Address {
    public static parse(address: string): Address {
        return new Address(new BN(address))
    }

    public readonly address: BN;

    constructor(address: BN) {
        this.address = address;
    }

    public toString() {
        return '0x' + this.address.toString(16).padStart(40,"0").toLowerCase();
    }
}
