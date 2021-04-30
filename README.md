# clsdk demo

This repo demonstrates how to write eosio contracts and test cases using the clsdk.

## Build

Set the `WASI_SDK_PREFIX` environment variable before building (see architecture-specific instructions below). Also make sure the clsdk's `bin` directory is in your path.

```sh
mkdir build
cd build
cmake `clsdk-cmake-args` ..
make -j
ctest
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

TODO: ...
```
