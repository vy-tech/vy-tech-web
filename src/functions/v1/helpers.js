import { defineSecret } from "firebase-functions/params";
import { Storage } from "../../data/storage.js";
import { AnnotationsData } from "../../data/annotations.js";
import { ChunksData } from "../../data/chunk.js";
import Hierarchy from "../../util/hierarchy.js";

export const keyHashHmacSecret = defineSecret("KEY_HASH_HMAC_SECRET");
export const seaweedAccessKey = defineSecret("STORAGE_ACCESS_KEY_SEAWEED");
export const seaweedSecretKey = defineSecret("STORAGE_SECRET_KEY_SEAWEED");

export function getSecrets() {
    return {
        keyHashHmacSecret:
            process.env.KEY_HASH_HMAC_SECRET || keyHashHmacSecret.value(),

        storageSecrets: {
            seaweed: {
                access_key:
                    process.env.STORAGE_ACCESS_KEY_SEAWEED ||
                    seaweedAccessKey.value(),
                secret_key:
                    process.env.STORAGE_SECRET_KEY_SEAWEED ||
                    seaweedSecretKey.value(),
            },
        },
    };
}

export function getUploadStorage() {
    return Storage.getInstance("firebase");
}

export function guessMimeType(filename) {
    const extension = filename.split(".").pop().toLowerCase();
    const mimeTypes = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        pdf: "application/pdf",
        txt: "text/plain",
        mp4: "video/mp4",
        avi: "video/x-msvideo",
        mov: "video/quicktime",
        m4v: "video/x-m4v",
        mkv: "video/x-matroska",
    };
    return mimeTypes[extension] || "application/octet-stream";
}

export async function buildAnnotationsResponse(hierarchyString) {
    const annotationsData = new AnnotationsData();
    const annotations = await annotationsData.getByHierarchy(hierarchyString);

    // Get chunks to find the base minuteOfDay.
    // Annotation hierarchies omit camera, but event chunks include it,
    // so we default to camera 01 for the chunk query.
    const hierarchy = new Hierarchy(hierarchyString);
    if (hierarchy.type === "event") {
        hierarchy.camera = 1;
    }

    const chunkData = new ChunksData();
    const chunks = await chunkData.getByHierarchy(hierarchy);

    let baseMinute = 0;
    if (chunks.length > 0) {
        baseMinute = Math.min(...chunks.map((c) => c.minuteOfDay));
    }

    const result = annotations.map((ann) => ({
        id: ann.id,
        content: ann.content,
        videoSeconds: ann.time,
        minuteOfDay: baseMinute + Math.floor(ann.time / 60),
        offsetSeconds: ann.time % 60,
        type: ann.type,
        importance: ann.importance,
        tags: ann.tags || [],
        updated: ann.updated?.toDate?.()?.toISOString?.() ?? ann.updated,
    }));

    return { annotations: result };
}

export function getFetchUrl(storage, path) {
    const storageMap = {
        firebase: 1,
        minio: 2,
        seaweed: 3,
    };

    if (!path) return null;
    if (!storage) return null;
    if (!storageMap[storage]) return null;

    return `/api/v1/fetch/${storageMap[storage]}/${path}`;
}
