import logger from "./logger.js";
import { DfuseTrx } from "./dfuse-receiver.js";
import { publicConfig } from "./config.js";

export interface Post {
    user: string;
    message: string;
}

export interface PostCallback {
    undo: (index: number) => void;
    addPost: (index: number, post: Post) => void;
    advancedIrreversible: () => void;
}

export default class Posts {
    posts = [] as Post[];
    blocks = new Map<string, number>();
    irreversibleBlock = 0;
    irreversiblePost = 0;
    callbacks = [] as PostCallback[];

    pushTrx(trx: DfuseTrx) {
        if (trx.undo) {
            if (this.blocks.has(trx.block.num + "")) {
                const index = this.blocks.get(trx.block.num + "");
                this.blocks.delete(trx.block.num + "");
                this.posts.splice(index);
                this.callCallbacks((callback) => callback.undo(index));
            }
        } else if (trx.trace.status === "EXECUTED") {
            if (!this.blocks.has(trx.block.num + ""))
                this.blocks.set(trx.block.num + "", this.posts.length);
            for (const action of trx.trace.matchingActions) {
                if (
                    action.account === publicConfig.talkContract &&
                    action.name === "createpost" &&
                    action.json
                ) {
                    this.posts.push({
                        user: action.json.post.user,
                        message: action.json.post.message,
                    });
                    this.callCallbacks((callback) =>
                        callback.addPost(
                            this.posts.length - 1,
                            this.posts[this.posts.length - 1]
                        )
                    );
                }
            }
            if (trx.irreversibleBlockNum > this.irreversibleBlock) {
                this.irreversibleBlock = trx.irreversibleBlockNum;
                if (this.blocks.has(this.irreversibleBlock + "")) {
                    this.irreversiblePost = this.blocks.get(
                        this.irreversibleBlock + ""
                    );
                    this.callCallbacks((callback) =>
                        callback.advancedIrreversible()
                    );
                }
            }
        }
    }

    callCallbacks(f: (callback: PostCallback) => void) {
        const callbacks = this.callbacks;
        this.callbacks = [];
        for (const callback of callbacks) {
            try {
                f(callback);
            } catch (e: any) {
                logger.error(`sendNotifications: ${e.message}`);
            }
        }
    }
}
