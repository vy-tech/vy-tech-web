import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";

export default {
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
    },
    external: (id) => {
        // Ignore Firebase Admin SDK imports
        if (id.startsWith("firebase-admin/")) {
            return true;
        }
        // Ignore the service credential JSON file
        if (id.includes("firebase-svc-cred.json")) {
            return true;
        }
        return false;
    },
    output: {
        dir: "public/js",
        format: "esm", // output as ESM
        sourcemap: true,

        // keep entry files flat: /js/rsauth.js, /js/rsnav.js, /js/rsdb.js
        entryFileNames: "[name].js",

        // put shared chunks in a predictable subfolder so imports are ./chunks/...
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
    },
    plugins: [
        resolve({
            browser: true, // use browser-ready builds
            preferBuiltins: false, // don't pull in Node builtins
        }),
        commonjs(),
        json(),
    ],
};
