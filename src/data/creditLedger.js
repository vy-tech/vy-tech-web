import { database } from "./db.js";

const COLLECTION = "credit_ledger";

class CreditLedgerData {
    async getByOrg(oid, limit = 50) {
        const rows = await database.query(
            COLLECTION,
            { oid },
            { key: "created", dir: "desc" }
        );
        return (rows || []).slice(0, limit);
    }
}

export { CreditLedgerData };
