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
    chainRpcUrl:
        process.env.PUBLIC_CHAIN_RPC_URL || "https://testnet.waxsweden.org",
    talkContract: process.env.PUBLIC_TALK_CONTRACT || "talk.edev",
    edenContract: process.env.PUBLIC_EDEN_CONTRACT || "test2.edev",
};
console.info(publicConfig);

logger.info("<== Env Configs Loaded!");
