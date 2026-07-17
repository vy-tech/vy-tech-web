import { getAuth } from "firebase-admin/auth";

import { OrganizationsData } from "../data/organizations.js";

// Members of this org's `owners` array are treated as Vy admins. The prod id
// is baked in; dev/staging can override via the VY_ADMIN_OID env var.
const VY_ADMIN_OID = process.env.VY_ADMIN_OID || "00hB8gSxKMs5SSLCCbyi";

async function isAdmin(uid) {
    if (!uid) return false;
    try {
        const orgsData = new OrganizationsData();
        const adminOrg = await orgsData.getById(VY_ADMIN_OID);
        if (!adminOrg) {
            console.warn("Vy admin org not found:", VY_ADMIN_OID);
            return false;
        }
        return (adminOrg.owners || []).includes(uid);
    } catch (err) {
        console.error("Admin check failed:", err);
        return false;
    }
}

async function getOrg(oid) {
    if (!oid) return null;
    try {
        const orgsData = new OrganizationsData();
        const org = await orgsData.getById(oid);
        return org || null;
    } catch (err) {
        console.error("Error fetching organization:", err);
        return null;
    }
}

async function requireAdmin(req, res, next) {
    if (!(await isAdmin(req.uid))) {
        return res.status(403).json({ error: "Admin access required" });
    }
    next();
}

// Helper to check if request is authenticated
const isAuthenticated = async (req) => {
    try {
        // Get the Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return {
                authenticated: false,
                error: "No valid authorization header",
            };
        }

        // Extract the ID token
        const idToken = authHeader.split("Bearer ")[1];

        // Verify the ID token
        const decodedToken = await getAuth().verifyIdToken(idToken);

        return {
            authenticated: true,
            uid: decodedToken.uid,
            user: decodedToken,
        };
    } catch (error) {
        console.error("Authentication error:", error);
        return {
            authenticated: false,
            error: "Invalid token",
        };
    }
};

// Authentication middleware
const requireAuth = async (req, res, next) => {
    const authResult = await isAuthenticated(req);

    if (!authResult.authenticated) {
        console.warn("Unauthorized access attempt");
        return res.status(401).json({
            error: "Unauthorized",
            message: authResult.error,
        });
    }

    // Add user info to request object for use in route handlers
    req.user = authResult.user;
    req.uid = authResult.uid;

    next();
};

export {
    isAuthenticated,
    requireAuth,
    getAuth,
    VY_ADMIN_OID,
    isAdmin,
    requireAdmin,
    getOrg,
};
