import logger from "./logger.js";
import * as flow from "dotenv-flow";

flow.config();

logger.info("==> Loading Env Configs...");

export const env = process.env.NODE_ENV || "development";
console.info(env);

export const serverConfig = {
    port: process.env.SERVER_PORT,
    serverPaysPrivateKey: process.env.SERVER_PAYS_PRIVATE_KEY,
    serverPaysAccount: process.env.SERVER_PAYS_ACCOUNT,
    serverPaysPermission: process.env.SERVER_PAYS_PERMISSION,
    serverPaysNoopContract: process.env.SERVER_PAYS_NOOP_CONTRACT,
    serverPaysNoopAction: process.env.SERVER_PAYS_NOOP_ACTION,
    serverPaysCreateABI: process.env.SERVER_PAYS_CREATE_ABI === "true",
};
console.info({ ...serverConfig, serverPaysPrivateKey: "<hidden>" });

export const publicConfig = {
    chainId: process.env.PUBLIC_CHAIN_ID,
    chainRpcUrl: process.env.PUBLIC_CHAIN_RPC_URL,
    talkContract: process.env.PUBLIC_TALK_CONTRACT,
    edenContract: process.env.PUBLIC_EDEN_CONTRACT,
    subchain: process.env.PUBLIC_SUBCHAIN,
};
console.info(publicConfig);

export const dfuseConfig = {
    apiKey: process.env.DFUSE_API_KEY,
    apiNetwork: process.env.DFUSE_API_NETWORK,
    authNetwork: process.env.DFUSE_AUTH_NETWORK,
    firstBlock: +process.env.DFUSE_FIRST_BLOCK,
    jsonTrxFile: process.env.DFUSE_JSON_TRX_FILE,
    interval: +process.env.DFUSE_INTERVAL,
    connect: process.env.DFUSE_CONNECT === "true",
};
console.info({ ...dfuseConfig, apiKey: "<secret>" });

logger.info("<== Env Configs Loaded!");
