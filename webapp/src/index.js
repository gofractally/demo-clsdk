import { JsSignatureProvider } from 'eosjs/dist/eosjs-jssig';
import { JsonRpc } from 'eosjs/dist/eosjs-jsonrpc';
import { Api } from 'eosjs/dist/eosjs-api';
import { KeyType } from 'eosjs/dist/eosjs-numeric';
import { SerialBuffer } from 'eosjs/dist/eosjs-serialize';
import { generateKeyPair, PrivateKey } from 'eosjs/dist/eosjs-key-conversions';

global.generateSessionPair = () => {
    const { publicKey, privateKey } = generateKeyPair(KeyType.k1, { secureEnv: true });
    document.getElementById("session_public").value = publicKey;
    document.getElementById("session_private").value = privateKey;
}

global.submitSessionPair = async () => {
    try {
        const rpc = new JsonRpc(document.getElementById("rpc").value);
        const signatureProvider = new JsSignatureProvider([
            document.getElementById("pk").value
        ]);
        const api = new Api({ rpc, signatureProvider });
        const trx = {
            actions: [{
                account: "freetalk",
                name: "registerkey",
                authorization: [{
                    actor: document.getElementById("account").value,
                    permission: 'active',
                }],
                data: {
                    user: document.getElementById("account").value,
                    key: document.getElementById("session_public").value,
                },
            }]
        };
        console.log(JSON.stringify(trx, null, 4));
        const result = await api.transact(trx, { useLastIrreversible: true, expireSeconds: 4 });
        document.getElementById('register_result').textContent = JSON.stringify(result, null, 4);
    } catch (e) {
        console.error(e);
        document.getElementById('register_result').textContent = e + '';
    }
}

global.post = async () => {
    try {
        const post = {
            user: document.getElementById("account").value,
            sequence: +document.getElementById("sequence").value,
            message: document.getElementById("message").value,
        };

        // Serialize the post
        const buf = new SerialBuffer();
        buf.pushName(post.user);
        buf.pushUint32(post.sequence);
        buf.pushString(post.message);

        // Sign the post using the session key
        const sessionKey = PrivateKey.fromString(document.getElementById("session_private").value);
        const signature = sessionKey.sign(buf.asUint8Array(), true);

        // Send the transaction
        const rpc = new JsonRpc(document.getElementById("rpc").value);
        const signatureProvider = new JsSignatureProvider([
            // This is the well-known private key for thepayer@freebie
            '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'
        ]);
        const api = new Api({ rpc, signatureProvider });
        const trx = {
            actions: [{
                account: "freetalk",
                name: "acceptcharge",
                authorization: [{
                    actor: 'thepayer',
                    permission: 'freebie',
                }],
                data: {},
            }, {
                account: "freetalk",
                name: "createpost",
                authorization: [],
                data: {
                    signature: signature.toString(),
                    post,
                },
            }]
        };
        console.log(JSON.stringify(trx, null, 4));
        const result = await api.transact(trx, { useLastIrreversible: true, expireSeconds: 4 });
        document.getElementById('post_result').textContent = JSON.stringify(result, null, 4);
    } catch (e) {
        console.error(e);
        document.getElementById('post_result').textContent = e + '';
    }
} // post()

global.getPosts = async () => {
    const rpc = new JsonRpc(document.getElementById("rpc").value);
    const result = await rpc.get_table_rows({ code: 'freetalk', table: 'post', scope: 0, limit: 1000 });
    console.log(result);
    const table = document.getElementById("posts");
    while (table.firstChild)
        table.removeChild(table.firstChild);
    for (const row of result.rows) {
        const tr = document.createElement('tr');
        table.appendChild(tr);
        function td(s) {
            const t = document.createElement('td');
            tr.appendChild(t);
            t.append(s);
        }
        td(row.id);
        td(row.user);
        td(row.sequence);
        td(row.message);
    }
}
