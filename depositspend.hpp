// This example contract demonstrates the deposit-and-spend pattern.

#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>

// The dispatcher expects the contract class to be in a namespace
namespace depositspend
{
   // Ricardian contracts live in depositspend-ricardian.cpp
   extern const char* withdraw_ricardian;
   extern const char* buydog_ricardian;
   extern const char* buycat_ricardian;

   // The account this contract is normally deployed to
   inline constexpr auto default_contract_account = "depositspend"_n;

   // Default scope for tables
   inline constexpr uint64_t default_scope = 0;

   // Only accept tokens managed by this contract
   inline constexpr auto token_contract = "eosio.token"_n;

   // Only accept this token
   inline constexpr eosio::symbol token_symbol{"EOS", 4};

   // The price of various animals
   inline constexpr eosio::asset dog_price{"1000.0000 EOS", eosio::no_check};
   inline constexpr eosio::asset cat_price{"0.1000 EOS", eosio::no_check};

   // This table keeps track of each user's token balance and the number
   // of dogs and cats owned.
   struct account
   {
      eosio::name owner;
      eosio::asset balance;
      uint32_t num_dogs = 0;
      uint32_t num_cats = 0;

      uint64_t primary_key() const { return owner.value; }
   };
   EOSIO_REFLECT(account, owner, balance, num_dogs, num_cats)
   typedef eosio::multi_index<"accounts"_n, account> accounts;

   // Give the tester and other contracts an easy way to read the table
   inline eosio::asset get_balance(eosio::name contract, eosio::name owner)
   {
      accounts table(contract, default_scope);
      auto record = table.find(owner.value);
      if (record != table.end())
         return record->balance;
      return eosio::asset{0, token_symbol};
   }

   // The contract
   struct depositspend_contract : public eosio::contract
   {
      // Use the base class constructors
      using eosio::contract::contract;

      // Notification of transfers from token_contract
      void notify_transfer(eosio::name from,
                           eosio::name to,
                           const eosio::asset& quantity,
                           std::string memo);

      // Action: user withdraws their remaining tokens
      void withdraw(eosio::name user, const eosio::asset& quantity);

      // Action: user buys a dog
      void buydog(eosio::name user, eosio::name dog, const eosio::asset& price);

      // Action: user buys a cat
      void buycat(eosio::name user, eosio::name cat, const eosio::asset& price);

      // Functions to modify the table (not actions)
      void add_balance(eosio::name owner, const eosio::asset& value);
      void sub_balance(eosio::name owner, const eosio::asset& value, auto modify_fields);
   };

   // This macro:
   // * Creates a part of the dispatcher
   // * Defines action wrappers which make it easy for other contracts and for test cases to invoke
   //   this contract's actions
   // * Optional: provides the names of actions to the ABI generator. Without this, the ABI
   //   generator will make up names (e.g. arg0, arg1, arg2, ...).
   // * Optional: provides ricardian contracts to the ABI generator. Without this, the ABI generator
   //   will leave the ricardian contracts blank.
   EOSIO_ACTIONS(depositspend_contract,
                 default_contract_account,
                 action(withdraw, user, quantity, ricardian_contract(withdraw_ricardian)),
                 action(buydog, user, dog, price, ricardian_contract(buydog_ricardian)),
                 action(buycat, user, cat, price, ricardian_contract(buycat_ricardian)),
                 notify(token_contract, transfer))
}  // namespace depositspend
