#include <eosio/tester.hpp>
#include <token/token.hpp>
#include "depositspend.hpp"

#define CATCH_CONFIG_MAIN
#include <catch2/catch.hpp>

using namespace eosio;

// EOSIO_HERE(x) constructs a stack entry for error messages. The argument
// is the previous entry in the stack. Tester functions don't need the stack
// argument (it's optional), but produce more helpful errors when it's present.
//
// H ("here") is a shortcut for using EOSIO_HERE.
#define H EOSIO_HERE(stack)

// Default (empty) call stack for H
inline constexpr const call_stack* stack = nullptr;

// Set up the token contract
void setup_token(const call_stack* stack, test_chain& t)
{
   // This creates the eosio.token account with the following authorities:
   // * owner:
   //    * threshold = 1
   //    * public keys: [default_pub_key (EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV)]
   //    * accounts: []
   // * active:
   //    * threshold = 1
   //    * public keys: [default_pub_key]
   //    * accounts: [eosio.token@eosio.code]
   //
   // There are several overloads of create_account() and create_code_account() which cover common
   // cases plus provide full flexibility when needed.
   t.create_code_account(H, "eosio.token"_n);

   // Set the code
   t.set_code(H, "eosio.token"_n, CLSDK_CONTRACTS_DIR "token.wasm");

   // Create and issue tokens.
   //
   // * as("eosio.token"_n) means use eosio.token's active authority. The tester uses
   //   default_priv_key (5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3) to sign.
   // * act<...>(...) sends a single transaction and verifies it was successful.
   //   * token::actions::* is defined by EOSIO_ACTIONS(...) in token/token.hpp
   //   * The first argument within (...) may be the call stack; this is optional.
   //     The remaining arguments are passed to the action.
   // * s2a (string-to-asset) is a shortcut for constructing assets

   t.as("eosio.token"_n).act<token::actions::create>(H, "eosio"_n, s2a("1000000.0000 EOS"));
   t.as("eosio.token"_n).act<token::actions::create>(H, "eosio"_n, s2a("1000000.0000 OTHER"));
   t.as("eosio"_n).act<token::actions::issue>(H, "eosio"_n, s2a("1000000.0000 EOS"), "");
   t.as("eosio"_n).act<token::actions::issue>(H, "eosio"_n, s2a("1000000.0000 OTHER"), "");

   // Uh-oh, someone's up to no good
   //
   // One of the arguments to EOSIO_ACTIONS is a default contract. EOSIO_ACTIONS places the default
   // contract in the action wrappers. act<...> and trace<...> normally send the action to the
   // default. with_code() overrides that.

   t.create_code_account(H, "hacker.token"_n);
   t.set_code(H, "hacker.token"_n, CLSDK_CONTRACTS_DIR "token.wasm");
   t.as("hacker.token"_n)
       .with_code("hacker.token"_n)
       .act<token::actions::create>(H, "hacker.token"_n, s2a("1000000.0000 EOS"));
   t.as("hacker.token"_n)
       .with_code("hacker.token"_n)
       .act<token::actions::issue>(H, "hacker.token"_n, s2a("1000000.0000 EOS"), "");
}

void fund_users(const call_stack* stack, test_chain& t)
{
   for (auto user : {"alice"_n, "bob"_n, "jane"_n, "joe"_n})
   {
      t.create_account(H, user);
      t.as("eosio"_n).act<token::actions::transfer>(H, "eosio"_n, user, s2a("10000.0000 EOS"), "");
      t.as("eosio"_n).act<token::actions::transfer>(H, "eosio"_n, user, s2a("10000.0000 OTHER"),
                                                    "");
      t.as("hacker.token"_n)
          .with_code("hacker.token"_n)
          .act<token::actions::transfer>(H, "hacker.token"_n, user, s2a("10000.0000 EOS"), "");
   }
}

void setup_depositspend(const call_stack* stack, test_chain& t)
{
   t.create_code_account(H, "depositspend"_n);
   t.set_code(H, "depositspend"_n, "depositspend.wasm");
}

TEST_CASE("This is the first test")
{
   // This starts a single-producer chain
   test_chain t;

   setup_token(H, t);
   fund_users(H, t);
   setup_depositspend(H, t);

   // some shortcuts
   auto alice = t.as("alice"_n);
   auto bob = t.as("bob"_n);

   // alice tries to deposit the wrong token.
   //
   // * trace<...>(...) sends a single transaction, but does not verify success. Instead it returns
   //   a transaction trace.
   // * expect(stack, trace, msg)
   //    * If msg == nullptr, verifies the transaction was successful
   //    * If msg != nullptr, verifies the transaction failed, and the error message contains msg
   //      within it (partial match)
   //    * The stack argument (H) is optional
   expect(H,
          alice.trace<token::actions::transfer>(  //
              "alice"_n, "depositspend"_n, s2a("100.0000 OTHER"), ""),
          "This contract does not deal with this token");

   // alice tries again, this time with hacker EOS
   alice.with_code("hacker.token"_n)
       .act<token::actions::transfer>(H, "alice"_n, "depositspend"_n, s2a("100.0000 EOS"), "");

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
   bob.act<token::actions::transfer>(H, "bob"_n, "depositspend"_n, s2a("100.0000 EOS"), "");
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
}  // First test

// To stop repeating ourselves, here's a helpful function
void check_bal(eosio::name user,
               const eosio::asset& eosio_token_bal,
               const eosio::asset& depositspend_bal)
{
   CHECK(token::contract::get_balance("eosio.token"_n, user, symbol_code{"EOS"}) ==
         eosio_token_bal);
   CHECK(depositspend::get_balance("depositspend"_n, user) == depositspend_bal);
};

TEST_CASE("This is the second test")
{
   {
      // This starts a whole new chain. The tester shutdown and destroyed the first test's chain at
      // the end of the first test.
      test_chain t;
      setup_token(H, t);
      fund_users(H, t);
      setup_depositspend(H, t);
      auto bob = t.as("bob"_n);

      // Let's verify balances before and after the transfer
      check_bal("bob"_n, s2a("10000.0000 EOS"), s2a("0.0000 EOS"));
      bob.act<token::actions::transfer>(H, "bob"_n, "depositspend"_n, s2a("100.0000 EOS"), "");
      check_bal("bob"_n, s2a("9900.0000 EOS"), s2a("100.0000 EOS"));

      // Bob withdraws some
      check_bal("bob"_n, s2a("9900.0000 EOS"), s2a("100.0000 EOS"));
      bob.act<depositspend::actions::withdraw>(H, "bob"_n, s2a("10.0000 EOS"));
      check_bal("bob"_n, s2a("9910.0000 EOS"), s2a("90.0000 EOS"));
   }

   {
      // Another? Yep. The one above was destroyed at the }.
      test_chain t;
      setup_token(H, t);
      fund_users(H, t);
      setup_depositspend(H, t);

      // You get a dog. She gets a dog. Everyone gets a dog.
      for (auto user : {"alice"_n, "bob"_n, "jane"_n, "joe"_n})
      {
         // They are a bit pricey
         check_bal(user, s2a("10000.0000 EOS"), s2a("0.0000 EOS"));
         t.as(user).act<token::actions::transfer>(H, user, "depositspend"_n, s2a("1000.0000 EOS"),
                                                  "");
         check_bal(user, s2a("9000.0000 EOS"), s2a("1000.0000 EOS"));

         // There's an infinite supply of dogs with any given name
         t.as(user).act<depositspend::actions::buydog>(H, user, "skippy"_n, s2a("1000.0000 EOS"));
         check_bal(user, s2a("9000.0000 EOS"), s2a("0.0000 EOS"));

         // Verify the dog is accounted for
         depositspend::accounts table("depositspend"_n, depositspend::default_scope);
         CHECK(table.get(user.value).num_dogs == 1);
      }
   }
}  // Second test
