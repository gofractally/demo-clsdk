import { dfuseConfig, publicConfig } from "./config.js";
import logger from "./logger.js";
import Posts from "./posts.js";
import { createDfuseClient, GraphqlStreamMessage, Stream } from "@dfuse/client";
import * as fs from "fs";
import nodeFetch from "node-fetch";
import WebSocketClient from "ws";
import { performance } from "perf_hooks";

const query = `
subscription ($query: String!, $cursor: String, $limit: Int64, $low: Int64,
              $high: Int64, $irrev: Boolean, $interval: Uint32) {
    searchTransactionsForward(
                query: $query, lowBlockNum: $low, highBlockNum: $high,
                limit: $limit, cursor: $cursor, irreversibleOnly: $irrev,
                liveMarkerInterval: $interval) {
        undo
        cursor
        irreversibleBlockNum
        block {
            num
            id
            timestamp
            previous
        }
        trace {
            id
            status
            matchingActions {
                seq
                receiver
                account
                name
                json
            }
        }
    }
}`;

export interface DfuseTrx {
    undo: boolean;
    cursor: string;
    irreversibleBlockNum: number;
    block: {
        num: number;
        id: string;
        timestamp: string;
        previous: string;
    };
    trace: {
        id: string;
        status: string;
        matchingActions: [
            {
                seq: number;
                receiver: string;
                account: string;
                name: string;
                json: any;
            }
        ];
    };
}

async function webSocketFactory(
    url: string,
    protocols: string[] = []
): Promise<WebSocketClient> {
    const webSocket = new WebSocketClient(url, protocols, {
        handshakeTimeout: 30 * 1000, // 30s
        maxPayload: 10 * 1024 * 1024,
    });
    return webSocket;
}

export default class DfuseReceiver {
    posts: Posts;
    stream: Stream | null = null;
    jsonTransactions: DfuseTrx[] = [];
    numSaved = 0;

    queryString = `(
        receiver:${publicConfig.talkContract} account:${publicConfig.talkContract}
    )`;

    variables = {
        query: this.queryString,
        cursor: "",
        low: dfuseConfig.firstBlock,
        limit: 0,
        irrev: false,
        interval: dfuseConfig.interval,
    };

    dfuseClient = createDfuseClient({
        apiKey: dfuseConfig.apiKey,
        network: dfuseConfig.apiNetwork,
        authUrl: dfuseConfig.authNetwork,
        httpClientOptions: {
            fetch: nodeFetch,
        },
        graphqlStreamClientOptions: {
            socketOptions: {
                webSocketFactory: (url: string) =>
                    webSocketFactory(url, ["graphql-ws"]),
            },
        },
        streamClientOptions: {
            socketOptions: {
                webSocketFactory,
            },
        },
    });

    constructor(posts: Posts) {
        this.posts = posts;
    }

    onMessage(message: GraphqlStreamMessage<any>, stream: Stream): void {
        try {
            if (message.type === "data") {
                const trx: DfuseTrx = message.data.searchTransactionsForward;
                const prev =
                    this.jsonTransactions.length > 0
                        ? this.jsonTransactions[
                              this.jsonTransactions.length - 1
                          ]
                        : null;
                logger.info(
                    `${trx.undo ? "undo block" : "recv block"} ${
                        trx.block.num
                    } ${
                        trx.trace
                            ? "trx " + trx.trace.id
                            : "no matching transactions"
                    }`
                );
                if (
                    trx.trace ||
                    (prev && prev.trace && prev.block.num < trx.block.num)
                ) {
                    this.jsonTransactions.push(trx);
                    this.posts.pushTrx(trx);
                    if (
                        this.jsonTransactions.length - this.numSaved > 10 ||
                        !trx.trace
                    ) {
                        logger.info(
                            `save ${dfuseConfig.jsonTrxFile}: ${this.jsonTransactions.length} transactions and undo entries`
                        );
                        fs.writeFileSync(
                            dfuseConfig.jsonTrxFile + ".tmp",
                            JSON.stringify(this.jsonTransactions)
                        );
                        fs.renameSync(
                            dfuseConfig.jsonTrxFile + ".tmp",
                            dfuseConfig.jsonTrxFile
                        );
                        this.numSaved = this.jsonTransactions.length;
                    }
                }
                stream.mark({
                    cursor: trx.cursor,
                });
            } else if (message.type === "complete") {
                logger.error(`DfuseReceiver.onMessage: ${message.type}`);
                logger.error("DfuseReceiver.onMessage: closing stream");
                this.disconnect();
                logger.error(
                    "DfuseReceiver.onMessage: scheduling retry in 1 sec"
                );
                setTimeout(() => {
                    this.connect();
                }, 1000);
            } else if (message.type === "error") {
                logger.error(JSON.stringify(message, null, 4));
            } else {
                logger.info(
                    `DfuseReceiver.onMessage: ${(message as any).type}`
                );
            }
        } catch (e: any) {
            logger.error(e);
            logger.error("DfuseReceiver.onMessage: closing stream");
            this.disconnect();
        }
    }

    async start() {
        try {
            try {
                this.jsonTransactions = JSON.parse(
                    fs.readFileSync(dfuseConfig.jsonTrxFile, "utf8")
                );
                this.numSaved = this.jsonTransactions.length;
            } catch (e) {}

            const begin = performance.now();
            logger.info("pushing existing blocks...");
            for (let trx of this.jsonTransactions) this.posts.pushTrx(trx);
            logger.info(`${performance.now() - begin} ms`);

            if (dfuseConfig.connect) await this.connect();
        } catch (e: any) {
            logger.error(e);
            process.exit(1);
        }
    } // start()

    async connect() {
        if (this.stream) {
            logger.info(`already connected`);
            return;
        }
        try {
            logger.info(`connecting to ${dfuseConfig.apiNetwork}`);
            if (!this.jsonTransactions.length && dfuseConfig.firstBlock === 1)
                logger.warn(
                    "Don't have an existing dfuse cursor and DFUSE_FIRST_BLOCK isn't greater than 1; " +
                        "this may take a while before the first result comes..."
                );
            if (this.jsonTransactions.length)
                this.variables.cursor =
                    this.jsonTransactions[
                        this.jsonTransactions.length - 1
                    ].cursor;
            this.stream = await this.dfuseClient.graphql(
                query,
                this.onMessage.bind(this),
                {
                    operationType: "subscription",
                    variables: this.variables,
                }
            );
            logger.info("dfuse is now connected");
        } catch (e: any) {
            logger.error(e);
            logger.info("scheduling retry in 10 min");
            setTimeout(() => {
                this.connect();
            }, 10 * 60 * 1000);
        }
    }

    disconnect() {
        if (this.stream) {
            try {
                this.stream.close();
            } catch (e: any) {
                logger.error(e);
                logger.error("DfuseReceiver.disconnect: close failed");
            }
            this.stream = null;
        }
    }
}
