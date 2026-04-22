import { database, serverTimestamp } from "./db.js";
import { JobsData } from "./jobs.js";

/**
 * Server-side credit mutation helpers. These must only run server-side —
 * client Firestore rules deny writes on `credit_balances` and `credit_ledger`.
 */

/**
 * Grant (or debit, with a negative amount) credits to an organization.
 * Writes a ledger row and atomically updates the balance.
 *
 * Options:
 *   oid         — target org id (required)
 *   amount      — integer; positive grants, negative adjusts (required)
 *   source      — "admin" | "stripe" | "system" | "processing"
 *   type        — optional override; defaults to "grant" / "adjustment" /
 *                 "debit" based on source and sign
 *   uid         — actor user id, or null for system
 *   description — human-readable description
 *   ref         — external reference (session id, job id, etc.)
 *   onlyIfNew   — if true, skip the grant when a balance doc already exists
 *                 for this org. Returns { skipped: true } in that case. Used
 *                 for the one-shot welcome grant.
 *
 * Returns { balanceAfter, ledgerId } on success, or { skipped: true } if
 * onlyIfNew was set and a balance already existed.
 */
export async function grantCredits({
    oid,
    amount,
    source,
    type = null,
    uid = null,
    description,
    ref = null,
    onlyIfNew = false,
}) {
    if (!oid) throw new Error("grantCredits: oid required");
    if (!Number.isFinite(amount) || amount === 0) {
        throw new Error("grantCredits: non-zero integer amount required");
    }

    const resolvedType =
        type ||
        (source === "stripe"
            ? "purchase"
            : amount < 0
              ? source === "processing"
                  ? "debit"
                  : "adjustment"
              : "grant");

    const result = await database.transaction(async (tx) => {
        const balance = await tx.get("credit_balances", oid);

        if (onlyIfNew && balance) {
            return { skipped: true };
        }

        const current = balance ? balance.credits || 0 : 0;
        const next = current + amount;

        tx.set("credit_balances", {
            id: oid,
            oid,
            credits: next,
            created: balance?.created || serverTimestamp(),
        });

        const ledgerId = tx.set("credit_ledger", {
            oid,
            type: resolvedType,
            amount,
            balanceAfter: next,
            uid,
            source,
            ref,
            description,
        });

        return { balanceAfter: next, ledgerId };
    });

    if (!result.skipped && amount > 0) {
        await new JobsData().resetRejectedByOrg(oid);
    }

    return result;
}
