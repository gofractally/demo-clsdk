"use strict";

import { JsSignatureProvider } from "eosjs/dist/eosjs-jssig";
import { JsonRpc } from "eosjs/dist/eosjs-jsonrpc";
import { Api } from "eosjs/dist/eosjs-api";
import { KeyType } from "eosjs/dist/eosjs-numeric";
import { SerialBuffer } from "eosjs/dist/eosjs-serialize";
import {
    generateKeyPair,
    PrivateKey,
    PublicKey,
} from "eosjs/dist/eosjs-key-conversions";
import AnchorLinkBrowserTransport from "anchor-link-browser-transport";
import AnchorLink, { LinkSession, Name } from "anchor-link";
import * as ReactDOM from "react-dom";
import * as React from "react";
import { ToastProvider, useToasts, AddToast } from "react-toast-notifications";

global.Buffer = require("buffer/").Buffer;

let config: any;
(async () => {
    const res = await fetch("config.json");
    config = await res.json();
    console.log(JSON.stringify(config, null, 4));
})();

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
                "Account not found in ${config.edenContract} member table"
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
            name: postSession.name,
            message: message,
        };

        // Serialize the post
        const buf = new SerialBuffer();
        buf.pushName(post.user);
        buf.pushUint32(post.sequence);
        buf.pushString(post.name.toString());
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
        <button onClick={(e) => login(setPostSession, addToast)}>
            Log in using Anchor
        </button>
    );
}

function Post() {
    const [postSession, setPostSession] = React.useContext(PostSessionContext);
    const [message, setMessage] = React.useState("");
    const { addToast } = useToasts();
    if (!postSession?.privateKey) return <></>;
    return (
        <>
            <h2>Post as {postSession.name}</h2>
            <input
                size={80}
                onChange={(e) => setMessage(e.target.value)}
            ></input>
            <br />
            <button onClick={(e) => post(postSession, message, addToast)}>
                Post message
            </button>
        </>
    );
}

function Page() {
    const loginHook = React.useState<PostSession>();

    return (
        <ToastProvider>
            <PostSessionContext.Provider value={loginHook}>
                <Login />
                <Post />
            </PostSessionContext.Provider>
        </ToastProvider>
    );
}

ReactDOM.render(<Page />, document.body);
