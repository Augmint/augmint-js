import { TokenAEur } from "../generated/index";
import { AbstractContract } from "./AbstractContract";
import { EthereumConnection } from "./EthereumConnection";

export class AugmintToken extends AbstractContract {
    public instance: TokenAEur;
    private _peggedSymbol: Promise<string>;
    private _symbol: Promise<string>;
    private _name: Promise<string>;
    private _decimals: Promise<number>;
    private _feeAccountAddress: Promise<string>;
    private _web3: any;

    constructor(deployedContractInstance: TokenAEur, ethereumConnection: EthereumConnection) {
        super(deployedContractInstance);
        this.instance = deployedContractInstance;
        this._web3 = ethereumConnection.web3;
    }

    get peggedSymbol(): Promise<string> {
        if (!this._peggedSymbol) {
            this._peggedSymbol = this.instance.methods
                .peggedSymbol()
                .call()
                .then((bytes32PeggedSymbol: string) => {
                    const peggedSymbolWithTrailing: string = this._web3.utils.toAscii(bytes32PeggedSymbol);
                    return peggedSymbolWithTrailing.substr(0, peggedSymbolWithTrailing.indexOf("\0"));
                });
        }
        return this._peggedSymbol;
    }

    get name(): Promise<string> {
        if (!this._name) {
            this._name = this.instance.methods.name().call();
        }
        return this._name;
    }
    get symbol(): Promise<string> {
        if (!this._symbol) {
            this._symbol = this.instance.methods.symbol().call();
        }
        return this._symbol;
    }

    get decimals(): Promise<number> {
        if (!this._decimals) {
            this._decimals = this.instance.methods
                .decimals()
                .call()
                .then((decimals: string) => parseInt(decimals));
        }
        return this._decimals;
    }

    get decimalsDiv(): Promise<number> {
        return this.decimals.then((decimals: number) => 10 ** decimals);
    }

    get feeAccountAddress(): Promise<string> {
        if (!this._feeAccountAddress) {
            this._feeAccountAddress = this.instance.methods.feeAccount().call();
        }
        return this._feeAccountAddress;
    }
}
