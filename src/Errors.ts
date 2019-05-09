// https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work

export class AugmintJsError extends Error {
    constructor(message: string) {
        super(message);
        this.name = AugmintJsError.name;
        Object.setPrototypeOf(this, AugmintJsError.prototype);
    }
}

// tslint:disable-next-line:max-classes-per-file
export class ZeroRateError extends AugmintJsError {
    constructor(message: string) {
        super(message);
        this.name = ZeroRateError.name;
        Object.setPrototypeOf(this, ZeroRateError.prototype);
    }
}

// tslint:disable-next-line:max-classes-per-file
export class TransactionError extends AugmintJsError {
    constructor(message: string) {
        super(message);
        this.name = TransactionError.name;
        Object.setPrototypeOf(this, TransactionError.prototype);
    }
}
// tslint:disable-next-line:max-classes-per-file
export class TransactionSendError extends TransactionError {
    constructor(message: string) {
        super(message);
        this.name = TransactionSendError.name;
        Object.setPrototypeOf(this, TransactionSendError.prototype);
    }
}
