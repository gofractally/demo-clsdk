# Chain setup

This folder contains:
* `eosio.system.wasm` and `eosio.system.abi`
    * Includes a new action, `limitauthchg`, which imposes restrictions on `updateauth`, `deleteauth`, `linkauth`, and `unlinkauth`
    * built from [https://github.com/eoscommunity/eosio.contracts/pull/1](https://github.com/eoscommunity/eosio.contracts/pull/1) at commit 8ae47b7c36f9c499bf6dc22b6d1eb6f884102ad3
* [`boot.cpp`](boot.cpp)
    * Enables set set of protocol features (hard forks) currently on EOS
    * `eosio.system` requires some of these
* [`boot-chain.sh`](add_keys.sh)
    * Bootstraps a new keosd wallet
    * Bootstraps a chain with `eosio.system` and `freetalk`

This folder also contains (docker container only):
* `wallet`: keosd wallet
* `wallet-password`: password for wallet
* `data`: block chain
