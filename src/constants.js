const constants = {
    ONE_ETH_IN_WEI: 1e18,

    /* augmintToken decimals */
    DECIMALS_DIV: 100,

    DECIMALS: 2,

    PPM_DIV: 1000000,

    ETHEUR: "ETHEUR",

    /* in legacy contracts CHUNK_SIZE set in contract so don't change this value */
    LEGACY_CONTRACTS_CHUNK_SIZE: 100,
    // New contracts accept chunksize as param for each fx so it can be adjusted with this constant
    CHUNK_SIZE: 100,

    TOKEN_BUY: 0,
    TOKEN_SELL: 1
};

module.exports = { constants };
