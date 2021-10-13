#include "freetalk.hpp"

#include <eosio/transaction.hpp>

namespace freetalk
{
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

      // Verify eden member
      eden_member_table members(eden_account, 0);
      auto it = members.find(user.value);
      eosio::check(it != members.end(), "member not found");
   }

   // Action: create a new post. Verifies the signature instead of doing typical auth checking.
   //         Uses the sequence number to prevent replay attacks.
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
      eosio::check(post.message.size() <= 256, "post is too long");

      // Verify the recovered key
      userkey_table table(get_self(), default_scope);
      auto record = table.find(post.user.value);
      eosio::check(record != table.end(), "User has not registered a key");
      if (recovered != record->key)
         eosio::check(false, "Expected " + public_key_to_string(record->key) + " but recovered " +
                                 public_key_to_string(recovered));

      // Protection against replay attacks
      table.modify(record, eosio::same_payer, [&](auto& rec) {
         if (rec.sequences.begin() != rec.sequences.end())
         {
            if (post.sequence < *rec.sequences.begin())
               eosio::check(false, "received duplicate sequence " + std::to_string(post.sequence));
            else if (post.sequence > rec.sequences.end()[-1].value + 10)
               eosio::check(false, "sequence " + std::to_string(post.sequence) + " skips too many");
         }
         auto it = std::lower_bound(rec.sequences.begin(), rec.sequences.end(), post.sequence);
         if (it != rec.sequences.end() && *it == post.sequence)
            eosio::check(false, "received duplicate sequence " + std::to_string(post.sequence));
         rec.sequences.insert(it, post.sequence);
         if (rec.sequences.size() > 20)
            rec.sequences.erase(rec.sequences.begin());
      });

      // Verify eden member.
      eden_member_table members(eden_account, 0);
      auto it = members.find(post.user.value);
      eosio::check(it != members.end(), "member not found");
   }  // namespace freetalk
}  // namespace freetalk

// Final part of the dispatcher
EOSIO_ACTION_DISPATCHER(freetalk::actions)

// Things to populate the ABI with
EOSIO_ABIGEN(  //
    actions(freetalk::actions),
    table("userkey"_n, freetalk::userkey))
