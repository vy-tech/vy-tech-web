import "../firebase-shim.js";

import express from "express";
import { onRequest } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";

import { OrganizationsData } from "../../data/organizations.js";

// Helper to sync a user's org memberships to their custom claims
async function syncUserOrgClaims(userId) {
    const orgsData = new OrganizationsData();
    const orgs = await orgsData.getByUser(userId);
    const orgIds = orgs.map((org) => org.id);

    await getAuth().setCustomUserClaims(userId, { orgIds });
    console.log(`Updated claims for user ${userId}: orgIds = [${orgIds.join(", ")}]`);
    return orgIds;
}

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

// Express app for development
const orgApp = express();

orgApp.use(express.json());
orgApp.use(requireAuth);

// Accept an invite token and join organization
orgApp.post("/accept/:token", async (req, res) => {
    const { token } = req.params;

    if (!token) {
        return res.status(400).json({
            error: "Bad Request",
            message: "Invite token is required",
        });
    }

    try {
        const orgsData = new OrganizationsData();
        const orgId = await orgsData.acceptInvite(token, req.uid);

        if (!orgId) {
            return res.status(404).json({
                error: "Not Found",
                message: "Invalid or expired invite token",
            });
        }

        // Sync user's org claims
        await syncUserOrgClaims(req.uid);

        const org = await orgsData.getById(orgId);

        return res.status(200).json({
            success: true,
            message: "Successfully joined organization",
            organization: {
                id: org.id,
                name: org.name,
            },
        });
    } catch (error) {
        console.error("Error accepting invite:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to accept invite",
        });
    }
});

// Create a new organization
orgApp.post("/create", async (req, res) => {
    const { name } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({
            error: "Bad Request",
            message: "Organization name is required",
        });
    }

    try {
        const orgsData = new OrganizationsData();
        const orgId = await orgsData.create(name.trim(), req.uid);

        // Sync user's org claims
        await syncUserOrgClaims(req.uid);

        const org = await orgsData.getById(orgId);

        return res.status(201).json({
            success: true,
            message: "Organization created",
            organization: {
                id: org.id,
                name: org.name,
            },
        });
    } catch (error) {
        console.error("Error creating organization:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to create organization",
        });
    }
});

// Delete an organization (owner only)
orgApp.delete("/:orgId", async (req, res) => {
    const { orgId } = req.params;

    if (!orgId) {
        return res.status(400).json({
            error: "Bad Request",
            message: "Organization ID is required",
        });
    }

    try {
        const orgsData = new OrganizationsData();
        const org = await orgsData.getById(orgId);

        if (!org) {
            return res.status(404).json({
                error: "Not Found",
                message: "Organization not found",
            });
        }

        // Check if user is an owner
        if (!org.owners.includes(req.uid)) {
            return res.status(403).json({
                error: "Forbidden",
                message: "Only owners can delete an organization",
            });
        }

        // Get all members before deletion to update their claims
        const memberIds = [...org.members];

        // Delete the organization
        await orgsData.delete(orgId);

        // Sync claims for all affected members
        for (const memberId of memberIds) {
            await syncUserOrgClaims(memberId);
        }

        return res.status(200).json({
            success: true,
            message: "Organization deleted",
        });
    } catch (error) {
        console.error("Error deleting organization:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to delete organization",
        });
    }
});

const functionApp = express();
functionApp.use("/api/org", orgApp);

// Export for development server
export { orgApp };

console.log("Setting up Cloud Function export...");
// Export Cloud Function for production
export const org = onRequest(
    {
        region: "us-central1",
        memory: "512MiB",
        timeoutSeconds: 60,
        invoker: "public",
    },
    functionApp
);
