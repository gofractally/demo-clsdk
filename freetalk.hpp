// This example contract demonstrates the deposit-and-spend pattern.

#pragma once

#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>

// The dispatcher expects the contract class to be in a namespace
namespace freetalk
{
   // Ricardian contracts live in freetalk-ricardian.cpp
   extern const char* acceptcharge_ricardian;
   extern const char* registerkey_ricardian;
   extern const char* createpost_ricardian;

   // The account this contract is normally deployed to
   inline constexpr auto default_contract_account = "freetalk"_n;

   // Default scope for tables
   inline constexpr uint64_t default_scope = 0;

   // Check eden members from this contract
   inline constexpr auto eden_account = "test2.edev"_n;

   // Eden member table
   struct eden_member
   {
      eosio::varuint32 version;
      eosio::name account;
      uint64_t primary_key() const { return account.value; }
   };
   EOSIO_REFLECT(eden_member, version, account)
   using eden_member_table = eosio::multi_index<"member"_n, eden_member>;

   // This table keeps track of each user's public key and their next sequence number.
   struct userkey
   {
      eosio::name user;
      eosio::public_key key;
      std::vector<eosio::varuint32> sequences;

      uint64_t primary_key() const { return user.value; }
   };
   EOSIO_REFLECT(userkey, user, key, sequences)
   typedef eosio::multi_index<"userkey"_n, userkey> userkey_table;

   struct post
   {
      eosio::name user;
      uint32_t sequence;
      std::string message;
   };
   EOSIO_REFLECT(post, user, sequence, message)

   // The contract
   struct freetalk_contract : public eosio::contract
   {
      // Use the base class constructors
      using eosio::contract::contract;

      // Action: register key with user
      void registerkey(eosio::name user, const eosio::public_key& key);

      // Action: create a new post. Verifies the signature instead of doing typical auth checking.
      //         Uses the sequence number to prevent replay attacks.
      void createpost(const eosio::signature& signature, eosio::ignore<post> post);
   };

   // This macro:
   // * Creates a part of the dispatcher
   // * Defines action wrappers which make it easy for other contracts and for test cases to invoke
   //   this contract's actions
   // * Optional: provides the names of actions to the ABI generator. Without this, the ABI
   //   generator will make up names (e.g. arg0, arg1, arg2, ...).
   // * Optional: provides ricardian contracts to the ABI generator. Without this, the ABI generator
   //   will leave the ricardian contracts blank.
   EOSIO_ACTIONS(freetalk_contract,
                 default_contract_account,
                 action(registerkey, user, key, ricardian_contract(registerkey_ricardian)),
                 action(createpost, signature, post, ricardian_contract(createpost_ricardian)))
}  // namespace freetalk
