# All cmake projects need these
cmake_minimum_required(VERSION 3.16)
project(demo)

# clsdk requires C++20
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Libraries for building contracts and tests
find_package(clsdk REQUIRED)

# Builds freetalk.wasm contract
# Contracts may link to either:
#   * eosio-contract-simple-malloc: This library builds contracts with
#     small and fast memory allocation. free() is a no-op. Most contracts
#     should use this option.
#   * eosio-contract-full-malloc: This library builds contracts with
#     full memory allocation and reuse. Using this in your contract may
#     help expose memory bugs that eosio-contract-simple-malloc hides.
#     The downsides of eosio-contract-full-malloc are that contracts
#     will be larger and slower.
add_executable(freetalk freetalk.cpp)
target_link_libraries(freetalk eosio-contract-simple-malloc)

# Generate freetalk.abi
# This is a 2-step process:
#   * Build freetalk.abi.wasm. This must link to eosio-contract-abigen.
#   * Run the wasm to generate the abi
add_executable(freetalk-abigen freetalk.cpp freetalk-ricardian.cpp)
target_link_libraries(freetalk-abigen eosio-contract-abigen)
add_custom_command(TARGET freetalk-abigen POST_BUILD
    COMMAND cltester freetalk-abigen.wasm >freetalk.abi
)

# Build boot contract and ABI. boot activates protocol features
# (hard forks) that eosio.system needs.
add_executable(boot chain/boot.cpp)
target_link_libraries(boot eosio-contract-simple-malloc)
add_executable(boot-abigen chain/boot.cpp)
target_link_libraries(boot-abigen eosio-contract-abigen)
add_custom_command(TARGET boot-abigen POST_BUILD
    COMMAND cltester boot-abigen.wasm >boot.abi
)

# These symlinks help keep absolute paths outside of the files in .vscode/
execute_process(COMMAND ln -sf ${clsdk_DIR} ${CMAKE_CURRENT_BINARY_DIR}/clsdk)
execute_process(COMMAND ln -sf ${WASI_SDK_PREFIX} ${CMAKE_CURRENT_BINARY_DIR}/wasi-sdk)

# Generate compile_commands.json during build to enable
# symbol lookup in some editors
set(CMAKE_EXPORT_COMPILE_COMMANDS on)
