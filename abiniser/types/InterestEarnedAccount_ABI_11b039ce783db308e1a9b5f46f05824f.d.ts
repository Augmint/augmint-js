/* Generated by ts-generator ver. 0.0.8 */
/* tslint:disable */

import { Contract, ContractOptions, Options } from "web3-eth-contract";
import { Block } from "web3-eth";
import { EventLog } from "web3-core";
import { EventEmitter } from "events";
import { Callback, TransactionObject } from "./types";

export class InterestEarnedAccount_ABI_11b039ce783db308e1a9b5f46f05824f extends Contract {
    constructor(jsonInterface: any[], address?: string, options?: ContractOptions);
    methods: {
        permissions(arg0: string, arg1: string | number[]): TransactionObject<boolean>;

        revokePermission(agent: string, requiredPermission: string | number[]): TransactionObject<void>;

        revokeMultiplePermissions(agent: string, requiredPermissions: (string | number[])[]): TransactionObject<void>;

        grantMultiplePermissions(agent: string, requiredPermissions: (string | number[])[]): TransactionObject<void>;

        withdraw(
            tokenAddress: string,
            to: string,
            tokenAmount: number | string,
            weiAmount: number | string,
            narrative: string
        ): TransactionObject<void>;

        grantPermission(agent: string, requiredPermission: string | number[]): TransactionObject<void>;

        transferInterest(
            augmintToken: string,
            locker: string,
            interestAmount: number | string
        ): TransactionObject<void>;
    };
    events: {
        WithdrawFromSystemAccount(
            options?: {
                filter?: object;
                fromBlock?: number | string;
                topics?: (null | string)[];
            },
            cb?: Callback<EventLog>
        ): EventEmitter;

        PermissionGranted(
            options?: {
                filter?: object;
                fromBlock?: number | string;
                topics?: (null | string)[];
            },
            cb?: Callback<EventLog>
        ): EventEmitter;

        PermissionRevoked(
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