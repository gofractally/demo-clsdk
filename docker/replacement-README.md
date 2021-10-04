# contract-pays demo

The repo is checked out, the sources are built, and the demo is ready to go!

This demonstrates how to use the contract-pays proposal at [https://github.com/eoscommunity/eosio.contracts/pull/1](https://github.com/eoscommunity/eosio.contracts/pull/1).

## Starting the chain

Open a new terminal using `ctrl + shift + backtick`

```sh
nodeos -d chain/data --config-dir chain/data --plugin eosio::chain_api_plugin --plugin eosio::history_api_plugin -f "*" --http-server-address 0.0.0.0:8888 --access-control-allow-origin '*' --http-validate-host 0 -e -p eosio
```

## Starting the webapp

Open a new terminal using `ctrl + shift + backtick`

```sh
cd webapp
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

## cleos

To unlock the wallet to enable cleos, run the following in the repo root:

```sh
keosd --wallet-dir `pwd`/chain/wallet &
cleos wallet unlock --password `cat chain/wallet-password`
```

Verify that `thepayer@freebie` can't change the key:

```sh
# Attacker doesn't know it's locked down
$ cleos push action eosio updateauth '["thepayer", "freebie", "active", {threshold : 1, keys : [{key : "EOS61yGzPxQiHVseZ9cFyyZQRjE64GTYWj8reuYZ76JTFx1qLudcB", weight : 1}], accounts : [], waits : []}]' -p thepayer@freebie

assertion failure with message: authorized_by is required for this account

# Attacker tries filling in the extra argument
$ cleos push action eosio updateauth '["thepayer", "freebie", "active", {threshold : 1, keys : [{key : "EOS61yGzPxQiHVseZ9cFyyZQRjE64GTYWj8reuYZ76JTFx1qLudcB", weight : 1}], accounts : [], waits : []}, "freebie"]' -p thepayer@freebie

assertion failure with message: authorized_by does not appear in allow_perms

# Attacker tries filling in the extra argument with something different
$ cleos push action eosio updateauth '["thepayer", "freebie", "active", {threshold : 1, keys : [{key : "EOS61yGzPxQiHVseZ9cFyyZQRjE64GTYWj8reuYZ76JTFx1qLudcB", weight : 1}], accounts : [], waits : []}, "active"]' -p thepayer@freebie

missing authority of thepayer/active

# Only owner or active can really change it
$ cleos push action eosio updateauth '["thepayer", "freebie", "active", {threshold : 1, keys : [{key : "EOS61yGzPxQiHVseZ9cFyyZQRjE64GTYWj8reuYZ76JTFx1qLudcB", weight : 1}], accounts : [], waits : []}, "active"]' -p thepayer@active

executed transaction: 0cb6881896d153ed5ee40f11819054d08fca208173e2d9b79d72ee3f853d4800  168 bytes  249 us
```
