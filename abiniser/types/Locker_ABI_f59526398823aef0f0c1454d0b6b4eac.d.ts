/* Generated by ts-generator ver. 0.0.8 */
/* tslint:disable */

import { Contract, ContractOptions, Options } from "web3-eth-contract";
import { Block } from "web3-eth";
import { EventLog } from "web3-core";
import { EventEmitter } from "events";
import { Callback, TransactionObject } from "./types";

export class Locker_ABI_f59526398823aef0f0c1454d0b6b4eac extends Contract {
    constructor(jsonInterface: any[], address?: string, options?: ContractOptions);
    methods: {
        lockProducts(
            arg0: number | string
        ): TransactionObject<{
            perTermInterest: string;
            durationInSecs: string;
            minimumLockAmount: string;
            isActive: boolean;
            0: string;
            1: string;
            2: string;
            3: boolean;
        }>;

        permissions(arg0: string, arg1: string | number[]): TransactionObject<boolean>;

        accountLocks(arg0: string, arg1: number | string): TransactionObject<string>;

        locks(
            arg0: number | string
        ): TransactionObject<{
            amountLocked: string;
            owner: string;
            productId: string;
            lockedUntil: string;
            isActive: boolean;
            0: string;
            1: string;
            2: string;
            3: string;
            4: boolean;
        }>;

        getLockProducts(offset: number | string, chunkSize: number | string): TransactionObject<((string)[])[]>;

        getLockCountForAddress(lockOwner: string): TransactionObject<string>;

        getLocks(offset: number | string, chunkSize: number | string): TransactionObject<((string)[])[]>;

        getLocksForAddress(
            lockOwner: string,
            offset: number | string,
            chunkSize: number | string
        ): TransactionObject<((string)[])[]>;

        calculateInterest(perTermInterest: number | string, amountToLock: number | string): TransactionObject<string>;

        revokePermission(agent: string, requiredPermission: string | number[]): TransactionObject<void>;

        revokeMultiplePermissions(agent: string, requiredPermissions: (string | number[])[]): TransactionObject<void>;

        grantMultiplePermissions(agent: string, requiredPermissions: (string | number[])[]): TransactionObject<void>;

        grantPermission(agent: string, requiredPermission: string | number[]): TransactionObject<void>;

        addLockProduct(
            perTermInterest: number | string,
            durationInSecs: number | string,
            minimumLockAmount: number | string,
            isActive: boolean
        ): TransactionObject<void>;

        setLockProductActiveState(lockProductId: number | string, isActive: boolean): TransactionObject<void>;

        transferNotification(
            from: string,
            amountToLock: number | string,
            _lockProductId: number | string
        ): TransactionObject<void>;

        releaseFunds(lockId: number | string): TransactionObject<void>;

        setMonetarySupervisor(newMonetarySupervisor: string): TransactionObject<void>;

        monetarySupervisor(): TransactionObject<string>;
        augmintToken(): TransactionObject<string>;
        getLockProductCount(): TransactionObject<string>;
        getLockCount(): TransactionObject<string>;
    };
    events: {
        NewLockProduct(
            options?: {
                filter?: object;
                fromBlock?: number | string;
                topics?: (null | string)[];
            },
            cb?: Callback<EventLog>
        ): EventEmitter;

        LockProductActiveChange(
            options?: {
                filter?: object;
                fromBlock?: number | string;
                topics?: (null | string)[];
            },
            cb?: Callback<EventLog>
        ): EventEmitter;

        NewLock(
            options?: {
                filter?: object;
                fromBlock?: number | string;
                topics?: (null | string)[];
            },
            cb?: Callback<EventLog>
        ): EventEmitter;

        LockReleased(
            options?: {
                filter?: object;
                fromBlock?: number | string;
                topics?: (null | string)[];
            },
            cb?: Callback<EventLog>
        ): EventEmitter;

        MonetarySupervisorChanged(
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
