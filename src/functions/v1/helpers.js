import { defineSecret } from "firebase-functions/params";
import { Storage } from "../../data/storage.js";

export const keyHashHmacSecret = defineSecret("KEY_HASH_HMAC_SECRET");

export function getSecrets() {
    return {
        keyHashHmacSecret:
            process.env.KEY_HASH_HMAC_SECRET || keyHashHmacSecret.value(),
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

export function getFetchUrl(storage, path) {
    const storageMap = {
        firebase: 1,
        minio: 2,
        seaweed: 3,
    };

    if (!path) return null;
    if (!storage) return null;
    if (!storageMap[storage]) return null;

    return `/fetch/${storageMap[storage]}/${path}`;
}
