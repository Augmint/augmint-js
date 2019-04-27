import { EventEmitter } from "events";
import PromiEvent from "web3-core-promievent";
import { TransactionObject } from "../abiniser/types/types.js";
import { TransactionError, TransactionSendError } from "./Errors";
import { EthereumConnection } from "./EthereumConnection";

interface ISendOptions {
    from?: string;
    to?: string;
    gasLimit?: number;
    gasPrice?: number;
    nonce?: number;
}

interface ITxToSign extends ISendOptions {
    data: string;
}

/** result from  web3.eth.accounts.signTransaction */
interface ISignedTransaction {
    rawTransaction: string;
    tx: {
        nonce: string;
        gasPrice: string;
        gas: string;
        to: string;
        value: string;
        input: string;
        v: string;
        r: string;
        s: string;
        hash: string;
    };
}

type IWeb3Tx = PromiEvent<any>;

type ITransactionReceipt = any; // TODO: use Web3's type

/**
 * Transaction class to manage Ethereum transactions thourgh it's lifecycle.
 *
 * @example
 *      const testTx = rates.instance.methods.setRate(CCY, 100)
 *      const tx = new Transaction(ethereumConnection, testTx);
 *      tx.on("confirmation", (confirmationNumber, receipt) => {
 *              console.log("confirmation number", confirmationNumber, "recevied.",
 *                          "Tx status:", receipt ? : receipt.status : "No receipt")} );
 *      const txReceipt = await tx.send().getTxConfirmation(5);
 * @export
 * @fires   transactionHash
 * @fires   receipt
 * @fires   confirmation
 * @fires   error               @deprecated - fired in case of any error. kept for backward compatibility
 * @fires   transactionRevert   fired when tx was mined but with REVERT opcode. error also fired in this case for backward compatibility
 * @fires   transactionError    fired when tx errored without mining. error event is also fired in this case for backward compatibility
 * @class Transaction
 * @extends {EventEmitter}
 */
export class Transaction extends EventEmitter {
    public ethereumConnection: EthereumConnection;
    public confirmationCount?: number;
    public txHash?: string;
    public txReceipt?: ITransactionReceipt;

    public tx: TransactionObject<any>; /** web3.js TransactionObject result from .methods.<methodname> */

    public sendOptions: ISendOptions;

    public isTxSent: boolean = false; /** indicate if .send was already called */
    public sentTx?: IWeb3Tx;

    public signedTx?: ISignedTransaction; /** set if signed */

    public sendError?: any; /** if send returned error */

    private signedTxPromise?: Promise<ISignedTransaction>;
    private txReceiptPromise?: Promise<ITransactionReceipt>;
    private txHashPromise?: Promise<string>;
    private txToSign?: ITxToSign; /** Signature data when signing */

    /**
     * Creates an instance of Transaction.
     *
     * @param {EthereumConnection} ethereumConnection
     * @param {TransactionObject<any>} tx   the web3.js transaction object
     * @param {ISendOptions} [sendOptions]  optionally specify any of the send options here or later at sign or send
     * @memberof Transaction
     */
    constructor(ethereumConnection: EthereumConnection, tx: TransactionObject<any>, sendOptions?: ISendOptions) {
        super();
        if (!ethereumConnection || !tx) {
            throw new TransactionError("Both ethereumConnection and tx must be provided for Transaction constructor");
        }
        this.tx = tx;
        this.sendOptions = Object.assign({}, sendOptions);
        this.ethereumConnection = ethereumConnection;
    }

    /**
     * Sign the transaction with the provided private key
     *      and with the from, to, gas in ISendOptions.
     *      ISendOptions can be set in [Transaction] constructor too.
     *      make sure you set at least gasLimit and from.
     * @param {string} privateKey   Private key with leading 0x
     * @param {ISendOptions} sendOptions
     * @returns {Transaction}   the [Transaction] object for chaining. Call [send] or [getSignedTranscation] on it
     * @memberof Transaction
     */
    public sign(privateKey: string, sendOptions: ISendOptions): Transaction {
        if (this.isTxSent) {
            throw new TransactionError("tx was already sent");
        }

        this.sendOptions = Object.assign({}, this.sendOptions, sendOptions);

        if (!this.sendOptions.from) {
            throw new TransactionError("from account is not set for sign");
        }

        this.txToSign = {
            ...this.sendOptions,
            data: this.tx.encodeABI()
        };

        this.signedTxPromise = new Promise(async resolve => {
            this.signedTx = await this.ethereumConnection.web3.eth.accounts.signTransaction(this.txToSign, privateKey);
            resolve(this.signedTx);
        });

        return this;
    }

    public async getSignedTx(): Promise<ISignedTransaction> {
        if (!this.signedTxPromise) {
            throw new TransactionError("call .sign() first to get a signed transaction");
        }
        return this.signedTxPromise;
    }

    public send(sendOptions: ISendOptions): Transaction {
        if (this.isTxSent) {
            throw new TransactionError("tx was already sent");
        }
        this.isTxSent = true;

        this.sendOptions = Object.assign({}, this.sendOptions, sendOptions);

        if (this.signedTxPromise) {
            this.getSignedTx().then(signedTx => {
                if (
                    this.sendOptions.from &&
                    this.txToSign &&
                    this.txToSign.from &&
                    this.sendOptions.from.toLowerCase() !== this.txToSign.from.toLowerCase()
                ) {
                    throw new TransactionError(
                        "tx sign(sendOptions) and send( sendOptions)  mismatch: from is differnt. Either don't provide from in sendOptions for send() or provide the same from address as for sign()"
                    );
                }
                this.sentTx = this.ethereumConnection.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
                this.addTxListeners(this.sentTx);
            });
        } else {
            if (!this.sendOptions.from) {
                throw new TransactionError("from account is not set for send");
            }
            this.sentTx = this.tx.send(Object.assign({}, this.sendOptions)); // webjs writes into passed params (beta36) (added .data to .sendOptions and Metamask hang for long before confirmation apperaed)
            this.addTxListeners(this.sentTx);
        }

        return this;
    }

    public async getTxHash(): Promise<string> {
        if (!this.isTxSent) {
            throw new TransactionError("tx was not sent yet");
        }

        if (!this.txHashPromise) {
            this.txHashPromise = new Promise((resolve, reject) => {
                if (this.txHash) {
                    resolve(this.txHash);
                }
                if (this.sendError) {
                    reject(this.sendError); // tx already rejected and still no txHash
                }

                // tx not resolved yet so wait for our own transactionHash event
                this.once("transactionHash", (hash: string) => {
                    this.txHash = hash;
                    resolve(hash);
                });
                this.once("error", (error: any) => {
                    if (this.txHash) {
                        // tx might rejected wth error but we still need the hash (set by txSent transactionsHash event)
                        resolve(this.txHash);
                    } else {
                        reject(error);
                    }
                });
            });
        }

        return this.txHashPromise;
    }

    public async getTxReceipt(): Promise<ITransactionReceipt> {
        if (!this.isTxSent) {
            throw new TransactionError("tx was not sent yet");
        }

        if (!this.txReceiptPromise) {
            this.txReceiptPromise = new Promise((resolve, reject) => {
                if (this.txReceipt) {
                    resolve(this.txReceipt);
                }
                if (this.sendError) {
                    reject(this.sendError); // if tx already rejected and still no receipt
                }

                // tx not resolved yet so wait for our own transactionHash event
                this.once("receipt", (receipt: ITransactionReceipt) => {
                    resolve(receipt);
                });

                this.once("error", error => {
                    if (this.txReceipt) {
                        resolve(this.txReceipt);
                    } else {
                        reject(error);
                    }
                });
            });
        }

        return this.txReceiptPromise;
    }

    public async getConfirmedReceipt(confirmationNumber: number = 1): Promise<ITransactionReceipt> {
        if (!this.isTxSent) {
            throw new TransactionError("tx was not sent yet");
        }

        if (this.confirmationCount && this.confirmationCount >= confirmationNumber) {
            return this.txReceipt;
        }

        const txConfirmationPromise: Promise<ITransactionReceipt> = new Promise((resolve, reject) => {
            if (this.sendError && !this.txReceipt) {
                reject(this.sendError); // if tx already rejected and still no receipt
            }

            this.on("confirmation", (confNum: number, receipt: ITransactionReceipt) => {
                if (confNum >= confirmationNumber) {
                    resolve(receipt);
                }
            });

            // TODO: reject after x blocks if no confirmation received
        });

        return txConfirmationPromise;
    }

    private addTxListeners(tx: IWeb3Tx) {
        tx.once("transactionHash", (hash: string) => {
            this.txHash = hash;

            this.emit("transactionHash", hash);
        })
            .once("receipt", (receipt: ITransactionReceipt) => {
                this.txReceipt = receipt;
                this.emit("receipt", this.txReceipt);
            })

            .on("error", async (error: any, receipt?: ITransactionReceipt) => {
                if (this.txHash) {
                    if (!this.txReceipt) {
                        // workaround that web3js beta36 is not emmitting receipt event when tx fails on tx REVERT
                        this.txReceipt = await this.ethereumConnection.web3.eth.getTransactionReceipt(this.txHash);
                        this.emit("receipt", this.txReceipt);
                    }

                    // workaround that web3js beta36 is not emmitting confirmation events when tx fails on tx REVERT
                    this.sentTx.on("confirmation", (confirmationNumber: number, _receipt: ITransactionReceipt) => {
                        this.confirmationCount = confirmationNumber;
                        this.emit("confirmation", confirmationNumber, _receipt);
                    });

                    this.emit("transactionRevert", this.txReceipt);
                } else {
                    this.emit("transactionError", error);
                }
                this.sendError = new TransactionSendError(error);
                this.emit("error", this.sendError, receipt);
            })
            .on("confirmation", (confirmationNumber: number, receipt: ITransactionReceipt) => {
                this.confirmationCount = confirmationNumber;

                this.emit("confirmation", confirmationNumber, this.txReceipt);
            });
    }
}
