export const ONE_ETH_IN_WEI: number = 1e18;

/* augmintToken decimals */
export const DECIMALS_DIV: number = 100;

export const DECIMALS: number = 2;

export const PPM_DIV: number = 1000000;

export const ETHEUR: string = "ETHEUR";

/* in legacy contracts CHUNK_SIZE set in contract so don't change this value */
export const LEGACY_CONTRACTS_CHUNK_SIZE: number = 100;
// New contracts accept chunksize as param for each fx so it can be adjusted with this constant
export const CHUNK_SIZE: number = 100;

export enum OrderDirection {
    TOKEN_BUY,
    TOKEN_SELL
}

export interface ISupportedLegacyContracts {
    1?: string[] | null;
    4?: string[] | null;
    999?: string[] | null;
}

/* List of old augmint token deploy addresses by network id */
export const SUPPORTED_LEGACY_EXCHANGES: ISupportedLegacyContracts = {
    // mainnet
    1: [
        "0x8b52b019d237d0bbe8Baedf219132D5254e0690b", // initial Exchange, replaced by 0xeae7d30bcd44f27d58985b56add007fcee254abd
        "0xeae7d30bcd44f27d58985b56add007fcee254abd", // replaced by 0.6.1 at 0xaFEA54baDf7A68F93C2235B5F4cC8F02a2b55Edd
        "0xafea54badf7a68f93c2235b5f4cc8f02a2b55edd"
    ],

    // local ganache (migrations deploys it for manual testing)
    999: ["0xef49d863bd9179da0e96fab02dd498efa149dbdc"],

    // rinkeby
    4: ["0xdf47d51028daff13424f42523fdac73079ab901b"]
};
