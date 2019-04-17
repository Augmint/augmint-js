class AugmintJsError extends Error {
    constructor(message) {
        super(message);
    }
}

class ZeroRateError extends AugmintJsError {
    constructor(message) {
        super(message);
    }
}

module.exports = {
    AugmintJsError,
    ZeroRateError
};
