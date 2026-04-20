import { Router } from "express";

import { getSecrets } from "../helpers.js";
import { Storage } from "../../../data/storage.js";

const router = Router();

router.get("/:storage/*pathParts", async (req, res) => {
    const { storage, pathParts } = req.params;
    const path = pathParts.join("/");

    console.log(path);
    const storageMap = {
        1: "firebase",
        2: "minio",
        3: "seaweed",
    };
    const storageType = storageMap[storage] || storage;

    try {
        const storageInstance = Storage.getInstance(
            storageType,
            {},
            getSecrets().storageSecrets[storageType]
        );
        const url = await storageInstance.createSignedUrl(path, "GET", 3600);
        res.set("Cache-Control", "public, max-age=3600");
        res.set("Location", url);
        return res.status(302).json({ url });
    } catch (error) {
        console.error("Error generating signed URL:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to generate signed URL",
        });
    }
});

export default router;
