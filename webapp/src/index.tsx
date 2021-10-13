"use strict";

import { JsonRpc } from "eosjs/dist/eosjs-jsonrpc";
import { KeyType } from "eosjs/dist/eosjs-numeric";
import { SerialBuffer } from "eosjs/dist/eosjs-serialize";
import {
    generateKeyPair,
    PrivateKey,
    PublicKey,
} from "eosjs/dist/eosjs-key-conversions";
import AnchorLinkBrowserTransport from "anchor-link-browser-transport";
import AnchorLink, { Name } from "anchor-link";
import * as ReactDOM from "react-dom";
import * as React from "react";
import { ToastProvider, useToasts, AddToast } from "react-toast-notifications";
import useInfiniteScroll from "react-infinite-scroll-hook";
import { Post } from "../../server/src/posts";
import { ClientMessage, ServerMessage } from "../../server/src/posts-server";
import {
    EdenChainContext,
    useCreateEdenChain,
    useQuery,
} from "@edenos/eden-subchain-client/dist/ReactSubchain";

global.Buffer = require("buffer/").Buffer;

let config: any;

type StateHook<T> = [T, (value: T) => void];

interface PostSession {
    account: Name;
    name?: string;
    publicKey?: PublicKey;
    privateKey?: PrivateKey;
    nextSequence: number;
}
const PostSessionContext =
    React.createContext<StateHook<PostSession>>(undefined);

let rpc: JsonRpc;
const transport = new AnchorLinkBrowserTransport();
let link: AnchorLink;

async function login(
    setPostSession: (value: PostSession) => void,
    addToast: AddToast
) {
    try {
        // Login
        if (!rpc) rpc = new JsonRpc(config.chainRpcUrl);
        if (!link)
            link = new AnchorLink({
                transport,
                chains: [
                    {
                        chainId: config.chainId,
                        nodeUrl: config.chainRpcUrl,
                    },
                ],
            });
        const { session } = await link.login(config.talkContract);

        // New session
        let postSession: PostSession = {
            account: session.auth.actor,
            nextSequence: 0,
        };
        addToast(`Logged in as ${postSession.account.toString()}`, {
            appearance: "success",
            autoDismiss: true,
        });

        // Fetch user name from Eden
        const members = await rpc.get_table_rows({
            code: config.edenContract,
            table: "member",
            scope: 0,
            lower_bound: " " + session.auth.actor,
            limit: 1,
        });
        if (
            members.rows.length < 1 ||
            members.rows[0][1].account != session.auth.actor
        )
            throw new Error(
                `Account not found in ${config.edenContract} member table`
            );

        postSession = {
            ...postSession,
            name: members.rows[0][1].name,
            ...generateKeyPair(KeyType.k1, { secureEnv: true }),
        };
        addToast(`Welcome Eden Member ${postSession.name}!`, {
            appearance: "success",
            autoDismiss: true,
        });

        // Fetch nextSequence, if available. Adds 10 just in case any posts
        // are still propagating through the network.
        try {
            const userkey = await rpc.get_table_rows({
                code: config.talkContract,
                table: "userkey",
                scope: 0,
                lower_bound: " " + session.auth.actor,
                limit: 1,
            });
            if (
                userkey.rows.length === 1 &&
                userkey.rows[0].user.toString() ===
                    session.auth.actor.toString() &&
                userkey.rows[0].sequences.length > 0
            )
                postSession.nextSequence =
                    userkey.rows[0].sequences[
                        userkey.rows[0].sequences.length - 1
                    ] + 10;
        } catch (e) {}

        // Register session key
        const action = {
            account: config.talkContract,
            name: "registerkey",
            authorization: [session.auth],
            data: {
                user: session.auth.actor,
                key: postSession.publicKey.toString(),
            },
        };
        const result = await session.transact({ action });

        // Done
        addToast(
            `Key ${postSession.publicKey.toString()} registered. You are ready to post!`,
            {
                appearance: "success",
                autoDismiss: true,
            }
        );
        setPostSession(postSession);
    } catch (e) {
        console.log(e);
        addToast(e.message, { appearance: "error", autoDismiss: true });
    }
}

async function post(
    postSession: PostSession,
    message: string,
    addToast: AddToast
) {
    try {
        if (!message) throw new Error("Nothing to post");

        const post = {
            user: postSession.account.toString(),
            sequence: postSession.nextSequence++,
            message: message,
        };

        // Serialize the post
        const buf = new SerialBuffer();
        buf.pushName(post.user);
        buf.pushUint32(post.sequence);
        buf.pushString(post.message);

        // Sign the post using the session key
        const signature = postSession.privateKey.sign(buf.asUint8Array(), true);

        // Server creates and signs the transaction
        const res = await fetch("/sign_post_trx", {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ post, signature: signature.toString() }),
        });
        if (!res.ok) throw new Error(res.statusText);
        const signedTrx = await res.json();
        console.log(signedTrx);

        // Send the transaction
        await rpc.fetch("/v1/chain/push_transaction", {
            signatures: signedTrx.signatures,
            compression: 0,
            packed_context_free_data: "",
            packed_trx: signedTrx.packed_trx,
        });

        addToast(
            `posted sequence ${post.sequence} with message\n${post.message}`,
            {
                appearance: "success",
                autoDismiss: true,
            }
        );
    } catch (e) {
        console.log(e);
        addToast(e.message, { appearance: "error", autoDismiss: true });
    }
}

function Login() {
    const [postSession, setPostSession] = React.useContext(PostSessionContext);
    const { addToast } = useToasts();
    return (
        <div>
            <button onClick={(e) => login(setPostSession, addToast)}>
                Log in using Anchor
            </button>
        </div>
    );
}

function Poster() {
    const [postSession, setPostSession] = React.useContext(PostSessionContext);
    const [message, setMessage] = React.useState("");
    const { addToast } = useToasts();
    if (!postSession?.privateKey) return <></>;
    return (
        <div>
            <h2>Post as {postSession.name}</h2>
            <input
                size={80}
                onChange={(e) => setMessage(e.target.value)}
            ></input>
            <br />
            <button onClick={(e) => post(postSession, message, addToast)}>
                Post message
            </button>
        </div>
    );
}

function usePosts() {
    // non-signalling state
    const [state] = React.useState({
        ws: null as WebSocket,
        numIrreversible: 0,
        numAvailable: 0,
        posts: [] as { index: number; post: Post }[],
        firstPost: 0,
        needFork: false,
        loading: false,
        reconnect: true,
    });
    let [changedCounter, setChangedCounter] = React.useState(0);

    function fork(index: number) {
        if (state.firstPost + state.posts.length > index) {
            state.posts.splice(index - state.firstPost);
            setChangedCounter(++changedCounter);
        }
    }

    function send(msg: ClientMessage) {
        state.ws.send(JSON.stringify(msg));
    }

    function createWS() {
        if (!state.reconnect) return;

        let loc;
        if (window.location.protocol === "https:")
            loc = "wss://" + window.location.host + "/posts";
        else loc = "ws://" + window.location.host + "/posts";
        state.ws = new WebSocket(loc);

        state.ws.onmessage = (e) => {
            const data = JSON.parse(e.data) as ServerMessage;
            if (data.numAvailable !== null) {
                fork(data.numAvailable);
                state.numAvailable = data.numAvailable;
            }
            if (data.numIrreversible !== null && !state.needFork)
                state.numIrreversible = data.numIrreversible;
            if (data.thisIndex !== null) {
                if (state.needFork) {
                    fork(state.numIrreversible);
                    state.needFork = false;
                }
                if (
                    state.posts.length === 0 ||
                    data.thisIndex === state.firstPost - 1
                ) {
                    state.posts.unshift({
                        index: data.thisIndex,
                        post: data.thisPost,
                    });
                    state.firstPost = data.thisIndex;
                    setChangedCounter(++changedCounter);
                } else if (
                    data.thisIndex ===
                    state.firstPost + state.posts.length
                ) {
                    state.posts.push({
                        index: data.thisIndex,
                        post: data.thisPost,
                    });
                    setChangedCounter(++changedCounter);
                }
            }
            if (data.endRequest) {
                state.loading = false;
                setChangedCounter(++changedCounter);
            }
        };
        state.ws.onclose = (e) => {
            console.log("socket closed");
            state.needFork = true;
            state.loading = false;
            setTimeout(createWS, 0);
        };
    }
    React.useEffect(createWS, []);
    React.useEffect(() => {
        return () => {
            state.reconnect = false;
            if (state.ws) state.ws.close();
        };
    }, []);

    return {
        ...state,
        loadMore() {
            console.log("loadMore...");
            if (state.posts.length === 0 && state.numAvailable) {
                send({
                    requestBeforeIndex: state.numAvailable,
                    requestAfterIndex: null,
                    requestCount: 10,
                });
                state.loading = true;
            } else if (state.firstPost > 0) {
                send({
                    requestBeforeIndex: state.firstPost,
                    requestAfterIndex: null,
                    requestCount: 10,
                });
                state.loading = true;
            }
        },
    };
} // usePosts

function User(props: { account: string }) {
    return <></>;
}

function DisplayPost(props: { index: number; post: Post }) {
    const profile = useQuery(`
    {
      members(
        ge: ${JSON.stringify(props.post.user)},
        le: ${JSON.stringify(props.post.user)}) {
        edges {
          node {
            profile {
              name
              img
            }
          }
        }
      }
    }`).data?.members.edges[0]?.node.profile;
    return (
        <div key={props.index} style={{ margin: 10, background: "cyan" }}>
            <table>
                <tbody>
                    <tr>
                        <td rowSpan={3} style={{ width: 40, height: 40 }}>
                            <img
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: "50%",
                                }}
                                src={
                                    profile
                                        ? config.ipfsBaseUrl + "/" + profile.img
                                        : ""
                                }
                            ></img>
                        </td>
                        <td>{props.index}</td>
                    </tr>
                    <tr>
                        <td>{profile ? profile.name : props.post.user}</td>
                    </tr>
                    <tr>
                        <td>{props.post.message}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

function Posts() {
    const state = usePosts();
    const [sentryRef, { rootRef }] = useInfiniteScroll({
        loading: state.loading,
        hasNextPage: state.firstPost > 0 || state.posts.length === 0,
        onLoadMore: state.loadMore,
    });
    return (
        <div
            style={{
                flexGrow: 1,
                marginTop: 10,
                overflowY: "scroll",
            }}
        >
            {state.posts
                .map((item) => (
                    <DisplayPost
                        index={item.index}
                        post={item.post}
                    ></DisplayPost>
                ))
                .reverse()}

            {(state.firstPost > 0 || state.posts.length === 0) && (
                <div ref={sentryRef} style={{ margin: 10, background: "cyan" }}>
                    <table>
                        <tbody>
                            <tr>
                                <td>Number</td>
                                <td>Loading...</td>
                            </tr>
                            <tr>
                                <td>User</td>
                                <td></td>
                            </tr>
                            <tr>
                                <td>Message</td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function Page() {
    const loginHook = React.useState<PostSession>();
    const subchain = useCreateEdenChain({
        fetch,
        wasmUrl: `https://${config.subchain}/eden-micro-chain.wasm`,
        stateUrl: `https://${config.subchain}/state`,
        blocksUrl: `wss://${config.subchain}/eden-microchain`,
    });

    return (
        <ToastProvider>
            <PostSessionContext.Provider value={loginHook}>
                <EdenChainContext.Provider value={subchain}>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            height: "100%",
                        }}
                    >
                        <Login />
                        <Poster />
                        <Posts />
                    </div>
                </EdenChainContext.Provider>
            </PostSessionContext.Provider>
        </ToastProvider>
    );
}

(async () => {
    const res = await fetch("config.json");
    config = await res.json();
    console.log(JSON.stringify(config, null, 4));
    ReactDOM.render(<Page />, document.body);
})();
