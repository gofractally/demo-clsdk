FROM ubuntu:focal

RUN export DEBIAN_FRONTEND=noninteractive \
    && apt-get update \
    && apt-get install -yq      \
        binaryen                \
        ccache                  \
        cmake                   \
        curl                    \
        gdb                     \
        git                     \
        libgmp10                \
        unzip                   \
    && apt-get clean -yq \
    && rm -rf /var/lib/apt/lists/*

RUN cd /opt \
    && curl -fLO https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-12/wasi-sdk-12.0-linux.tar.gz \
    && tar xf wasi-sdk-12.0-linux.tar.gz \
    && rm wasi-sdk-12.0-linux.tar.gz
ENV WASI_SDK_PREFIX=/opt/wasi-sdk-12.0

RUN curl -fLO https://github.com/cdr/code-server/releases/download/v3.10.2/code-server_3.10.2_amd64.deb \
    && dpkg -i code-server_3.10.2_amd64.deb                                                             \
    && rm code-server_3.10.2_amd64.deb

RUN curl -fLO https://github.com/microsoft/vscode-cpptools/releases/download/1.4.1/cpptools-linux.vsix  \
 && mkdir -p /root/.local/share/code-server/extensions/ms-vscode.cpptools-1.4.1/                        \
 && unzip cpptools-linux.vsix -d /root/.local/share/code-server/extensions/ms-vscode.cpptools-1.4.1     \
 && mv /root/.local/share/code-server/extensions/ms-vscode.cpptools-1.4.1/extension/*                   \
       /root/.local/share/code-server/extensions/ms-vscode.cpptools-1.4.1                               \
 && rm cpptools-linux.vsix

RUN cd /opt \
    && curl -fLO https://github.com/eoscommunity/Eden/releases/download/sdk-v0.1.0-alpha/clsdk-ubuntu-20-04.tar.gz \
    && tar xf clsdk-ubuntu-20-04.tar.gz \
    && rm clsdk-ubuntu-20-04.tar.gz
ENV PATH=$PATH:/opt/clsdk/bin

COPY docker/.local /root/.local

RUN mkdir -p /root/work/demo-clsdk
COPY .git                                       /root/work/demo-clsdk/.git
RUN cd /root/work/demo-clsdk && git checkout .
COPY docker/replacement-c_cpp_properties.json   /root/work/demo-clsdk/.vscode/c_cpp_properties.json
COPY docker/replacement-README.md               /root/work/demo-clsdk/README.md

WORKDIR /root/work/demo-clsdk

RUN mkdir build                     \
    && cd build                     \
    && cmake `clsdk-cmake-args` ..  \
    && make -j

EXPOSE 8080
CMD code-server --auth none --bind-addr 0.0.0.0:8080 .
