/* Generated by ts-generator ver. 0.0.8 */
/* tslint:disable */

import { Contract, ContractOptions, Options } from "web3-eth-contract";
import { Block } from "web3-eth";
import { EventLog } from "web3-core";
import { EventEmitter } from "events";
import { Callback, TransactionObject } from "./types";

export class LoanManager_ABI_fdf5fde95aa940c6dbfb8353c572c5fb extends Contract {
    constructor(jsonInterface: any[], address?: string, options?: ContractOptions);
    methods: {
        permissions(arg0: string, arg1: string | number[]): TransactionObject<boolean>;

        accountLoans(arg0: string, arg1: number | string): TransactionObject<string>;

        products(
            arg0: number | string
        ): TransactionObject<{
            minDisbursedAmount: string;
            term: string;
            discountRate: string;
            collateralRatio: string;
            defaultingFeePt: string;
            isActive: boolean;
            0: string;
            1: string;
            2: string;
            3: string;
            4: string;
            5: boolean;
        }>;

        loans(
            arg0: number | string
        ): TransactionObject<{
            collateralAmount: string;
            repaymentAmount: string;
            borrower: string;
            productId: string;
            state: string;
            maturity: string;
            0: string;
            1: string;
            2: string;
            3: string;
            4: string;
            5: string;
        }>;

        getProducts(offset: number | string, chunkSize: number | string): TransactionObject<((string)[])[]>;

        getLoans(offset: number | string, chunkSize: number | string): TransactionObject<((string)[])[]>;

        getLoanCountForAddress(borrower: string): TransactionObject<string>;

        getLoansForAddress(
            borrower: string,
            offset: number | string,
            chunkSize: number | string
        ): TransactionObject<((string)[])[]>;

        getLoanTuple(loanId: number | string): TransactionObject<(string)[]>;

        revokePermission(agent: string, requiredPermission: string | number[]): TransactionObject<void>;

        revokeMultiplePermissions(agent: string, requiredPermissions: (string | number[])[]): TransactionObject<void>;

        grantMultiplePermissions(agent: string, requiredPermissions: (string | number[])[]): TransactionObject<void>;

        grantPermission(agent: string, requiredPermission: string | number[]): TransactionObject<void>;

        addLoanProduct(
            term: number | string,
            discountRate: number | string,
            collateralRatio: number | string,
            minDisbursedAmount: number | string,
            defaultingFeePt: number | string,
            isActive: boolean
        ): TransactionObject<void>;

        setLoanProductActiveState(productId: number | string, newState: boolean): TransactionObject<void>;

        newEthBackedLoan(productId: number | string): TransactionObject<void>;

        transferNotification(
            arg0: string,
            repaymentAmount: number | string,
            loanId: number | string
        ): TransactionObject<void>;

        collect(loanIds: (number | string)[]): TransactionObject<void>;

        setSystemContracts(newRatesContract: string, newMonetarySupervisor: string): TransactionObject<void>;

        monetarySupervisor(): TransactionObject<string>;
        rates(): TransactionObject<string>;
        augmintToken(): TransactionObject<string>;
        getProductCount(): TransactionObject<string>;
        getLoanCount(): TransactionObject<string>;
    };
    events: {
        NewLoan(
            options?: {
                filter?: object;
                fromBlock?: number | string;
                topics?: (null | string)[];
            },
            cb?: Callback<EventLog>
        ): EventEmitter;

        LoanProductActiveStateChanged(
            options?: {
                filter?: object;
                fromBlock?: number | string;
                topics?: (null | string)[];
            },
            cb?: Callback<EventLog>
        ): EventEmitter;

        LoanProductAdded(
            options?: {
                filter?: object;
                fromBlock?: number | string;
                topics?: (null | string)[];
            },
            cb?: Callback<EventLog>
        ): EventEmitter;

        LoanRepayed(
            options?: {
                filter?: object;
                fromBlock?: number | string;
                topics?: (null | string)[];
            },
            cb?: Callback<EventLog>
        ): EventEmitter;

        LoanCollected(
            options?: {
                filter?: object;
                fromBlock?: number | string;
                topics?: (null | string)[];
            },
            cb?: Callback<EventLog>
        ): EventEmitter;

        SystemContractsChanged(
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
