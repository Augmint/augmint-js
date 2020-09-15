import { Ratio } from "./units";

export const ETHEUR: string = "ETHEUR";

/* in legacy contracts CHUNK_SIZE set in contract so don't change this value */
export const LEGACY_CONTRACTS_CHUNK_SIZE: number = 100;
// New contracts accept chunksize as param for each fx so it can be adjusted with this constant
export const CHUNK_SIZE: number = 100;

// rational: it's to avoid loan tx to fail on min loan amount because of an ETH/EUR rate change
// in the background right while sending the tx
export const MIN_LOAN_AMOUNT_ADJUSTMENT: Ratio = Ratio.of(1.25);

export interface ISupportedLegacyContracts {
    [propName: string]: string[];
}

export const SUPPORTED_LEGACY_AUGMINTTOKENS: ISupportedLegacyContracts = {
    // mainnet
    1: ["0x86a635eccefffa70ff8a6db29da9c8db288e40d0"],

    // local ganache (migrations deploys it for manual testing)
    999: ["0x5d77f09a3703be84d84810379067a6d9ad759582"],

    // rinkeby
    4: ["0x0557183334edc23a666201edc6b0aa2787e2ad3f"]
};

/* List of old augmint Exchange deploy addresses by network id */
export const SUPPORTED_LEGACY_EXCHANGES: ISupportedLegacyContracts = {
    // mainnet
    1: [
        "0x8b52b019d237d0bbe8baedf219132D5254e0690b", // initial Exchange, replaced by 0xeae7d30bcd44f27d58985b56add007fcee254abd
        "0xeae7d30bcd44f27d58985b56add007fcee254abd", // replaced by 0.6.1 at 0xaFEA54baDf7A68F93C2235B5F4cC8F02a2b55Edd
        "0xafea54badf7a68f93c2235b5f4cc8f02a2b55edd"
    ],

    // local ganache (migrations deploys it for manual testing)
    999: ["0xef49d863bd9179da0e96fab02dd498efa149dbdc"],

    // rinkeby
    4: ["0xdf47d51028daff13424f42523fdac73079ab901b"]
};

/* List of old augmint LoanManager deploy addresses by network id */
export const SUPPORTED_LEGACY_LOANMANAGERS: ISupportedLegacyContracts = {
    // mainnet
    1: ["0xcbefaf199b800deeb9ead61f358ee46e06c54070"],

    // local ganache (migrations deploys it for manual testing)
    999: ["0xf7b8384c392fc333d3858a506c4f1506af44d53c"],

    // rinkeby
    4: ["0x6cb7731c78e677f85942b5f1d646b3485e5820c1"]
};

export enum LOAN_STATES {
    Open,
    Repaid,
    Defaulted,
    Collected
}
