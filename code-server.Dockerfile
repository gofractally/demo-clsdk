FROM ubuntu:focal

RUN export DEBIAN_FRONTEND=noninteractive \
    && apt-get update \
    && apt-get install -yq      \
        binaryen                \
        build-essential         \
        ccache                  \
        cmake                   \
        curl                    \
        gdb                     \
        git                     \
        libboost-all-dev        \
        libcurl4-openssl-dev    \
        libgmp-dev              \
        libssl-dev              \
        libusb-1.0-0-dev        \
        pkg-config              \
    && apt-get clean -yq \
    && rm -rf /var/lib/apt/lists/*

RUN cd /opt \
    && curl -fLO https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-12/wasi-sdk-12.0-linux.tar.gz \
    && tar xf wasi-sdk-12.0-linux.tar.gz \
    && curl -fLO https://nodejs.org/dist/v14.16.0/node-v14.16.0-linux-x64.tar.xz \
    && tar xf node-v14.16.0-linux-x64.tar.xz \
    && export PATH="/opt/node-v14.16.0-linux-x64/bin:$PATH" \
    && npm i -g yarn

ENV WASI_SDK_PREFIX=/opt/wasi-sdk-12.0
ENV PATH=/opt/node-v14.16.0-linux-x64/bin:$PATH

RUN curl -fLO https://github.com/cdr/code-server/releases/download/v3.10.2/code-server_3.10.2_amd64.deb \
    && dpkg -i code-server_3.10.2_amd64.deb                                                             \
    && rm code-server_3.10.2_amd64.deb

# TODO: automate creating /root/.local. Right now it's manually created.
# /root/.local includes the ms-vscode.cpptools extension installed, vscode
# preferences set, breakpoints set, and an initial set of files opened
# within vscode
COPY image/.local /root/.local

# TODO: automate fetching clsdk (waiting for the next tagged release)
COPY image/clsdk /root/work/clsdk

RUN mkdir -p /root/work/demo-clsdk
COPY .clang-format                  /root/work/demo-clsdk/.clang-format
COPY .git                           /root/work/demo-clsdk/.git
COPY .gitignore                     /root/work/demo-clsdk/.gitignore
COPY .vscode                        /root/work/demo-clsdk/.vscode
COPY CMakeLists.txt                 /root/work/demo-clsdk/CMakeLists.txt
COPY README.md                      /root/work/demo-clsdk/README.md
COPY depositspend-ricardian.cpp     /root/work/demo-clsdk/depositspend-ricardian.cpp
COPY depositspend.cpp               /root/work/demo-clsdk/depositspend.cpp
COPY depositspend.hpp               /root/work/demo-clsdk/depositspend.hpp
COPY test-depositspend.cpp          /root/work/demo-clsdk/test-depositspend.cpp

ENV PATH=$PATH:/root/work/clsdk/bin
WORKDIR /root/work/demo-clsdk

RUN mkdir build                     \
    && cd build                     \
    && cmake `clsdk-cmake-args` ..  \
    && make -j

CMD code-server --auth none --bind-addr 0.0.0.0:8080 .
