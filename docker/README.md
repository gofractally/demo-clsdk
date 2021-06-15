# Demo container

This dockerfile creates a container with:
* An in-browser vscode (`code-server`) with `ms-vscode.cpptools` installed
* `clsdk` and `wasi-sdk`
* This git repo
* The sources in this repo pre-built and ready to debug

# Using

* `docker run -it -p 8080:8080 ghcr.io/eoscommunity/demo-clsdk`
* Open http://localhost:8080
* Press `F5` to begin debugging

# Building

```
docker build -f docker/code-server.Dockerfile .
```
