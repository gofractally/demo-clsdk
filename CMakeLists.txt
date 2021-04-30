# All cmake projects need these
cmake_minimum_required(VERSION 3.16)
project(demo)

# clsdk requires C++20
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Libraries for building contracts and tests
add_subdirectory(${CLSDK_PREFIX} clsdk)

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
