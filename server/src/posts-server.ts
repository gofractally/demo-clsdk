import logger, { setupExpressLogger } from "./logger.js";
import Posts, { Post } from "./posts.js";
import * as WebSocket from "ws";
import * as http from "http";

export interface ClientMessage {
    requestBeforeIndex: number | null;
    requestAfterIndex: number | null;
    requestCount: number | null;
}

export interface ServerMessage {
    numAvailable: number | null;
    numIrreversible: number | null;
    thisIndex: number | null;
    thisPost: Post;
    endRequest: boolean;
}

class ConnectionState {
    haveCallback = false;

    constructor(public ws: WebSocket, public posts: Posts) {
        this.registerCallback();
        this.sendStatus();
    }

    registerCallback() {
        if (!this.haveCallback) {
            this.haveCallback = true;
            this.posts.callbacks.push(this);
        }
    }

    handleCallback(f: () => void) {
        try {
            this.haveCallback = false;
            f();
            this.registerCallback();
        } catch (e) {
            logger.error(`in callback: ${e.message}`);
            this.ws.close();
        }
    }

    undo(index: number) {
        this.handleCallback(() => {
            this.haveCallback = false;
            this.sendMsg({
                numAvailable: index,
                numIrreversible: null,
                thisIndex: null,
                thisPost: null,
                endRequest: false,
            });
        });
    }

    addPost(index: number, post: Post) {
        this.handleCallback(() => {
            this.haveCallback = false;
            this.sendMsg({
                numAvailable: this.posts.posts.length,
                numIrreversible: this.posts.irreversiblePost,
                thisIndex: index,
                thisPost: post,
                endRequest: false,
            });
        });
    }

    advancedIrreversible() {
        this.handleCallback(() => {
            this.haveCallback = false;
            this.sendMsg({
                numAvailable: this.posts.posts.length,
                numIrreversible: this.posts.irreversiblePost,
                thisIndex: null,
                thisPost: null,
                endRequest: false,
            });
        });
    }

    sendStatus() {
        try {
            this.sendMsg({
                numAvailable: this.posts.posts.length,
                numIrreversible: this.posts.irreversiblePost,
                thisIndex: null,
                thisPost: null,
                endRequest: false,
            });
        } catch (e) {
            logger.error(`sendStatus: ${e.message}`);
            this.ws.close();
        }
    }

    receive(msg: ClientMessage) {
        if (msg.requestBeforeIndex !== null)
            this.sendBefore(msg.requestBeforeIndex >> 0, msg.requestCount >> 0);
        else if (msg.requestAfterIndex !== null)
            this.sendAfter(msg.requestAfterIndex >> 0, msg.requestCount >> 0);
    }

    sendBefore(before: number, count: number) {
        count = Math.max(count, 20);
        for (
            let i = before - 1;
            i >= 0 && i < this.posts.posts.length && count > 0;
            --i, --count
        ) {
            this.sendMsg({
                numAvailable: this.posts.posts.length,
                numIrreversible: this.posts.irreversiblePost,
                thisIndex: i,
                thisPost: this.posts.posts[i],
                endRequest: false,
            });
        }
        this.sendMsg({
            numAvailable: null,
            numIrreversible: null,
            thisIndex: null,
            thisPost: null,
            endRequest: true,
        });
    }

    sendAfter(after: number, count: number) {
        count = Math.max(count, 20);
        for (
            let i = after + 1;
            i >= 0 && i < this.posts.posts.length && count > 0;
            ++i, --count
        ) {
            this.sendMsg({
                numAvailable: this.posts.posts.length,
                numIrreversible: this.posts.irreversiblePost,
                thisIndex: i,
                thisPost: this.posts.posts[i],
                endRequest: false,
            });
        }
        this.sendMsg({
            numAvailable: null,
            numIrreversible: null,
            thisIndex: null,
            thisPost: null,
            endRequest: true,
        });
    }

    sendMsg(msg: ServerMessage) {
        this.ws!.send(JSON.stringify(msg));
    }
} // ConnectionState

export function createWSServer(
    path: string,
    server: http.Server,
    posts: Posts
) {
    const wss = new WebSocket.WebSocketServer({ server, path });
    wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
        logger.info(`incoming ws connection, origin: ${req.headers.origin}`);
        const cs = new ConnectionState(ws, posts);
        ws.on("message", (message: string) => {
            try {
                cs.receive(JSON.parse(message));
            } catch (e) {
                logger.error(e);
                logger.error("closing incoming websocket");
                cs.ws = null;
                ws.close();
            }
        });
    });
}
