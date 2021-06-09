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

...
/home/todd/work/demo-clsdk/test-depositspend.cpp:197: ____C_A_T_C_H____T_E_S_T____2()
...
tester wasm asserted: transaction failed with status hard_fail
```

This message includes a stack trace in the test when the failure occurred. One of the entries in the stack points to this line, which has the price assumption:

```c++
t.as(user).act<depositspend::actions::buydog>(user, "skippy"_n, s2a("1000.0000 EOS"));
```

Let's fix it:

```c++
t.as(user).act<depositspend::actions::buydog>(user, "skippy"_n, s2a("1000.0001 EOS"));
```

Alice is now overdrawn:

```
transaction has exception: eosio_assert_message assertion failure (3050003)
assertion failure with message: not enough funds deposited
pending console output: Example print for debugging. alice wants to buy a dog named skippy for 1000.0001 EOS

...
/home/todd/work/demo-clsdk/test-depositspend.cpp:197: ____C_A_T_C_H____T_E_S_T____2()
...
tester wasm asserted: transaction failed with status hard_fail
```

## Debugging contracts using vscode

This repo includes vscode settings ([.vscode](.vscode) folder) which enable debugging. This requires [ms-vscode.cpptools](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools). Note: `ms-vscode.cmake-tools` has compatability issues; I'd avoid it for now.

To start a debug session:
* Follow the build instructions above. [.vscode/launch.json](.vscode/launch.json) expects that you built in the `build` directory.
* Open the repo root folder in vscode
* Set breakpoints in [depositspend.cpp](depositspend.cpp) and [test-depositspend.cpp](test-depositspend.cpp)
* Click the Debug icon on the left side
* Click `(gdb) Launch cltester`
* It should stop on the first breakpoint it hits.
* The Continue, Step Over, Step Into, Step Out, Restart, and Stop commands are available. You can also add, remove, and toggle breakpoints.
* The Variables and Watch displays are non-functional. The Call Stack is available.

## Debugging using gdb

To start a debug session on the command line:

```
cd build
gdb -q --args cltester -v -s depositspend.wasm depositspend-debug.wasm test-depositspend.wasm
```

Ignore `No debugging symbols found in cltester`; it will load debugging symbols for the wasm files.

The following gdb commands set options gdb needs to function, sets a breakpoint, and runs up to that breakpoint:

```
handle SIG34 noprint
set breakpoint pending on
b depositspend_contract::withdraw
run
```

## Ubuntu 20.04

```sh
sudo apt-get update
sudo apt-get install -yq    \
    binaryen                \
    build-essential         \
    cmake                   \
    gdb                     \
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
wget https://github.com/eoscommunity/Eden/releases/download/sdk-v0.0.3-alpha/clsdk-ubuntu-20-04.tar.gz
tar xf clsdk-ubuntu-20-04.tar.gz
```
