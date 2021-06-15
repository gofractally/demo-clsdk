# All cmake projects need these
cmake_minimum_required(VERSION 3.16)
project(demo)

# clsdk requires C++20
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Libraries for building contracts and tests
find_package(clsdk REQUIRED)

# Builds depositspend.wasm contract
# Contracts may link to either:
#   * eosio-contract-simple-malloc: This library builds contracts with
#     small and fast memory allocation. free() is a no-op. Most contracts
#     should use this option.
#   * eosio-contract-full-malloc: This library builds contracts with
#     full memory allocation and reuse. Using this in your contract may
#     help expose memory bugs that eosio-contract-simple-malloc hides.
#     The downsides of eosio-contract-full-malloc are that contracts
#     will be larger and slower.
add_executable(depositspend depositspend.cpp)
target_link_libraries(depositspend eosio-contract-simple-malloc)

# Builds depositspend-debug.wasm
#
# This is like depositspend.wasm, but includes debugging information.
# Debug contracts can't normally be installed on chains using `set code`.
# Instead, cltester loads them using its `-s/--subst` option.
#
# Create a debugging contract by linking to either
# eosio-contract-simple-malloc-debug or eosio-contract-full-malloc-debug.
add_executable(depositspend-debug depositspend.cpp)
target_link_libraries(depositspend-debug eosio-contract-simple-malloc-debug)

# Generate depositspend.abi
# This is a 2-step process:
#   * Build depositspend.abi.wasm. This must link to eosio-contract-abigen.
#   * Run the wasm to generate the abi
add_executable(depositspend-abigen depositspend.cpp depositspend-ricardian.cpp)
target_link_libraries(depositspend-abigen eosio-contract-abigen)
add_custom_command(TARGET depositspend-abigen POST_BUILD
    COMMAND cltester depositspend-abigen.wasm >depositspend.abi
)

# Builds test-depositspend.wasm
# Tests must link to either cltestlib (runs faster) or cltestlib-debug
# (shows stack traces on failure).
add_executable(test-depositspend test-depositspend.cpp)
target_link_libraries(test-depositspend cltestlib-debug)

# ctest rule which runs test-depositspend.wasm. The -v and -s
# options provide detailed logging. ctest hides this detail;
# use `ctest -V` so show it.
enable_testing()
add_test(
    NAME deposit-and-spend
    COMMAND cltester -v test-depositspend.wasm -s
)

# These symlinks help keep absolute paths outside of the files in .vscode/
execute_process(COMMAND ln -sf ${clsdk_DIR} ${CMAKE_CURRENT_BINARY_DIR}/clsdk)
execute_process(COMMAND ln -sf ${WASI_SDK_PREFIX} ${CMAKE_CURRENT_BINARY_DIR}/wasi-sdk)

# Generate compile_commands.json during build to enable
# symbol lookup in some editors
set(CMAKE_EXPORT_COMPILE_COMMANDS on)
