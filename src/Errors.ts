// https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work

export class AugmintJsError extends Error {
    constructor(message: string) {
        super(message);
        this.name = AugmintJsError.name;
        Object.setPrototypeOf(this, AugmintJsError.prototype);
    }
}

export class ZeroRateError extends AugmintJsError {
    constructor(message: string) {
        super(message);
        this.name = ZeroRateError.name;
        Object.setPrototypeOf(this, ZeroRateError.prototype);
    }
}
