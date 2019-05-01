// TODO use https://github.com/ethereum-ts/TypeChain instead

export interface AbiniserAbi {
    contractName: string;
    abiHash: string;
    generatedAt: Date;
    abi: RawAbiDefinition;
}

export interface RawAbiParameter {
    name: string;
    type: string;
    components?: RawAbiParameter[];
}

export interface RawAbiDefinition {
    name: string; // NB: truffle version abiniser / augmint-contracts uses doesn't generetate name into abi
    constant: boolean;
    payable: boolean;
    inputs: RawAbiParameter[];
    outputs: RawAbiParameter[];
    type: string;
}
