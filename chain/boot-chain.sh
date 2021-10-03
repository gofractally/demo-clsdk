#!/bin/env bash

set -ex

# clsdk-provided token contract
CONTRACTS=$(realpath -e `dirname \`which clsdk-cmake-args\``/../contracts)

# Create a wallet (job 1)
cleos wallet stop
rm -rf ../chain/wallet
mkdir ../chain/wallet
keosd --wallet-dir `pwd`/../chain/wallet &
cleos wallet create -f ../chain/wallet-password

# Well-known development password, ideal for contract-pays advertised key
# Also used for block-production
cleos wallet import --private-key 5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3 # EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV

# eosio, eosio.token, other accounts needed by eosio.system
cleos wallet import --private-key 5KJ3dNbr95U4ucyWKt63wW1uVMBUujVAJhvVifTmkGMXEjimxhZ # EOS4wR9VQ69GFFZV2uYJaa1CPcNyfAwkGaqSVbPCcJagkNxBJqC31

# thepayer owner and active (non-advertised keys)
cleos wallet import --private-key 5JC2ZsC1UGvueruip6zakGZyCFYsg45SKmyfjqfFqecxx5LSkak # EOS5CNJPSYahh1bjyQ72oLqipNAtd5Y9bJL34kfZPEoHEHDZRkLtm

# freetalk (contract)
cleos wallet import --private-key 5JUKcCjQtdd8RyySFpyC8BJSmUqr4ys6EKvrXqB7SFto8f4hYkG # EOS5DUZjc6MKAx6qiHZghZ9nBpwyuqtVx6nkcecHeag3x4jtxR3gZ

# bob
cleos wallet import --private-key 5Khijcg4ALiGh5fi6z6rjCfD9iDrSeBK5zxqwdXWgjxVCBsfNUy # EOS61yGzPxQiHVseZ9cFyyZQRjE64GTYWj8reuYZ76JTFx1qLudcB

# sue
cleos wallet import --private-key 5J9SitMtJTKAL1ytNzsFhFN8c4J1QED67w7Nfe6fD3VB89XSLEN # EOS6B8JCMviaj8b96RHj23QTJKPWiUBrsygGM5iNfsvK7axHWFofF

# joe
cleos wallet import --private-key 5K9aTPoqoyGi7ZJ5W1pwmxMfEcpNF37dpzkDjEXhEv5JyVXBqAH # EOS6f1Uy3ZHGxxZa1d6xd5jBgDJKxK5MVtuv3iWm9uhcA7dmKspdN

# alice
cleos wallet import --private-key 5JF6YU9NqV6r2HfwsmXvMXmBcEX57uBGj9qekBJWcBEux1EQCdo # EOS85GsBoo1rKLohgJkkmX6PRBGnH3TckWH3GNZRdo9CaHV6b3XHV

# nodeos (job 2)
rm -rf temp-chain
mkdir temp-chain
nodeos -d temp-chain --config-dir temp-chain --plugin eosio::chain_api_plugin --plugin eosio::producer_api_plugin -e -p eosio >nodeos.log 2>&1 &
sleep 1

# Replace eosio key, but not block-production key
cleos push action eosio updateauth '["eosio", "owner", "", {threshold : 1, keys : [{key : "EOS4wR9VQ69GFFZV2uYJaa1CPcNyfAwkGaqSVbPCcJagkNxBJqC31", weight : 1}], accounts : [], waits : []}]' -p eosio@owner
cleos push action eosio updateauth '["eosio", "active", "owner", {threshold : 1, keys : [{key : "EOS4wR9VQ69GFFZV2uYJaa1CPcNyfAwkGaqSVbPCcJagkNxBJqC31", weight : 1}], accounts : [], waits : []}]' -p eosio@owner

# eosio.token
cleos create account eosio eosio.token EOS4wR9VQ69GFFZV2uYJaa1CPcNyfAwkGaqSVbPCcJagkNxBJqC31
cleos set code eosio.token $CONTRACTS/token.wasm
cleos set abi eosio.token $CONTRACTS/token.abi
cleos push action eosio.token create '["eosio", "1000000000.0000 EOS"]' -p eosio.token
cleos push action eosio.token issue '["eosio", "1000000000.0000 EOS", "yo"]' -p eosio

# accounts needed by eosio.system
cleos create account eosio eosio.ram EOS4wR9VQ69GFFZV2uYJaa1CPcNyfAwkGaqSVbPCcJagkNxBJqC31
cleos create account eosio eosio.ramfee EOS4wR9VQ69GFFZV2uYJaa1CPcNyfAwkGaqSVbPCcJagkNxBJqC31
cleos create account eosio eosio.stake EOS4wR9VQ69GFFZV2uYJaa1CPcNyfAwkGaqSVbPCcJagkNxBJqC31
cleos create account eosio eosio.bpay EOS4wR9VQ69GFFZV2uYJaa1CPcNyfAwkGaqSVbPCcJagkNxBJqC31
cleos create account eosio eosio.vpay EOS4wR9VQ69GFFZV2uYJaa1CPcNyfAwkGaqSVbPCcJagkNxBJqC31
cleos create account eosio eosio.names EOS4wR9VQ69GFFZV2uYJaa1CPcNyfAwkGaqSVbPCcJagkNxBJqC31
cleos create account eosio eosio.saving EOS4wR9VQ69GFFZV2uYJaa1CPcNyfAwkGaqSVbPCcJagkNxBJqC31
cleos create account eosio eosio.rex EOS4wR9VQ69GFFZV2uYJaa1CPcNyfAwkGaqSVbPCcJagkNxBJqC31
cleos create account eosio eosio.reserv EOS4wR9VQ69GFFZV2uYJaa1CPcNyfAwkGaqSVbPCcJagkNxBJqC31

# Install the system contract
curl -X POST http://127.0.0.1:8888/v1/producer/schedule_protocol_feature_activations -d '{"protocol_features_to_activate": ["0ec7e080177b2c02b278d5088611686b49d739925a92d9bfcacd7fc6b74053bd"]}'
sleep 2
cleos set code eosio boot.wasm
cleos set abi eosio boot.abi
cleos push action eosio boot '[]' -p eosio
sleep 2
cleos set code eosio ../chain/eosio.system.wasm
cleos set abi eosio ../chain/eosio.system.abi
cleos push action eosio init '[0, "4,EOS"]' -p eosio

# freetalk contract
cleos system newaccount eosio freetalk EOS5DUZjc6MKAx6qiHZghZ9nBpwyuqtVx6nkcecHeag3x4jtxR3gZ --buy-ram-kbytes 4096 --stake-net "1000.0000 EOS" --stake-cpu "1000.0000 EOS"
cleos set code freetalk freetalk.wasm
cleos set abi freetalk freetalk.abi

# thepayer; account used for contract-pays
#   * thepayer@freebie
#       * Uses the well-known key EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV
#       * Can only authorize `freetalk.acceptcharge`
#       * Restricted from using `updateauth`, `deleteauth`, `linkauth`, and `unlinkauth`
#   * --buy-ram-bytes is set low enough where thepayer ends up with 0 bytes available after these commands.
#     This is so thepayer@active can't waste RAM creating deferred transactions.
cleos system newaccount eosio thepayer EOS5CNJPSYahh1bjyQ72oLqipNAtd5Y9bJL34kfZPEoHEHDZRkLtm --buy-ram-bytes 2343 --stake-net "1000.0000 EOS" --stake-cpu "1000.0000 EOS"
cleos push action eosio limitauthchg '["thepayer", ["owner","active"], []]' -p thepayer@active
cleos push action eosio updateauth '["thepayer", "freebie", "active", {threshold : 1, keys : [{key : "EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV", weight : 1}], accounts : [], waits : []}, "active"]' -p thepayer@active
cleos push action eosio linkauth '["thepayer", "freetalk", "acceptcharge", "freebie", "active"]' -p thepayer@active

# User accounts
cleos system newaccount eosio bob EOS61yGzPxQiHVseZ9cFyyZQRjE64GTYWj8reuYZ76JTFx1qLudcB --buy-ram-kbytes 4096 --stake-net "1000.0000 EOS" --stake-cpu "1000.0000 EOS"
cleos system newaccount eosio sue EOS6B8JCMviaj8b96RHj23QTJKPWiUBrsygGM5iNfsvK7axHWFofF --buy-ram-kbytes 4096 --stake-net "1000.0000 EOS" --stake-cpu "1000.0000 EOS"
cleos system newaccount eosio joe EOS6f1Uy3ZHGxxZa1d6xd5jBgDJKxK5MVtuv3iWm9uhcA7dmKspdN --buy-ram-kbytes 4096 --stake-net "1000.0000 EOS" --stake-cpu "1000.0000 EOS"
cleos system newaccount eosio alice EOS85GsBoo1rKLohgJkkmX6PRBGnH3TckWH3GNZRdo9CaHV6b3XHV --buy-ram-kbytes 4096 --stake-net "1000.0000 EOS" --stake-cpu "1000.0000 EOS"

# Save the blocks log
sleep 2
kill %2
sleep 2
rm -rf ../chain/data
mkdir -p ../chain/data/blocks
cp temp-chain/blocks/blocks.log ../chain/data/blocks

# cleos wallet stop
