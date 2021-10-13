import { serverConfig, publicConfig } from "./config.js";
import logger, { setupExpressLogger } from "./logger.js";
import Posts from "./posts.js";
import DfuseReceiver from "./dfuse-receiver.js";
import { createWSServer } from "./posts-server.js";
import { JsSignatureProvider } from "eosjs/dist/eosjs-jssig.js";
import { JsonRpc } from "eosjs/dist/eosjs-jsonrpc.js";
import { Api } from "eosjs/dist/eosjs-api.js";
import { arrayToHex } from "eosjs/dist/eosjs-serialize.js";
import { AuthorityProviderArgs } from "eosjs/dist/eosjs-api-interfaces";
import fetch from "node-fetch";
import express from "express";
import * as http from "http";

const rpc = new JsonRpc(publicConfig.chainRpcUrl, { fetch });
const signatureProvider = new JsSignatureProvider([
    serverConfig.serverPaysPrivateKey,
]);
const authorityProvider = {
    // Optimization: don't need /v1/chain/get_required_keys
    async getRequiredKeys(args: AuthorityProviderArgs) {
        return signatureProvider.getAvailableKeys();
    },
};
const api = new Api({
    rpc,
    authorityProvider,
    signatureProvider,
    chainId: publicConfig.chainId,
});

// Make up an ABI if needed
if (serverConfig.serverPaysCreateABI) {
    const noopAbi = {
        version: "eosio::abi/1.1",
        types: [] as any[],
        structs: [
            {
                name: serverConfig.serverPaysNoopAction,
                base: "",
                fields: [] as any[],
            },
        ],
        actions: [
            {
                name: serverConfig.serverPaysNoopAction,
                type: serverConfig.serverPaysNoopAction,
                ricardian_contract: "",
            },
        ],
        tables: [] as any[],
        ricardian_clauses: [] as any[],
        error_messages: [] as any[],
        abi_extensions: [] as any[],
        variants: [] as any[],
    };
    api.cachedAbis.set(serverConfig.serverPaysNoopContract, {
        rawAbi: api.jsonToRawAbi(noopAbi),
        abi: noopAbi,
    });
}

// Optimization: cache tapos so signature requests don't hit RPC
let tapos: {
    ref_block_num: number;
    ref_block_prefix: number;
};
let resolveHaveTapos: () => void;
let haveTapos = new Promise<void>((resolve, reject) => {
    resolveHaveTapos = resolve;
});
async function generateTapos() {
    try {
        function reverseHex(h: string) {
            return (
                h.substr(6, 2) +
                h.substr(4, 2) +
                h.substr(2, 2) +
                h.substr(0, 2)
            );
        }
        const info = await rpc.get_info();
        const prefix = parseInt(
            reverseHex(info.last_irreversible_block_id.substr(16, 8)),
            16
        );
        tapos = {
            ref_block_num: info.last_irreversible_block_num & 0xffff,
            ref_block_prefix: prefix,
        };
        logger.info(`tapos: ${JSON.stringify(tapos)}`);
        resolveHaveTapos();
        setTimeout(generateTapos, 30 * 60 * 1000);
    } catch (e) {
        logger.error(`generateTapos: ${e.message}`);
        logger.info("retry in 10s");
        setTimeout(generateTapos, 10_000);
    }
}
generateTapos();

// Receive posts from dfuse
const posts = new Posts();
const dfuseReceiver = new DfuseReceiver(posts);
(async () => {
    try {
        await dfuseReceiver.start();
    } catch (e) {
        logger.error(`starting dfuse: ${e.message}`);
    }
})();

// Server
const app = express();
const server = http.createServer(app);

setupExpressLogger(app);
app.use(express.json());
app.use(express.static("../webapp/dist"));

app.get("/config.json", (req, res) => {
    res.json(publicConfig);
});

app.post("/sign_post_trx", async (req, res, next) => {
    try {
        await haveTapos;
        const post = {
            user: req.body.post?.user + "",
            sequence: +req.body.post?.sequence,
            name: req.body.post?.name + "",
            message: req.body.post?.message + "",
        };
        const postSignature = req.body.signature + "";
        const trx = {
            ...tapos,
            expiration: new Date(Date.now() + 2 * 60 * 1000)
                .toISOString()
                .slice(0, -1),
            actions: [
                {
                    account: serverConfig.serverPaysNoopContract,
                    name: serverConfig.serverPaysNoopAction,
                    authorization: [
                        {
                            actor: serverConfig.serverPaysAccount,
                            permission: serverConfig.serverPaysPermission,
                        },
                    ],
                    data: {},
                },
                {
                    account: publicConfig.talkContract,
                    name: "createpost",
                    authorization: [] as any[],
                    data: {
                        signature: postSignature,
                        post,
                    },
                },
            ],
        };
        const signedTrx = await api.transact(trx, {
            broadcast: false,
        });
        const result = {
            signatures: (signedTrx as any).signatures,
            packed_trx: arrayToHex((signedTrx as any).serializedTransaction),
        };
        logger.info(
            `signed post for user:${post.user} sequence:${post.sequence}`
        );
        res.json(result);
    } catch (e) {
        next(e);
    }
});

server.listen(serverConfig.port, () => {
    logger.info(`listening at http://localhost:${serverConfig.port}`);
});

createWSServer("/posts", server, posts);
