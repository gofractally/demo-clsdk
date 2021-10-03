# contract-pays demo

This demonstrates how to use the contract-pays proposal at [https://github.com/eoscommunity/eosio.contracts/pull/1](https://github.com/eoscommunity/eosio.contracts/pull/1).

## Demo container

This container has the pre-built code running on a pre-generated chain running inside `code-server` (vscode in a browser).

```
docker run -it -p 8080:8080 -p 8888:8888 ghcr.io/eoscommunity/demo-clsdk:contract-pays
```

Open http://localhost:3000/

## clsdk

This demonstration uses clsdk to build. See installation instructions at https://github.com/eoscommunity/demo-clsdk

## Build

```sh
mkdir build
cd build
cmake `clsdk-cmake-args` ..
make -j
../chain/boot-chain.sh
```

## Starting the chain

From the repo root:

```sh
nodeos -d chain/data --config-dir chain/data --plugin eosio::chain_api_plugin --plugin eosio::history_api_plugin -f "*" --access-control-allow-origin '*' -e -p eosio
```

## Building and starting the webapp

```sh
cd webapp
yarn
yarn build
yarn start
```

The demo should now be running on http://localhost:3000

## Description of the webapp

* "Generate Session Key Pair" generates a new public and private key
* "Submit Session Key Pair" submits the new session key to the chain
  * This uses the `freetalk.registerkey` action.
  * It doesn't modify the user's permissions.
* "Post using Session Key"
  * This uses the `freetalk.acceptcharge` and `freetalk.createpost` actions.
  * `thepayer@freebie` authorizes `freetalk.acceptcharge` using a well-publicized private key. This pays for the transaction.
  * There are no authorizations on `freetalk.createpost`. Instead, one of the arguments is a signature using the session key pair.

Try this:
* Click "Generate Session Key Pair"
* Click "Submit Session Key Pair"
* Clear out the User private key (not the session private key)
* Click "Post using Session Key"
  * Note that each time a user posts, they must bump up the Sequence number by 1. This is a replay attack mitigation.
* Click "Get Posts"

## thepayer

* `thepayer@freebie` can authorize `freetalk.acceptcharge` only. It can't authorize any other actions.
* `freetalk.acceptcharge` examines the transaction, verifying that it is a transaction that `thepayer` is willing to pay for. See [freetalk.cpp](freetalk.cpp) for how this is done.
* `thepayer` opted into restrictions using `eosio.limitauthchg`. This prevents `thepayer@freebie` from using `updateauth`, `deleteauth`, `linkauth`, and `unlinkauth`. See [boot-chain.sh](chain/boot-chain.sh) to see how `thepayer` set this up.
