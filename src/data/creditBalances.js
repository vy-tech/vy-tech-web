import { database } from "./db.js";

const COLLECTION = "credit_balances";

class CreditBalancesData {
    async getByOrg(oid) {
        const doc = await database.get(COLLECTION, oid);
        return doc ? doc.credits || 0 : 0;
    }
}

export { CreditBalancesData };
