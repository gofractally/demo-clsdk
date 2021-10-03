#include <eosio/bytes.hpp>
#include <eosio/eosio.hpp>
#include <eosio/from_json.hpp>
#include <eosio/privileged.hpp>

static constexpr eosio::blockchain_parameters blockchain_parameters = {
    .max_block_net_usage = 1024 * 1024,
    .target_block_net_usage_pct = 1000,
    .max_transaction_net_usage = 512 * 1024,
    .base_per_transaction_net_usage = 12,
    .net_usage_leeway = 500,
    .context_free_discount_net_usage_num = 20,
    .context_free_discount_net_usage_den = 100,
    .max_block_cpu_usage = 200000,
    .target_block_cpu_usage_pct = 1000,
    .max_transaction_cpu_usage = 150000,
    .min_transaction_cpu_usage = 100,
    .max_transaction_lifetime = 60 * 60,
    .deferred_trx_expiration_window = 10 * 60,
    .max_transaction_delay = 45 * 24 * 3600,
    .max_inline_action_size = 512 * 24,
    .max_inline_action_depth = 6,
    .max_authority_depth = 6};

// These are the features enabled on EOS as of 2021-10-02
static const std::vector<std::string> protocol_features{
    "8ba52fe7a3956c5cd3a656a3174b931d3bb2abb45578befc59f283ecd816a405",
    "68dcaa34c0517d19666e6b33add67351d8c5f69e999ca1e37931bc410a297428",
    "1a99a59d87e06e09ec5b028a9cbb7749b4a5ad8819004365d02dc4379a8b7241",
    "e0fb64b1085cc5538970158d05a009c24e276fb94e1a0bf6a528b48fbc4ff526",
    "4e7bf348da00a945489b2a681749eb56f5de00b900014e137ddae39f48f69d67",
    "f0af56d2c5a48d60a4a5b5c903edfb7db3a736a94ed589d0b797df33ff9d3e1d",
    "ef43112c6543b88db2283a2e077278c315ae2c84719a8b25f25cc88565fbea99",
    "4a90c00d55454dc5b059055ca213579c6ea856967712a56017487886a4d4cc0f",
    "299dcb6af692324b899b39f16d5a530a33062804e41f09dc97e9f156b4476707",
    "4fca8bd82bbd181e714e283f83e1b45d95ca5af40fb89ad3977b653c448f78c2",
};

namespace boot
{
   class boot_contract : public eosio::contract
   {
     public:
      using contract::contract;

      void setabi(const eosio::name& account, const eosio::bytes& abi) {}

      void setcode(const eosio::name& account,
                   uint8_t vmtype,
                   uint8_t vmversion,
                   const eosio::bytes& code)
      {
      }

      void boot()
      {
         eosio::set_blockchain_parameters(blockchain_parameters);
         for (const auto& feature : protocol_features)
         {
            std::vector<char> buf;
            buf.push_back('"');
            buf.insert(buf.end(), feature.begin(), feature.end());
            buf.push_back('"');
            buf.push_back('\0');
            eosio::json_token_stream stream(buf.data());
            eosio::preactivate_feature(eosio::from_json<eosio::checksum256>(stream));
         }
      }
   };
   EOSIO_ACTIONS(boot_contract, "eosio"_n, setabi, setcode, boot)
}  // namespace boot

EOSIO_ACTION_DISPATCHER(boot::actions)
EOSIO_ABIGEN(actions(boot::actions))
