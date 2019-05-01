<span style="display:block;text-align:center">![Augmint](http://www.augmint.cc/android-chrome-192x192.png)
</span>

# Augmint - Stable Digital Tokens - Javascript Library (WIP)

[![Build Status](https://travis-ci.org/Augmint/augmint-js.svg?branch=staging)](https://travis-ci.org/Augmint/augmint-js)
[![Discord](https://img.shields.io/discord/407574313810788364.svg)](https://discord.gg/PwDmsnu)
[![license](https://img.shields.io/github/license/Augmint/augmint-js.svg)](https://github.com/Augmint/augmint-js/blob/master/LICENSE) [![Greenkeeper badge](https://badges.greenkeeper.io/Augmint/augmint-js.svg)](https://greenkeeper.io/)

Decentralised stable cryptocurrency on Ethereum

## augmint-js lib

This lib is heavily under construction. Anything can happen.

### Install

```
yarn add @augmint/js
```

or

```
yarn install @augmint/js
```

### Example use

```js
import { Augmint } from "@augmint/js";

let web3;

// Modern dapp browsers...
if (window.ethereum) {
  web3 = new Web3(window.ethereum);
  await window.ethereum.enable();
} else if (typeof window.web3 !== "undefined") {
  // Legacy dapp browsers...
  web3 = new Web3(window.web3.currentProvider);
} else {
   // no web3... augmint-js still can be used via Infura websocket connection
}

let connectionConfig;
if (web3) {
  // For connection via injected provider:
  connectionConfig = {
    givenProvider: web3.currentProvider,
    // We assume that injected Metamask/Trustwallet/Metacoin etc. provider takes care of reconnections
    ETHEREUM_CONNECTION_CHECK_INTERVAL: 0
  };
} else {
  // For connection via Infura (not passing givenProvider)
  connectionConfig = {
    PROVIDER_URL: "wss://rinkbey.infura.io/ws/v3/", // or wss://mainnet.infura.io/ws/v3/ or  ws://localhost:8545
    PROVIDER_TYPE: "websocket",
    INFURA_PROJECT_ID: "" // this should come from env.local or hosting env setting
  };
}

const augmint = await Augmint.create(connectionConfig);

augmint.rates.setRate(CCY, rate)
  // optionally you can sign with a privatekey
  // .sign(privatekey, {from: "0x06012c8cf97BEaD5deAe237070F9587f8E7A266d"} )
  //
  // or send it if provider like MetaMask manages the signature for the given sender address
  .send([{ from: "0x06012c8cf97BEaD5deAe237070F9587f8E7A266d" }]) // {from: 0x..} only needed if it's not signed
  .onceTxHash( txHash => {.. })
  .onceReceipt( receipt => { ...})
  .onConfirmation( (confirmationNumber, receipt) => {...}
  .onceReceiptConfirmed(5, receipt => {...})
  .onceTxRevert( (error, receipt) => { ....});

// To catch errors you need to use txHash / confirmation / receipt getters:
try {
  const txHash = await tx.getTxHash();

  // receipt as soon as we got it (even with 0 confirmation):
  const txReceipt = await tx.getReceipt();

  // receipt after x confirmation:
  const confirmedReceipt = await tx.getConfirmedReceipt(12);

} catch (error) {
  // These Promises are rejecting with sending errors but not when tx reverts!
  // Also, you need to take care of timeouts. E.g. use Augmint.utils.promiseTimeout()
 }

 // receipt you need to check for receipt.status if tx was Reverted or not.
if (confirmedReceipt.status) {
  // all good
} else {
  // this tx was reverted
}
```

Specs: [test/Transaction.test.js](https://github.com/Augmint/augmint-js/blob/tx_reorg/test/Transaction.test.js)

### More examples

-   [test/Rates.setters.test.js](https://github.com/Augmint/augmint-js/blob/tx_reorg/test/Rates.setters.test.js)
-   [test/Exchange.Matching.onchain.test.js](https://github.com/Augmint/augmint-js/blob/tx_reorg/test/Exchange.Matching.onchain.test.js)

### Web3.js event style

Deprecated and discouraged but kept for backward compatibility with web3js style events:

```js
tx.on[ce]("transactionHash" | "receipt" | "confirmation" | "error");
// This way it can be easily plugged into dapps which are handling web3js tx objects:
//   augmint-js Transaction object can be a drop in as an almost direct replacement of webjs transactioObject
```

Specs: [test/Transaction.web3jsStyle.test.js](https://github.com/Augmint/augmint-js/blob/tx_reorg/test/Transaction.web3jsStyle.test.js)

### Construct a transaction with [`Transaction`](./src/Transaction.ts) class

It's likely not needed for ordinary `augmint-js` use

```js
 const web3TxObject = rates.instance.methods.setRate(CCY, 100)
 // you can set the gaslimit here or later at send() too
 const augmintRatesTx = new Transaction(ethereumConnection, web3TxObject, { gasLimit: 200000 } );
 augmintRatesTx.send(...).onTxHash(...)  // or sign().send() etc.
```

## augmint-cli

For local development: launch a docker container with test augmint contracts in ganache

```
$ yarn augmint-cli  # NB: if you are running from within the augmin-js repo then: ./scripts/augmint-cli.sh

augmint-cli : start / stop augmint contracts. Docker image: augmint/contracts:vx.x.x

    Usage: /usr/local/bin/augmint-cli ganache {start | stop | run}
      start: tries to start container named ganache . If fails then runs (downloads, creates and starts) the container from augmint/contracts:vx.x.x
      stop: plain docker stop augmint/contracts:vx.x.x (doesn't check if exists)
      run: stops and removes the ganache container if exists. then runs it
```

Also recreates the container if it exists but image is not as expected (ie. there was a version upgrade)

## Concept

Augmint provides digital tokens, value of each token pegged to a fiat currency.

The first Augmint token is A-EUR (Augmint Euro), pegged to EUR.

The value of 1 A-EUR is always closely around 1 EUR.

**[White paper](http://bit.ly/augmint-wp)**

Try it: **[www.augmint.org](http://www.augmint.org)**

**[Our Trello board](https://trello.com/b/RYGAt2so/augmint-documents)** with a collection of documents about the project.

## Other components

[Web frontend](https://github.com/Augmint/augmint-web)

[Solidity contracts](https://github.com/Augmint/augmint-contracts)

## Contributions

Augmint is an open and transparent project.

We are seeking for great minds to extend our core team. Contribution in any area is much appreciated: development, testing, UX&UI design, legal, marketing spreading the word etc.

## Get in touch

Drop us an email: hello@augmint.cc

Say hi on our [Discord server](https://discord.gg/PwDmsnu): [![Discord](https://img.shields.io/discord/407574313810788364.svg)](https://discord.gg/PwDmsnu)

Talk to us on [Telegram](https://t.me/augmint)

## Authors

Check the team at [www.augmint.org](https://www.augmint.org)

The project was born at [DECENT Labs](http://www.decent.org)

### Concept, initial version

-   [szerintedmi](https://github.com/szerintedmi)
-   [Charlie](https://github.com/krosza)

Check the whole team on [augmint.org](http://www.augmint.org)

## Licence

This project is licensed under the GNU Affero General Public License v3.0 license - see the [LICENSE](LICENSE) file for details.
