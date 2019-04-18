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
