import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import del from "rollup-plugin-delete";
import { glob } from "glob";
import path from "path";
import { spawn } from "child_process";
import { config } from "dotenv";

// Load environment variables
config();

// Custom plugin to enable Cloudflare development mode
const cloudflareDevMode = () => ({
    name: "cloudflare-dev-mode",
    buildStart() {
        // Only run in development mode (when watching)
        if (this.meta.watchMode) {
            console.log("🔧 Enabling Cloudflare development mode...");

            return new Promise((resolve, reject) => {
                const child = spawn("node", ["scripts/enable-cf-dev-mode.js"], {
                    stdio: "inherit",
                    cwd: process.cwd(),
                });

                child.on("close", (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        console.warn(
                            "⚠️  Cloudflare development mode setup failed, but continuing build..."
                        );
                        resolve(); // Don't fail the build if CF setup fails
                    }
                });

                child.on("error", (error) => {
                    console.warn(
                        "⚠️  Cloudflare development mode error:",
                        error.message
                    );
                    resolve(); // Don't fail the build if CF setup fails
                });
            });
        }
    },
});

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
        rshome: "src/rshome.js",
        rslocations: "src/rslocations.js",
        rsschedule: "src/rsschedule.js",
        rsreports: "src/rsreports.js",
        rsuploads: "src/rsuploads.js",
        rssettings: "src/rssettings.js",
        rsprofile: "src/rsprofile.js",
        rsbilling: "src/rsbilling.js",
        rsadmin: "src/rsadmin.js",
        rschat: "src/rschat.js",
        rsdocs: "src/rsdocs.js",
        crowdmaptest: "src/crowdmaptest.js",
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
        del({ targets: "public/js/chunks/*", runOnce: true }),
        cloudflareDevMode(),
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

            // External Stripe SDK
            if (id === "stripe" || id.startsWith("stripe/")) return true;

            // External S3 SDKs
            if (id === "@aws-sdk/client-s3") return true;
            if (id === "@aws-sdk/s3-request-presigner") return true;

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
            del({ targets: `functions/${functionName}/chunks/*`, runOnce: true }),
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
