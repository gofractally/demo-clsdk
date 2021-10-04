# Demo container

This dockerfile creates a container with:
* An in-browser vscode (`code-server`) with `ms-vscode.cpptools` installed
* `clsdk` and `wasi-sdk`
* This git repo
* The sources in this repo pre-built and ready to run

# Building

```
docker build -f docker/code-server.Dockerfile -t ghcr.io/eoscommunity/demo-clsdk:contract-pays .
```
