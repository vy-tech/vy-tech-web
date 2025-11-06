import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { glob } from "glob";
import path from "path";

// Find all function entry points dynamically
const functionEntries = glob
    .sync("src/functions/*/index.js")
    .reduce((entries, file) => {
        const functionName = path.basename(path.dirname(file));
        entries[functionName] = file;
        return entries;
    }, {});

// Client-side build (existing)
const clientConfig = {
    input: {
        rsauth: "src/rsauth.js",
        rsnav: "src/rsnav.js",
        rsdashboard: "src/rsdashboard.js",
        rslocations: "src/rslocations.js",
        rsschedule: "src/rsschedule.js",
        rsreports: "src/rsreports.js",
        rssettings: "src/rssettings.js",
        rsprofile: "src/rsprofile.js",
        rsadmin: "src/rsadmin.js",
        rschat: "src/rschat.js",
    },
    external: (id) => {
        // Ignore Firebase Admin SDK imports
        if (id.startsWith("firebase-admin/")) {
            return true;
        }
        // Ignore the service credential JSON file
        if (id.includes("firebase-secrets.json")) {
            return true;
        }
        return false;
    },
    output: {
        dir: "public/js",
        format: "esm",
        sourcemap: true,
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
    },
    plugins: [
        resolve({
            browser: true,
            preferBuiltins: false,
        }),
        commonjs(),
        json(),
    ],
};

// Create separate config for each function to avoid shared chunks
const functionsConfigs = Object.entries(functionEntries).map(
    ([functionName, entryPath]) => ({
        input: entryPath,
        external: (id) => {
            // External Firebase Functions and Admin SDK
            if (id.startsWith("firebase-functions/")) return true;
            if (id.startsWith("firebase-admin/")) return true;

            // External common Node modules
            if (id === "express" || id.startsWith("express/")) return true;

            // External OpenAI SDK
            if (id === "openai" || id.startsWith("openai/")) return true;

            // External shims and configs
            if (id === "firebase/app") return true;
            if (id === "../firebase-config.js") return true;
            if (id === "firebase/firestore") return true;

            return false;
        },
        output: {
            dir: `functions/${functionName}`, // Single file output per function
            format: "esm",
            sourcemap: true,
            entryFileNames: "index.js",
            chunkFileNames: "chunks/[name]-[hash].js",
        },
        plugins: [
            resolve({
                preferBuiltins: true,
                browser: false,
            }),
            commonjs(),
            json(),
        ],
    })
);

export default [clientConfig, ...functionsConfigs];
