import van from "vanjs-core";
import { eventBus } from "../eventbus.js";
import { OrganizationsData } from "./organizations.js";

const STORAGE_KEY = "vy_current_org_id";

class OrgContext {
    constructor() {
        this.orgsData = new OrganizationsData();

        this.currentOrgId = van.state(null);
        this.currentOrg = van.state(null);
        this.userOrgs = van.state([]);
        this.isLoading = van.state(true);

        this.userId = null;
    }

    async init(userId) {
        this.userId = userId;
        this.isLoading.val = true;

        const personalOrg = await this.orgsData.ensurePersonalOrg(userId);

        const orgs = await this.orgsData.getByUser(userId);
        this.userOrgs.val = this.sortOrgs(orgs || []);

        const storedOrgId = localStorage.getItem(STORAGE_KEY);
        const validOrg = this.userOrgs.val.find((o) => o.id === storedOrgId);

        if (validOrg) {
            await this.setCurrentOrg(storedOrgId, false);
        } else {
            await this.setCurrentOrg(personalOrg.id, false);
        }

        this.isLoading.val = false;
    }

    sortOrgs(orgs) {
        return orgs.slice().sort((a, b) => {
            if (a.isPersonal && !b.isPersonal) return -1;
            if (!a.isPersonal && b.isPersonal) return 1;
            return (a.name || "").localeCompare(b.name || "");
        });
    }

    async setCurrentOrg(orgId, fireEvent = true) {
        const org = this.userOrgs.val.find((o) => o.id === orgId);
        if (!org) {
            console.warn("Organization not found:", orgId);
            return false;
        }

        this.currentOrgId.val = orgId;
        this.currentOrg.val = org;
        localStorage.setItem(STORAGE_KEY, orgId);

        if (fireEvent) {
            eventBus.fire("org.changed", {
                orgId,
                org,
                isPersonal: org.isPersonal || false,
            });
        }

        return true;
    }

    async refreshOrgs() {
        if (!this.userId) return;

        const orgs = await this.orgsData.getByUser(this.userId);
        this.userOrgs.val = this.sortOrgs(orgs || []);

        const currentStillValid = this.userOrgs.val.find(
            (o) => o.id === this.currentOrgId.val
        );
        if (!currentStillValid) {
            const personal = this.userOrgs.val.find((o) => o.isPersonal);
            if (personal) {
                await this.setCurrentOrg(personal.id);
            }
        } else {
            this.currentOrg.val = currentStillValid;
        }
    }

    getPersonalOrg() {
        return this.userOrgs.val.find((o) => o.isPersonal);
    }
}

const orgContext = new OrgContext();

if (typeof window !== "undefined") {
    window._vy_orgContext = orgContext;
}

export { OrgContext, orgContext };
