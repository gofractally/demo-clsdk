import logger from "./logger.js";
import * as flow from "dotenv-flow";

flow.config();

logger.info("==> Loading Env Configs...");

export const env = process.env.NODE_ENV || "development";
console.info(env);

export const serverConfig = {
    host: process.env.SERVER_HOST || "localhost",
    port: process.env.SERVER_PORT || "9000",
    privateKey: process.env.SERVER_PRIVATE_KEY + '',
};
console.info({ ...serverConfig, privateKey: '<hidden>' });

export const publicConfig = {
    chainRpcUrl: process.env.PUBLIC_CHAIN_RPC_URL || "https://testnet.waxsweden.org",
    chainId: process.env.PUBLIC_CHAIN_ID || "f16b1833c747c43682f4386fca9cbb327929334a762755ebec17f6f23c9b8a12",
    talkContract: process.env.PUBLIC_TALK_CONTRACT || "talk.edev",
    serverPaysAccount: process.env.PUBLIC_SERVER_PAYS_ACCOUNT || "paytalk.edev",
    serverPaysPermission: process.env.PUBLIC_SERVER_PAYS_CONTRACT || "freebie",
    edenContract: process.env.PUBLIC_EDEN_CONTRACT || "test2.edev",
};
console.info(publicConfig);

logger.info("<== Env Configs Loaded!");
