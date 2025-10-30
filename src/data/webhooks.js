import { database } from "./db.js";

class WebHooksData {
    constructor() {
        this.pending = {};
        this.cancelListener = null;
    }

    async restore(uid) {
        const rows = await database.query("webhooks", { uid: uid });
        if (!rows || rows.length === 0) {
            return;
        }
        for (const row of rows) {
            this.pending[row.key] = true;
        }
    }

    listen(callback) {
        this.cancelListener = database.listen("webhooks", async (webhooks) => {
            for (const webhook of webhooks) {
                if (this.pending[webhook.key] && webhook.payload) {
                    delete this.pending[webhook.key];
                    await database.delete("webhooks", webhook.id);
                    callback(webhook.payload);
                }
            }
        });
    }

    stopListening() {
        if (this.cancelListener) {
            this.cancelListener();
            this.cancelListener = null;
        }
    }

    async create(key, uid) {
        console.log(`Creating webhook with key: ${key}`);
        const result = await database.set("webhooks", {
            key: key,
            uid: uid,
        });

        this.pending[key] = true;

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
