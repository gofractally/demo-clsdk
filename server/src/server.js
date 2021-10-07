import { serverConfig, publicConfig } from './config.js';
import { JsSignatureProvider } from "eosjs/dist/eosjs-jssig.js";
import { JsonRpc } from "eosjs/dist/eosjs-jsonrpc.js";
import { Api } from "eosjs/dist/eosjs-api.js";
import { arrayToHex } from "eosjs/dist/eosjs-serialize.js";
import fetch from "node-fetch";
import logger from './logger.js';
import express from 'express';

const app = express();
const rpc = new JsonRpc(publicConfig.chainRpcUrl, { fetch });
const signatureProvider = new JsSignatureProvider([serverConfig.privateKey]);
const api = new Api({ rpc, signatureProvider });

app.use(express.json());
app.use(express.static('../webapp/dist'));

app.get('/config.json', (req, res) => {
    res.json(publicConfig);
});

app.post('/sign_post_trx', async (req, res, next) => {
    try {
        const post = {
            user: req.body.post?.user + '',
            sequence: +req.body.post?.sequence,
            name: req.body.post?.name + '',
            message: req.body.post?.message + '',
        };
        const postSignature = req.body.signature + '';
        const trx = {
            actions: [
                {
                    account: publicConfig.talkContract,
                    name: "acceptcharge",
                    authorization: [
                        {
                            actor: publicConfig.serverPaysAccount,
                            permission: publicConfig.serverPaysPermission,
                        },
                    ],
                    data: {},
                },
                {
                    account: publicConfig.talkContract,
                    name: "createpost",
                    authorization: [],
                    data: {
                        signature: postSignature,
                        post,
                    },
                },
            ],
        };
        const signedTrx = await api.transact(trx, {
            broadcast: false,
            blocksBehind: 3,
            expireSeconds: 60,
        });
        const result = {
            signatures: signedTrx.signatures,
            packed_trx: arrayToHex(signedTrx.serializedTransaction),
        };
        logger.info(`signed post for user:${post.user} sequence:${post.sequence}`);
        res.json(result);
    } catch (e) {
        next(e);
    }
});

app.listen(serverConfig.port, () => {
    logger.info(`listening at http://localhost:${serverConfig.port}`)
});
