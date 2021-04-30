#include "depositspend.hpp"

#include <token/token.hpp>  // Fetch action wrappers from the token contract

namespace depositspend
{
   void depositspend_contract::notify_transfer(eosio::name from,
                                               eosio::name to,
                                               const eosio::asset& quantity,
                                               std::string memo)
   {
      // Only track incoming transfers
      if (from == get_self())
         return;

      // The dispatcher has already checked the token contract. We need to check the
      // token type.
      eosio::check(quantity.symbol == token_symbol, "This contract does not deal with this token");
      add_balance(from, quantity);
   }

   void depositspend_contract::withdraw(eosio::name user, const eosio::asset& quantity)
   {
      require_auth(user);
      eosio::check(quantity.symbol == token_symbol, "This contract does not deal with this token");

      // Record the withdrawal
      sub_balance(user, quantity, [](auto&) {});

      // Send the funds
      token::actions::transfer{token_contract, get_self()}.send(  //
          get_self(), user, quantity, "withdraw");
   }

   void depositspend_contract::buydog(eosio::name user, eosio::name dog, const eosio::asset& price)
   {
      require_auth(user);
      eosio::check(price == dog_price, "incorrect price for a dog");
      sub_balance(user, price, [](auto& account) { ++account.num_dogs; });
   }

   void depositspend_contract::buycat(eosio::name user, eosio::name cat, const eosio::asset& price)
   {
      require_auth(user);
      eosio::check(price == cat_price, "incorrect price for a cat");
      sub_balance(user, price, [](auto& account) {
         // buy one, get one free sale
         account.num_cats += 2;
      });
   }

   void depositspend_contract::add_balance(eosio::name owner, const eosio::asset& quantity)
   {
      accounts table(get_self(), default_scope);
      auto record = table.find(owner.value);
      if (record == table.end())
         table.emplace(get_self(), [&](auto& a) {
            a.owner = owner;
            a.balance = quantity;
         });
      else
         table.modify(record, eosio::same_payer, [&](auto& a) { a.balance += quantity; });
   }

   void depositspend_contract::sub_balance(eosio::name owner,
                                           const eosio::asset& quantity,
                                           auto modify_fields)
   {
      accounts table(get_self(), default_scope);
      const auto& record = table.get(owner.value, "user does not have an account");
      eosio::check(record.balance.amount >= quantity.amount, "not enough funds deposited");
      table.modify(record, owner, [&](auto& a) {
         a.balance -= quantity;
         modify_fields(a);
      });
   }

   // Final part of the dispatcher
   EOSIO_ACTION_DISPATCHER(actions)

}  // namespace depositspend
