#include "freetalk.hpp"

const char* freetalk::acceptcharge_ricardian = R"(
This action examines the transaction to determine if thepayer@freebie is willing to pay for it.
)";

const char* freetalk::registerkey_ricardian = R"(
This action registers a public key with your account. This key can be used to authorize free transactions on freetalk.

Note: this does *not* modify your account's native eosio permissions.
)";

const char* freetalk::createpost_ricardian = R"(
This action creates a post. It verifies the signature instead of using normal auth checking.
)";
