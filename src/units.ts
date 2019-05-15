import BN from "bn.js";

const E12: BN = new BN("1000000000000");

const BN_ONE: BN = new BN(1);

function ceilDiv(dividend: BN, divisor: BN): BN {
    return dividend.add(divisor).sub(BN_ONE).div(divisor);
}

abstract class FixedPoint {

    constructor (readonly amount: BN) {
        if (!BN.isBN(amount)) {
            throw new Error("Not a BN: " + amount);
        }
    }

    //
    // operations
    //

    public add(other: this): this {
        this.check(other);
        return this.create(this.amount.add(other.amount));
    }

    public sub(other: this): this {
        this.check(other);
        return this.create(this.amount.sub(other.amount));
    }

    public mul(percent: Percent): this {
        this.check(percent, Percent);
        return this.create(this.amount.mul(percent.amount).div(Percent.DIV_BN));
    }

    public div(percent: Percent): this {
        this.check(percent, Percent);
        return this.create(ceilDiv(this.amount.mul(Percent.DIV_BN), percent.amount));
    }

    //
    // comparison
    //

    public isZero(): boolean {
        return this.amount.isZero();
    }

    public cmp(other: this): number {
        this.check(other);
        return this.amount.cmp(other.amount);
    }

    public eq(other: this): boolean {
        this.check(other);
        return this.amount.eq(other.amount);
    }

    public gte(other: this): boolean {
        this.check(other);
        return this.amount.gte(other.amount);
    }

    public lte(other: this): boolean {
        this.check(other);
        return this.amount.lte(other.amount);
    }

    //
    // conversion
    //

    public toJSON(): string {
        return this.toString();
    }

    // TODO with base param
    public toString(): string {
        return this.amount.toString();
    }

    //
    // util
    //

    protected check(other: FixedPoint, type: Function = this.constructor): void {
        if (!(other instanceof type)) {
            throw new Error("Type error. Expected " + type + " got " + typeof other);
        }
    }

    private create(amount: BN): this {
        return new (this.constructor as typeof Object)(amount) as this;
    }

}

export class Wei extends FixedPoint {

    static readonly PRECISION: number = 1000000;  
    static readonly DIV_BN: BN = new BN("1000000000000000000");
    static readonly DIV_PRECISON: BN = Wei.DIV_BN.divn(Wei.PRECISION);

    public static parse(str: string): Wei {
        return new Wei(new BN(str));
    }

    public static of(num: number): Wei {
        return new Wei(new BN(num * Wei.PRECISION).mul(Wei.DIV_PRECISON));
    }

    public toTokens(rate: Tokens): Tokens {
        this.check(rate, Tokens);
        return new Tokens(this.amount.mul(rate.amount).divRound(Wei.DIV_BN));
    }

    public toTokensAt(rate: Tokens, price: Percent): Tokens {
        this.check(rate, Tokens);
        this.check(price, Percent);
        return new Tokens(this.amount.mul(rate.amount).divRound(price.amount.mul(E12)));
    }

}

export class Tokens extends FixedPoint {

    static readonly DIV: number = 100;
  
    public static parse(str: string): Tokens {
        return new Tokens(new BN(str));
    }

    public static of(num: number): Tokens {
        return new Tokens(new BN(num * Tokens.DIV));
    }

    public toWei(rate: Tokens): Wei {
        this.check(rate, Tokens);
        return new Wei(this.amount.mul(Wei.DIV_BN).divRound(rate.amount));
    }

    public toWeiAt(rate: Tokens, price: Percent): Wei {
        this.check(rate, Tokens);
        this.check(price, Percent);
        return new Wei(this.amount.mul(price.amount).mul(E12).divRound(rate.amount));
    }

}


export class Percent extends FixedPoint {

    static readonly DIV: number = 1000000;
    static readonly DIV_BN: BN = new BN(Percent.DIV);

    public static parse(str: string): Percent {
        return new Percent(new BN(str));
    }

    public static of(num: number): Percent {
        return new Percent(new BN(num * Percent.DIV));
    }

    public toNumber(): number {
        return this.amount.toNumber() / Percent.DIV;
    }

}

