import Hierarchy from "../util/hierarchy.js";
import { database, serverTimestamp } from "./db.js";
import { orgContext } from "./orgContext.js";

class FilesData {
    async getById(fileId) {
        return await database.get("files", fileId);
    }

    async getByOrg(orgId) {
        return await database.query("files", { oid: orgId });
    }

    async getByOrgAndContext(orgId, context) {
        return await database.query("files", { oid: orgId, context: context });
    }

    async getByContext(context) {
        return await this.getByOrgAndContext(
            orgContext.getCurrentOrgId(),
            context
        );
    }

    tokenize(name) {
        // Simple tokenization: lowercase, trim, replace non-words with underscores,
        // collapse underscores
        return name
            .toLowerCase()
            .trim()
            .replace(/\W+/g, "_")
            .replace(/_+/g, "_");
    }

    async ensureUniqueToken(name, org, context, fileId = null) {
        // Ensures that the token generated from the organization name is unique
        // by appending a random suffix if necessary.

        const baseToken = this.tokenize(name);
        let token = baseToken;
        while (true) {
            const existing = await database.query("files", {
                token: token,
                oid: org,
                context: context,
            });
            if (
                !existing ||
                existing.length === 0 ||
                existing[0].id === fileId
            ) {
                break;
            }
            const suffix = Math.floor(Math.random() * 900 + 100); // random 3-digit number
            token = `${baseToken}_${suffix}`;
        }

        return token;
    }

    async update(fileId, updates) {
        return await database.update("files", fileId, updates);
    }

    async save(
        filename,
        destinationPath,
        context,
        type,
        fileId = null,
        storage = "seaweed"
    ) {
        const org = orgContext.getCurrentOrg();
        const orgId = orgContext.getCurrentOrgId();

        // This is checked by the firestore rule as well.
        if (!orgContext.isInOrg(orgId)) {
            console.error(
                "Cannot save file: user is not in organization",
                orgId
            );
            throw new Error("Cannot save file: not in organization " + orgId);
        }

        const filenameStub = filename.slice(0, filename.lastIndexOf("."));
        const token = await this.ensureUniqueToken(
            filenameStub,
            orgId,
            context,
            fileId
        );

        let id = fileId || database.pushid();
        let hierarchy = new Hierarchy();
        hierarchy.org = org.token || orgId;
        hierarchy.context = context;
        hierarchy.file = token;

        const fileDoc = {
            id: id,
            hierarchy: hierarchy.toFileString(),
            filename: filename,
            token: token,
            path: `files/${orgId}/${destinationPath}/${filename}`,
            context: context,
            type: type,
            oid: orgId,
            uid: orgContext.userId,
            storage: storage,
        };

        // If a fileId was not passed in add the created field.  We
        // needed it before writing so we could produce hierarchy.
        if (!fileId) {
            fileDoc.created = serverTimestamp();
        }

        console.log("Saving file document:", fileDoc);

        return await database.set("files", fileDoc);
    }
}

export { FilesData };
