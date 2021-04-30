#include <eosio/tester.hpp>
#include <token/token.hpp>
#include "depositspend.hpp"

#define CATCH_CONFIG_MAIN
#include <catch2/catch.hpp>

using namespace eosio;

// Set up the token contract
void setup_token(test_chain& t)
{
   // This creates the eosio.token account with the following authorities:
   // * owner:
   //    * threshold = 1
   //    * public keys: [default_pub_key (EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV)]
   //    * accounts: []
   // * active:
   //    * threshold = 1
   //    * public keys: [default_pub_key]
   //    * accounts: [eosio.token@active]
   //
   // There are several overloads of create_account() and create_code_account() which cover common
   // cases plus provide full flexibility when needed.
   t.create_code_account("eosio.token"_n);

   // Set the code
   t.set_code("eosio.token"_n, CLSDK_CONTRACTS_DIR "token.wasm");

   // Create and issue tokens.
   //
   // * as("eosio.token"_n) means use eosio.token's active authority. The tester uses
   //   default_priv_key (5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3) to sign.
   // * act<...>(...) sends a single transaction and verifies it was successful
   // * token::actions::* is defined by EOSIO_ACTIONS(...) in token/token.hpp
   // * s2a (string-to-asset) is a shortcut for constructing assets

   t.as("eosio.token"_n).act<token::actions::create>("eosio"_n, s2a("1000000.0000 EOS"));
   t.as("eosio.token"_n).act<token::actions::create>("eosio"_n, s2a("1000000.0000 OTHER"));
   t.as("eosio"_n).act<token::actions::issue>("eosio"_n, s2a("1000000.0000 EOS"), "");
   t.as("eosio"_n).act<token::actions::issue>("eosio"_n, s2a("1000000.0000 OTHER"), "");

   // Uh-oh, someone's up to no good
   //
   // One of the arguments to EOSIO_ACTIONS is a default contract. EOSIO_ACTIONS places the default
   // contract in the action wrappers. act<...> and trace<...> normally send the action to the
   // default. with_code() overrides that.

   t.create_code_account("hacker.token"_n);
   t.set_code("hacker.token"_n, CLSDK_CONTRACTS_DIR "token.wasm");
   t.as("hacker.token"_n)
       .with_code("hacker.token"_n)
       .act<token::actions::create>("hacker.token"_n, s2a("1000000.0000 EOS"));
   t.as("hacker.token"_n)
       .with_code("hacker.token"_n)
       .act<token::actions::issue>("hacker.token"_n, s2a("1000000.0000 EOS"), "");
}

void fund_users(test_chain& t)
{
   for (auto user : {"alice"_n, "bob"_n, "jane"_n, "joe"_n})
   {
      t.create_account(user);
      t.as("eosio"_n).act<token::actions::transfer>("eosio"_n, user, s2a("10000.0000 EOS"), "");
      t.as("eosio"_n).act<token::actions::transfer>("eosio"_n, user, s2a("10000.0000 OTHER"), "");
      t.as("hacker.token"_n)
          .with_code("hacker.token"_n)
          .act<token::actions::transfer>("hacker.token"_n, user, s2a("10000.0000 EOS"), "");
   }
}

void setup_depositspend(test_chain& t)
{
   t.create_code_account("depositspend"_n);
   t.set_code("depositspend"_n, "depositspend.wasm");
}

TEST_CASE("This is the first test")
{
   // This starts a single-producer chain
   test_chain t;

   setup_token(t);
   fund_users(t);
   setup_depositspend(t);

   // some shortcuts
   auto alice = t.as("alice"_n);
   auto bob = t.as("bob"_n);
   auto jane = t.as("jane"_n);
   auto joe = t.as("joe"_n);

   // alice tries to deposit the wrong token.
   //
   // * trace<...>(...) sends a single transaction, but does not verify success. Instead it returns
   //   a transaction trace.
   // * expect(trace, msg)
   //    * if msg == nullptr, verifies the transaction was successful
   //    * if msg != nullptr, verifies the transaction failed, and the error message contains msg
   //      within it (partial match)
   expect(alice.trace<token::actions::transfer>(  //
              "alice"_n, "depositspend"_n, s2a("100.0000 OTHER"), ""),
          "This contract does not deal with this token");

   // alice tries again, this time with hacker EOS
   alice.with_code("hacker.token"_n)
       .act<token::actions::transfer>("alice"_n, "depositspend"_n, s2a("100.0000 EOS"), "");

   // But wait, the act<> succeeded! (otherwise the test would have reported an error). The
   // EOSIO_ACTIONS() entry for the contract has this:
   //
   // notify(token_contract, transfer)
   //
   // This causes the dispatcher to call notify_transfer() when the contract receives a transfer
   // notification that involves token_contract (eosio.token), but not any other contract. The
   // dispatcher simply ignored the hacker.token transfer. If the contract wanted to receive
   // all transfer notifications, it could have used this:
   //
   // notify(eosio::any_contract, transfer)
   //
   // It would then be up to notify_transfer() to distinguish whether the transfer is good.
   // get_first_receiver() can help with this.
   //
   // Let's check Alice's depositspend balance.
   //
   // * CHECK(expression) verifies an expression is true, and shows and error when it isn't. Unlike
   //   eosio::check(), CHECK(expression) gives a colorful message showing the line number where the
   //   failure occured
   // * depositspend::get_balance() is not an action! Instead, it's a helpful piece of code which
   //   lives in depositspend.hpp, which was included at the top of this file.
   CHECK(depositspend::get_balance("depositspend"_n, "alice"_n) == s2a("0.0000 EOS"));

   // bob makes a real deposit
   bob.act<token::actions::transfer>("bob"_n, "depositspend"_n, s2a("100.0000 EOS"), "");
   CHECK(depositspend::get_balance("depositspend"_n, "bob"_n) == s2a("100.0000 EOS"));

   // Let's revisit depositspend::get_balance(). Since it's not an action, it's not calling into the
   // on-chain contract. Instead, it pulls off the following stunt, inside the test itself:
   {
      // Tests use the same library (eosiolib) to access tables that that contracts do
      depositspend::accounts table("depositspend"_n, depositspend::default_scope);
      eosio::asset bob_balance;
      auto record = table.find("bob"_n.value);
      if (record != table.end())
         bob_balance = record->balance;

      CHECK(bob_balance == s2a("100.0000 EOS"));
   }
}
