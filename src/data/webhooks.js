import { database } from "./db.js";

const EXPIRE_TIME = 5 * 60 * 1000; // 5 minutes

class WebHooksData {
    constructor() {
        this.pending = {};
        this.cancelListener = null;
        this.expireTimer = null;
    }

    async restore(uid) {
        const rows = await database.query("webhooks", { uid: uid });
        if (!rows || rows.length === 0) {
            return;
        }
        for (const row of rows) {
            this.pending[row.key] = row.updated.toMillis();
        }
    }

    async listen(callback, expireCallback = null) {
        if (!callback)
            throw new Error(
                "Callback function is required for listening to webhooks."
            );

        this.cancelListener = await database.listen(
            "webhooks",
            async (webhooks) => {
                for (const webhook of webhooks) {
                    if (this.pending[webhook.key] && webhook.payload) {
                        delete this.pending[webhook.key];
                        await database.delete("webhooks", webhook.id);
                        callback(webhook.payload);
                    }
                }
            }
        );

        if (expireCallback) {
            this.expireTimer = setInterval(async () => {
                await this.expire(expireCallback);
            }, EXPIRE_TIME / 10);

            // Initial expire check after 1 second
            setTimeout(async () => {
                await this.expire(expireCallback);
            }, 1000);
        }
    }

    async expire(callback) {
        const now = new Date().getTime();
        for (const key in this.pending) {
            if (now - this.pending[key] > EXPIRE_TIME) {
                delete this.pending[key];
                await database.deleteAll("webhooks", { key: key });
                if (callback) {
                    callback(key);
                }
            }
        }
    }

    stopListening() {
        if (this.cancelListener) {
            this.cancelListener();
            this.cancelListener = null;
        }

        if (this.expireTimer) {
            clearInterval(this.expireTimer);
            this.expireTimer = null;
        }
    }

    async create(key, uid) {
        console.log(`Creating webhook with key: ${key}`);
        const result = await database.set("webhooks", {
            key: key,
            uid: uid,
        });

        this.pending[key] = new Date().getTime();

        return result;
    }

    async resolve(key, payload) {
        console.log(`Resolving webhook with key: ${key}`);
        const webhooks = await database.query("webhooks", { key: key });
        if (webhooks.length === 0) {
            throw new Error(`No webhook found for key: ${key}`);
        }

        const webhook = webhooks[0];
        return await database.update("webhooks", webhook.id, {
            payload: payload,
        });
    }
}

export { WebHooksData };
