import { van, rsv } from "./rsvan.js";
import { eventBus } from "./eventbus.js";
import { orgContext } from "./data/orgContext.js";
import { CreditBalancesData } from "./data/creditBalances.js";
import { apiUtil } from "./util/apiUtil.js";

/**
 * Billing page — shows the current org's credit balance, lets owners
 * purchase credit packs via Stripe Checkout, and displays a unified activity
 * log (purchases, grants, and usage debits written by the processing service).
 */
class Billing {
    constructor() {
        this.balancesData = new CreditBalancesData();
        this.user = van.state(null);
        this.currentOrg = van.state(null);
        this.isOwner = van.state(false);
        this.balance = van.state(0);
        this.packs = van.state([]);
        this.history = van.state([]);
        this.loading = van.state(true);
        this.purchasing = van.state(null);
        this.toast = van.state(null);
    }

    init() {
        console.log("Initializing billing page...");
        eventBus.on("auth.unauthenticated", () => {
            window.location.href =
                "/users/login?return_url=" +
                encodeURIComponent(window.location.href);
        });

        eventBus.on("auth.ready", (e) => {
            this.user.val = e.detail.user;
        });

        eventBus.on("org.changed", () => {
            this.refresh();
        });

        this.checkPurchaseQuery();
        this.addElements();
    }

    checkPurchaseQuery() {
        const params = new URLSearchParams(window.location.search);
        const status = params.get("purchase");
        if (status === "success") {
            this.toast.val = {
                kind: "success",
                text: "Purchase complete. Credits will appear momentarily.",
            };
        } else if (status === "cancelled") {
            this.toast.val = {
                kind: "warn",
                text: "Purchase cancelled. No charges were made.",
            };
        }
        if (status) {
            // Strip the query param from the URL without reloading
            const url = new URL(window.location.href);
            url.searchParams.delete("purchase");
            window.history.replaceState({}, "", url.toString());
            setTimeout(() => (this.toast.val = null), 6000);
        }
    }

    async refresh() {
        console.log("Refreshing billing data...");
        const user = this.user.val;
        if (!user) throw new Error("User not authenticated");

        const org = orgContext.getCurrentOrg();
        if (!org) throw new Error("No organization selected");

        console.log("Current org:", org);
        this.loading.val = true;
        this.currentOrg.val = org;
        this.isOwner.val = (org.owners || []).includes(user.uid);

        try {
            this.balance.val = await this.balancesData.getByOrg(org.id);
            console.log("Loaded balance:", this.balance.val);
        } catch (err) {
            console.error("Failed to load balance:", err);
            this.balance.val = 0;
        }

        if (this.isOwner.val) {
            console.log("User is owner, loading packs and history...");
            await Promise.all([this.loadPacks(), this.loadHistory()]);
        } else {
            this.packs.val = [];
            this.history.val = [];
        }

        this.loading.val = false;
    }

    async loadPacks() {
        try {
            const res = await apiUtil.call("/api/billing/packs");
            console.log("Loaded credit packs:", res);
            this.packs.val = res.packs || [];
        } catch (err) {
            console.error("Failed to load credit packs:", err);
            this.packs.val = [];
        }
    }

    async loadHistory() {
        const org = this.currentOrg.val;
        if (!org) return;
        try {
            const res = await apiUtil.call(
                `/api/billing/history?oid=${encodeURIComponent(org.id)}&limit=100`
            );
            console.log("Loaded billing history:", res);
            this.history.val = res.history || [];
        } catch (err) {
            console.error("Failed to load billing history:", err);
            this.history.val = [];
        }
    }

    async handleBuy(packId) {
        const org = this.currentOrg.val;
        if (!org) return;

        this.purchasing.val = packId;
        try {
            const res = await apiUtil.call(
                "/api/billing/checkout/create",
                { oid: org.id, packId },
                "POST"
            );
            if (res?.url) {
                window.location = res.url;
            } else {
                throw new Error("No checkout URL returned");
            }
        } catch (err) {
            console.error("Checkout failed:", err);
            this.toast.val = {
                kind: "error",
                text: "Could not start checkout. Please try again.",
            };
            this.purchasing.val = null;
            setTimeout(() => (this.toast.val = null), 6000);
        }
    }

    addElements(parentElement) {
        const { div, main, h1 } = van.tags;
        parentElement =
            parentElement ||
            document.getElementById("main-content") ||
            document.getElementById("container") ||
            document.body;

        van.add(
            parentElement,
            main(
                { class: "w-[90%] p-4 overflow-auto" },
                div(
                    { class: "max-w-4xl mx-auto" },
                    h1(
                        { class: "text-2xl font-bold mb-6 dark:text-white" },
                        "Billing"
                    ),
                    () => this.renderToast(),
                    () => this.renderBody()
                )
            )
        );
    }

    renderToast() {
        const { div } = van.tags;
        const t = this.toast.val;
        if (!t) return div();
        const color =
            t.kind === "success"
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : t.kind === "warn"
                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                  : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
        return div({ class: `mb-4 p-3 rounded ${color}` }, t.text);
    }

    renderBody() {
        const { div, p } = van.tags;
        if (this.loading.val) {
            return div(
                { class: "text-gray-500 dark:text-gray-400 py-8 text-center" },
                "Loading…"
            );
        }
        if (!this.isOwner.val) {
            return div(
                {
                    class: "bg-white dark:bg-gray-800 rounded-lg shadow p-8 border border-gray-200 dark:border-gray-700",
                },
                p(
                    { class: "dark:text-white font-medium mb-2" },
                    "Only organization owners can manage billing."
                ),
                p(
                    { class: "text-sm text-gray-500 dark:text-gray-400" },
                    "Ask an owner of this organization to purchase credits on your behalf."
                )
            );
        }
        return div(
            { class: "space-y-6" },
            this.renderBalance(),
            this.renderPacks(),
            this.renderHistory()
        );
    }

    renderBalance() {
        const { div, p, span } = van.tags;
        const credits = this.balance.val;
        const minutes = Math.floor(credits / 10);
        return div(
            {
                class: "bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700",
            },
            p(
                { class: "text-sm text-gray-500 dark:text-gray-400" },
                "Credit balance"
            ),
            div(
                { class: "flex items-baseline gap-2 mt-1" },
                span(
                    { class: "text-4xl font-bold dark:text-white" },
                    credits.toLocaleString()
                ),
                span(
                    { class: "text-sm text-gray-500 dark:text-gray-400" },
                    `≈ ${minutes.toLocaleString()} min of processing`
                )
            )
        );
    }

    renderPacks() {
        const { div, h2, p } = van.tags;
        const { button } = rsv.tags;
        const packs = this.packs.val;
        return div(
            {
                class: "bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700",
            },
            h2(
                { class: "text-lg font-semibold mb-4 dark:text-white" },
                "Buy credits"
            ),
            packs.length === 0
                ? p(
                      { class: "text-gray-500 dark:text-gray-400" },
                      "No credit packs are currently available."
                  )
                : div(
                      { class: "grid gap-4 sm:grid-cols-2" },
                      ...packs.map((pack) =>
                          div(
                              {
                                  class: "border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col",
                              },
                              div(
                                  { class: "font-medium dark:text-white" },
                                  pack.label
                              ),
                              div(
                                  {
                                      class: "text-sm text-gray-500 dark:text-gray-400 mt-1",
                                  },
                                  `${pack.credits.toLocaleString()} credits for $${pack.priceUsd}`
                              ),
                              div(
                                  {
                                      class: "text-xs text-gray-400 dark:text-gray-500 mt-1",
                                  },
                                  "Plus applicable tax at checkout"
                              ),
                              div({ class: "flex-1" }, ""),
                              div(
                                  { class: "mt-4" },
                                  button(
                                      {
                                          name: `buy_${pack.id}`,
                                          onclick: () =>
                                              this.handleBuy(pack.id),
                                          disabled: () =>
                                              this.purchasing.val === pack.id,
                                      },
                                      () =>
                                          this.purchasing.val === pack.id
                                              ? "Redirecting…"
                                              : "Buy"
                                  )
                              )
                          )
                      )
                  )
        );
    }

    renderHistory() {
        const { div, h2, p, table, thead, tbody, tr, th, td, span } = van.tags;
        const rows = this.history.val;
        return div(
            {
                class: "bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700",
            },
            h2(
                { class: "text-lg font-semibold mb-4 dark:text-white" },
                "Activity"
            ),
            rows.length === 0
                ? p(
                      { class: "text-gray-500 dark:text-gray-400" },
                      "No activity yet."
                  )
                : div(
                      { class: "overflow-x-auto" },
                      table(
                          { class: "w-full text-sm" },
                          thead(
                              {
                                  class: "text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700",
                              },
                              tr(
                                  th({ class: "py-2 pr-4" }, "Date"),
                                  th({ class: "py-2 pr-4" }, "Type"),
                                  th({ class: "py-2 pr-4" }, "Description"),
                                  th(
                                      { class: "py-2 pr-4 text-right" },
                                      "Amount"
                                  ),
                                  th({ class: "py-2 text-right" }, "Balance")
                              )
                          ),
                          tbody(
                              ...rows.map((row) => {
                                  const sign = row.amount < 0 ? "" : "+";
                                  const amountColor =
                                      row.amount < 0
                                          ? "text-red-600 dark:text-red-400"
                                          : "text-green-600 dark:text-green-400";
                                  const typeLabel = this.formatType(row);
                                  return tr(
                                      {
                                          class: "border-b border-gray-100 dark:border-gray-700 last:border-0",
                                      },
                                      td(
                                          {
                                              class: "py-2 pr-4 dark:text-gray-200 whitespace-nowrap",
                                          },
                                          this.formatDate(row.created)
                                      ),
                                      td(
                                          { class: "py-2 pr-4" },
                                          span(
                                              {
                                                  class: "px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 dark:text-gray-200",
                                              },
                                              typeLabel
                                          )
                                      ),
                                      td(
                                          {
                                              class: "py-2 pr-4 dark:text-gray-200",
                                          },
                                          row.description || row.ref || ""
                                      ),
                                      td(
                                          {
                                              class: `py-2 pr-4 text-right font-medium ${amountColor}`,
                                          },
                                          `${sign}${row.amount.toLocaleString()}`
                                      ),
                                      td(
                                          {
                                              class: "py-2 text-right dark:text-gray-200",
                                          },
                                          (
                                              row.balanceAfter ?? 0
                                          ).toLocaleString()
                                      )
                                  );
                              })
                          )
                      )
                  )
        );
    }

    formatType(row) {
        switch (row.type) {
            case "purchase":
                return "Purchase";
            case "grant":
                return "Grant";
            case "debit":
                return "Usage";
            case "adjustment":
                return "Adjustment";
            default:
                return row.type || "—";
        }
    }

    formatDate(iso) {
        if (!iso) return "—";
        const d = new Date(iso);
        if (isNaN(d.getTime())) return "—";
        return d.toLocaleString();
    }
}

const billing = new Billing();
export { Billing, billing };
