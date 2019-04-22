/* Generated by ts-generator ver. 0.0.8 */
/* tslint:disable */

import { Contract, ContractOptions, Options } from "web3-eth-contract";
import { Block } from "web3-eth";
import { EventLog } from "web3-core";
import { EventEmitter } from "events";
import { Callback, TransactionObject } from "./types";

export class PreTokenProxy_ABI_19ab69b650e28b2dd211d3851893f91f extends Contract {
    constructor(jsonInterface: any[], address?: string, options?: ContractOptions);
    methods: {
        isSigner(arg0: string): TransactionObject<boolean>;

        scriptAddresses(arg0: number | string): TransactionObject<string>;

        getAllSigners(offset: number | string): TransactionObject<((string)[])[]>;

        getAllScripts(offset: number | string): TransactionObject<((string)[])[]>;

        scripts(
            arg0: string
        ): TransactionObject<{
            state: string;
            signCount: string;
            0: string;
            1: string;
        }>;

        allSigners(arg0: number | string): TransactionObject<string>;

        cancelScript(scriptAddress: string): TransactionObject<void>;

        execute(scriptAddress: string): TransactionObject<boolean>;

        removeSigners(signers: (string)[]): TransactionObject<void>;

        addSigners(signers: (string)[]): TransactionObject<void>;

        sign(scriptAddress: string): TransactionObject<void>;

        activeSignersCount(): TransactionObject<string>;
        getScriptsCount(): TransactionObject<string>;
        getAllSignersCount(): TransactionObject<string>;
        CHUNK_SIZE(): TransactionObject<string>;
    };
    events: {
        SignerAdded(
            options?: {
                filter?: object;
                fromBlock?: number | string;
                topics?: (null | string)[];
            },
            cb?: Callback<EventLog>
        ): EventEmitter;

        SignerRemoved(
            options?: {
                filter?: object;
                fromBlock?: number | string;
                topics?: (null | string)[];
            },
            cb?: Callback<EventLog>
        ): EventEmitter;

        ScriptSigned(
            options?: {
                filter?: object;
                fromBlock?: number | string;
                topics?: (null | string)[];
            },
            cb?: Callback<EventLog>
        ): EventEmitter;

        ScriptApproved(
            options?: {
                filter?: object;
                fromBlock?: number | string;
                topics?: (null | string)[];
            },
            cb?: Callback<EventLog>
        ): EventEmitter;

        ScriptCancelled(
            options?: {
                filter?: object;
                fromBlock?: number | string;
                topics?: (null | string)[];
            },
            cb?: Callback<EventLog>
        ): EventEmitter;

        ScriptExecuted(
            options?: {
                filter?: object;
                fromBlock?: number | string;
                topics?: (null | string)[];
            },
            cb?: Callback<EventLog>
        ): EventEmitter;

        allEvents: (
            options?: {
                filter?: object;
                fromBlock?: number | string;
                topics?: (null | string)[];
            },
            cb?: Callback<EventLog>
        ) => EventEmitter;
    };
}
