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

    public mul(ratio: Ratio): this {
        this.check(ratio, Ratio);
        return this.create(this.amount.mul(ratio.amount).div(Ratio.DIV_BN));
    }

    public div(ratio: Ratio): this {
        this.check(ratio, Ratio);
        return this.create(ceilDiv(this.amount.mul(Ratio.DIV_BN), ratio.amount));
    }

    public divToRatio(other: this): Ratio {
        this.check(other);
        return new Ratio(this.amount.mul(Ratio.DIV_BN).divRound(other.amount));
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

    public zeroToNull(): this | null {
        return this.isZero() ? null : this;
    }

    public toJSON(): string {
        return this.toString();
    }

    public toString(radix: number = 10): string {
        return this.amount.toString(radix);
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
        return new Wei(new BN(str.toString()));
    }

    public static of(num: number): Wei {
        return new Wei(new BN(Math.round(num * Wei.PRECISION)).mul(Wei.DIV_PRECISON));
    }

    public toTokens(rate: Tokens): Tokens {
        this.check(rate, Tokens);
        return new Tokens(this.amount.mul(rate.amount).divRound(Wei.DIV_BN));
    }

    public toTokensAt(rate: Tokens, price: Ratio): Tokens {
        this.check(rate, Tokens);
        this.check(price, Ratio);
        return new Tokens(this.amount.mul(rate.amount).divRound(price.amount.mul(E12)));
    }

    public toNumber(): number {
        return this.amount.divRound(Wei.DIV_PRECISON).toNumber() / Wei.PRECISION
    }
}

export class Tokens extends FixedPoint {

    static readonly DIV: number = 100;

    public static parse(str: string): Tokens {
        return new Tokens(new BN(str.toString()));
    }

    public static of(num: number): Tokens {
        return new Tokens(new BN(Math.round(num * Tokens.DIV)));
    }

    public static min(o1: Tokens, o2: Tokens): Tokens {
        return o1.lte(o2) ? o1 : o2;
    }

    public toWei(rate: Tokens): Wei {
        this.check(rate, Tokens);
        return new Wei(this.amount.mul(Wei.DIV_BN).divRound(rate.amount));
    }

    public toWeiAt(rate: Tokens, price: Ratio): Wei {
        this.check(rate, Tokens);
        this.check(price, Ratio);
        return new Wei(this.amount.mul(price.amount).mul(E12).divRound(rate.amount));
    }

    public toRate(ethers: Wei): Tokens {
        this.check(ethers, Wei);
        return new Tokens(this.amount.mul(Wei.DIV_BN).divRound(ethers.amount));
    }

    public toNumber(): number {
        return this.amount.toNumber() / Tokens.DIV;
    }
}


export class Ratio extends FixedPoint {

    static readonly DIV: number = 1000000;
    static readonly DIV_BN: BN = new BN(Ratio.DIV);

    public static parse(str: string): Ratio {
        return new Ratio(new BN(str.toString()));
    }

    public static of(num: number): Ratio {
        return new Ratio(new BN(Math.round(num * Ratio.DIV)));
    }

    public toNumber(): number {
        return this.amount.toNumber() / Ratio.DIV;
    }
}

