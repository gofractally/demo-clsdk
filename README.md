# clsdk demo

This repo demonstrates how to write eosio contracts and test cases using the clsdk.

## Build

Set the `WASI_SDK_PREFIX` environment variable before building (see architecture-specific instructions below). Also make sure the clsdk's `bin` directory is in your path.

```sh
mkdir build
cd build
cmake `clsdk-cmake-args` ..
make -j
```

## Running the tests

In the `build` directory, run

```sh
ctest
```

If you want to see detailed logging during the tests, run

```sh
ctest -V
```

To run the test directly, instead of through ctest, run

```sh
cltester test-depositspend.wasm         # minimal logging
cltester -v test-depositspend.wasm      # show blockchain logging. This also
                                        # shows any contract prints in green.
cltester test-depositspend.wasm -s      # show test progression
cltester -v test-depositspend.wasm -s   # show both
```

## Inducing a failure

The test cases assume the price of a dog is `1000.0000 EOS`. Increase the price in [depositspend.hpp](depositspend.hpp):

```c++
inline constexpr eosio::asset dog_price{"1000.0001 EOS", eosio::no_check};
```

Rebuild and rerun the tests:
```sh
make -j
cltester test-depositspend.wasm
```

This should produce a message like the following:

```
transaction has exception: eosio_assert_message assertion failure (3050003)
assertion failure with message: incorrect price for a dog
pending console output: Example print for debugging. alice wants to buy a dog named skippy for 1000.0000 EOS

tester wasm asserted: transaction failed with status hard_fail
```

Unfortunately, this error doesn't directly indicate where in the test sequence the failure occurred. We hope to address this limitation in a future release. There is a way to narrow it down. Run this:

```sh
cltester test-depositspend.wasm -s
```

The last progress entry before the error message shows this (line number may differ from the time this readme was written):

```
/.../test-depositspend.cpp:156: PASSED:
  CHECK( depositspend::get_balance("depositspend"_n, user) == depositspend_bal )
```

We know it happened after this line in the test, but not where exactly. We can narrow it down by manually inserting this line in many places within [test-depositspend.cpp](test-depositspend.cpp) after the line number mentioned above:

```c++
printf("reached %s:%d\n", __FILE__, __LINE__);
```

If you run without options, you'll see a long list of lines it passed through before stopping.

```
make -j
cltester test-depositspend.wasm

...
reached /.../test-depositspend.cpp:211
reached /.../test-depositspend.cpp:213
reached /.../test-depositspend.cpp:215
transaction has exception: eosio_assert_message assertion failure (3050003)
assertion failure with message: incorrect price for a dog
pending console output: Example print for debugging. alice wants to buy a dog named skippy for 1000.0000 EOS

tester wasm asserted: transaction failed with status hard_fail
```

### Ubuntu 20.04

```sh
sudo apt-get update
sudo apt-get install -yq    \
    binaryen                \
    build-essential         \
    cmake                   \
    git                     \
    libboost-all-dev        \
    libcurl4-openssl-dev    \
    libgmp-dev              \
    libssl-dev              \
    libusb-1.0-0-dev        \
    pkg-config              \
    wget

export WASI_SDK_PREFIX=~/work/wasi-sdk-12.0
export CLSDK_PREFIX=~/work/clsdk

export PATH=$CLSDK_PREFIX/bin:$PATH

cd ~/work
wget https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-12/wasi-sdk-12.0-linux.tar.gz
tar xf wasi-sdk-12.0-linux.tar.gz

cd ~/work
wget https://github.com/eoscommunity/Eden/releases/download/sdk-v0.0.2-alpha/clsdk-ubuntu-20-04.tar.gz
tar xf clsdk-ubuntu-20-04.tar.gz
```
