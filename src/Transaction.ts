import BigNumber from "bignumber.js";
import { EventEmitter } from "events";
import PromiEvent from "web3-core-promievent";
import { TransactionObject } from "../generated/types/types";
import { TransactionError, TransactionSendError } from "./Errors";
import { EthereumConnection } from "./EthereumConnection";

interface ISendOptions {
    from?: string;
    to?: string;
    gasLimit?: number;
    gasPrice?: number;
    nonce?: number;
    value?: BigNumber;
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
 * Recommended use:
 *  @example
 *     const ethereumConnection = new EthereumConnection(config);
 *     const rates = new Rates();
 *     await rates.connect()
 *     rates.setRate("USD", 121.12)
 *       .[sign(privatekey, {from: acc, to:rates.address})]  // optionally you can sign
 *       .send([{from: acc}]) // from only needed if it's not signed
 *       .onceTxHash( txHash => {.. })
 *       .onceReceipt( receipt => { ...})
 *       .onConfirmation( (confirmationNumber, receipt) => {...}
 *       .onceReceiptConfirmed(5, receipt => {...})
 *       .onceTxRevert( (error, receipt) => { ....})
 *
 *  // To catch errors you need to use txHash / confirmation / receipt getters:
 *  try {
 *    const txHash = await tx.getTxHash()
 *    const txReceipt = await tx.getReceipt() // receipt as soon as got it (even with 0 confirmation)
 *    const confirmedReceipt = await tx.getConfirmedReceipt(12) // receipt after x confirmation.
 *    // receipt you need to check for receipt.status if tx was Reverted or not.
 *    if (confirmedReceipt.status) {
 *      // all good
 *    } else {
 *      // this tx was reverted
 *    }
 *  } catch (error) {
 *     // These Promises are rejecting with sending errors or when txhash / receipt times out.
 * }
 *
 * // Deprecated and discouraged but kept for backward compatibility  with web3js style events:
 *  tx.on[ce]("transactionHash" | "receipt" | "confirmation" | "error")
 * // This way it can be easily plugged into dapps which are handling web3js tx objects:
 * //   augmint-js Transaction object can be a drop in as an almost direct replacement of webjs transactioObject
 *
 * // To construct a transaction:
 *  const web3TxObject = rates.instance.methods.setRate(CCY, 100)
 *  const augmintRatesTx = new Transaction(ethereumConnection, web3TxObject, {gasLimit: 200000}); // you can set the gaslimit here or later at send() too
 *  augmintRatesTx.send(...).onTxHash(...)  // or sign().send() etc.
 *
 *
 * @export
 * @fires   transactionHash
 * @fires   receipt     fired as soon as a receipt received
 * @fires   confirmation    fired for each confirmation
 * @fires   error       @deprecated - fired in case of any error. kept for backward compatibility
 * @fires   txRevert   fired when tx was mined but with REVERT opcode. error also fired in this case for backward compatibility
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

    public sendError?: any; /** if send returned error or tx REVERT error */

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
            try {
                this.sentTx = this.tx.send(Object.assign({}, this.sendOptions)); // webjs writes into passed params (beta36) (added .data to .sendOptions and Metamask hang for long before confirmation apperaed)
            } catch (error) {
                this.sendError = new TransactionSendError(error);
                throw this.sendError;
            }
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
                        // it's a tx revert. we still return the hash.
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

    public onceTxRevert(callback: (error: any, receipt: ITransactionReceipt) => any): Transaction {
        this.once("txRevert", callback);
        return this;
    }

    public onceTxHash(callback: (txHash: string) => any): Transaction {
        this.once("transactionHash", callback);
        return this;
    }

    public onceReceipt(callback: (receipt: ITransactionReceipt) => any): Transaction {
        this.once("receipt", callback);
        return this;
    }

    public onConfirmation(callback: (confirmationNumber: number, receipt: ITransactionReceipt) => any): Transaction {
        this.on("confirmation", callback);
        return this;
    }

    public onceConfirmedReceipt(
        confirmationNumber: number,
        callback: (receipt: ITransactionReceipt) => any
    ): Transaction {
        this.once("transactionHash", async () => {
            const receipt: ITransactionReceipt = await this.getConfirmedReceipt(confirmationNumber);
            callback(receipt);
        });
        return this;
    }

    private addTxListeners(tx: IWeb3Tx): void {
        tx.once("transactionHash", (hash: string) => {
            this.txHash = hash;

            this.emit("transactionHash", hash);
        })
            .once("receipt", (receipt: ITransactionReceipt) => {
                if (!this.txReceipt) {
                    // in case "error" triggered earlier we already have a receipt
                    this.txReceipt = receipt;
                }
                this.emit("receipt", this.txReceipt);
            })

            .on("error", async (error: any, receipt?: ITransactionReceipt) => {
                this.sendError = new TransactionSendError(error);

                if (this.txHash) {
                    if (!this.txReceipt) {
                        // workaround that web3js beta36 is not emmitting receipt event when tx fails on tx REVERT
                        this.txReceipt = await this.ethereumConnection.web3.eth.getTransactionReceipt(this.txHash);
                        this.emit("receipt", this.txReceipt);
                    }

                    // workaround that web3js beta36 is not emmitting confirmation events when tx fails on tx REVERT
                    //   NB: we are using the tx receipt fetched earlier because the format is slightly different
                    this.sentTx.on("confirmation", (confirmationNumber: number, _receipt: ITransactionReceipt) => {
                        this.confirmationCount = confirmationNumber;
                        this.emit("confirmation", confirmationNumber, this.txReceipt);
                    });

                    this.emit("txRevert", this.sendError, this.txReceipt);
                }

                this.emit("error", this.sendError, this.txReceipt);
            })
            .on("confirmation", (confirmationNumber: number, receipt: ITransactionReceipt) => {
                this.confirmationCount = confirmationNumber;
                this.emit("confirmation", confirmationNumber, this.txReceipt);
            });
    }
}
