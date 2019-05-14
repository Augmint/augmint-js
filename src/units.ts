import BN from "bn.js";

const BN_ONE: BN = new BN(1);

const PPM_DIV: number = 1000000;
const BN_PPM_DIV: BN = new BN(PPM_DIV);

const E12: BN = new BN("1000000000000");

const ONE_ETH_IN_WEI = new BN("1000000000000000000");

const DECIMALS_DIV: number = 100;
const DECIMALS: number = 2;

function ceilDiv(dividend: BN, divisor: BN) {
	return dividend.add(divisor).sub(BN_ONE).div(divisor);
}

// TODO runtime type checks to ensure other is the same class
// TODO units should know their decimals
abstract class Unit {
    constructor (readonly amount: BN) {
    	// TODO null-check?
    }


    //
    // operations
    //

	private create(amount: BN): this {
		return new (<typeof Object>this.constructor)(amount) as this;
	}

	public add(other: this): this {
		return this.create(this.amount.add(other.amount));
	}

	public sub(other: this): this {
		return this.create(this.amount.sub(other.amount));
	}

	public mul(percent: Percent): this {
		return this.create(this.amount.mul(percent.amount).div(BN_PPM_DIV));
	}

	public div(percent: Percent): this {
		return this.create(ceilDiv(this.amount.mul(BN_PPM_DIV), percent.amount));
	}

	//
	// comparison
	//

	public isZero(): boolean {
		return this.amount.isZero();
	}

	public cmp(other: this): number {
		return this.amount.cmp(other.amount);
	}

	public eq(other: this): boolean {
		return this.amount.eq(other.amount);
	}

	public gte(other: this): boolean {
		return this.amount.gte(other.amount);
	}

	public lte(other: this): boolean {
		return this.amount.lte(other.amount);
	}

	//
	// conversion
	//

	// public toJSON(): string {
	// 	return this.toString();
	// }

	// TODO with base param
	public toString(): string {
		return this.amount.toString();
	}

}

export class Wei extends Unit {
  
	public toTokens(rate: Tokens): Tokens {
		return new Tokens(this.amount.mul(rate.amount).divRound(ONE_ETH_IN_WEI));
	}

    public toTokensAt(rate: Tokens, price: Percent): Tokens {
	    return new Tokens(this.amount.mul(rate.amount).divRound(price.amount.mul(E12)));
    }

    public static parse(string: String): Wei {
    	return new Wei(new BN(string));
    }

    public static of(num: number) {
	    return new Wei(new BN(num * PPM_DIV).mul(ONE_ETH_IN_WEI).div(BN_PPM_DIV));
	}

}

export class Tokens extends Unit {

// TODO refactor
	public toWei(rate: Tokens): Wei {
		return new Wei(this.amount.mul(ONE_ETH_IN_WEI).divRound(rate.amount));
	}

    public toWeiAt(rate: Tokens, price: Percent): Wei {
	    return new Wei(this.amount.mul(price.amount).mul(E12).divRound(rate.amount));
    }

    public static parse(string: String): Tokens {
    	return new Tokens(new BN(string));
    }

    public static of(num: number): Tokens {
    	return new Tokens(new BN(num * DECIMALS_DIV));
    }

}


export class Percent extends Unit {

    public static parse(string: String) {
    	return new Percent(new BN(string));
    }

    public static of(num: number) {
    	return new Percent(new BN(num * PPM_DIV));
    }

	public toNumber(): number {
		return this.amount.toNumber() / PPM_DIV;
	}



}

