#include "freetalk.hpp"

#include <eosio/transaction.hpp>

namespace freetalk
{
   // This version of eosio::get_action doesn't abort when index is out of range.
   // It also doesn't play memory games.
   std::optional<eosio::action> safer_get_action(uint32_t type, uint32_t index)
   {
      auto size = eosio::internal_use_do_not_use::get_action(type, index, nullptr, 0);
      if (size < 0)
         return std::nullopt;
      std::vector<char> raw(size);
      auto size2 = eosio::internal_use_do_not_use::get_action(type, index, raw.data(), size);
      eosio::check(size2 == size, "get_action failed");
      return eosio::unpack<eosio::action>(raw.data(), size);
   }

   // Action: examine the transaction to see if we're ok accepting the charges for all of its actions
   void freetalk_contract::acceptcharge()
   {
      // type 0: context-free action
      // type 1: normal action
      for (uint32_t type = 0; type < 2; ++type)
      {
         for (uint32_t index = 0;; ++index)
         {
            auto action = safer_get_action(type, index);
            if (!action)
               break;
            // Simple rule: only allow actions on this contract
            eosio::check(action->account == get_self(),
                         "This transaction has something I won't pay for");
         }
      }
   }

   // Action: register key with user
   //
   // Note: the contract pays for the RAM, but doesn't have any protections. Ideally,
   //       it would charge the user a (possibly refundable) fee or do something else
   //       to prevent abuse.
   void freetalk_contract::registerkey(eosio::name user, const eosio::public_key& key)
   {
      require_auth(user);
      userkey_table table(get_self(), default_scope);
      auto record = table.find(user.value);
      if (record == table.end())
         table.emplace(get_self(), [&](auto& a) {
            a.user = user;
            a.key = key;
         });
      else
         table.modify(record, eosio::same_payer, [&](auto& a) { a.key = key; });
   }

   // Action: create a new post. Verifies the signature instead of doing typical auth checking.
   //         Uses the sequence number to prevent replay attacks.
   //
   // Note: the contract pays for the RAM, but doesn't have any protections. Ideally,
   //       it would charge the user a (possibly refundable) fee or do something else
   //       to prevent abuse.
   void freetalk_contract::createpost(const eosio::signature& signature, eosio::ignore<post>)
   {
      // Since we used eosio::ignore, the post lives in serialized form inside the datastream.
      auto& ds = get_datastream();

      // Get the digest and recover the pubkey
      auto digest = eosio::sha256(ds.pos(), ds.remaining());
      auto recovered = eosio::recover_key(digest, signature);

      // Now get the post content
      freetalk::post post;
      ds >> post;
      eosio::check(!ds.remaining(), "detected extra action data after post");

      // Verify the recovered key
      userkey_table table(get_self(), default_scope);
      auto record = table.find(post.user.value);
      eosio::check(record != table.end(), "User has not registered a key");
      if (recovered != record->key)
         eosio::check(false, "Expected " + public_key_to_string(record->key) + " but recovered " +
                                 public_key_to_string(recovered));

      // Protection against replay attacks
      if (post.sequence != record->next_sequence)
         eosio::check(false, "Expected sequence " + std::to_string(record->next_sequence) +
                                 " but got sequence " + std::to_string(post.sequence));
      table.modify(record, eosio::same_payer, [&](auto& rec) {  //
         rec.next_sequence = rec.next_sequence + 1;
      });

      // Store the post
      post_table ptable(get_self(), default_scope);
      ptable.emplace(get_self(), [&](auto& rec) {
         rec.id = ptable.available_primary_key();
         rec.user = post.user;
         rec.sequence = post.sequence;
         rec.message = post.message;
      });
   }
}  // namespace freetalk

// Final part of the dispatcher
EOSIO_ACTION_DISPATCHER(freetalk::actions)

// Things to populate the ABI with
EOSIO_ABIGEN(  //
    actions(freetalk::actions),
    table("userkey"_n, freetalk::userkey),
    table("post"_n, freetalk::stored_post))
