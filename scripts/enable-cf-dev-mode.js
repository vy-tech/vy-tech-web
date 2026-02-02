#!/usr/bin/env node

import { config } from "dotenv";
import https from "https";

// Load environment variables
config();

const CLOUDFLARE_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;
const CLOUDFLARE_ZONE_TOKEN = process.env.CLOUDFLARE_ZONE_TOKEN;

if (!CLOUDFLARE_ZONE_ID || !CLOUDFLARE_ZONE_TOKEN) {
    console.error(
        "❌ Missing required environment variables: CLOUDFLARE_ZONE_ID and/or CLOUDFLARE_ZONE_TOKEN"
    );
    process.exit(1);
}

const enableDevMode = () => {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ value: "on" });

        const options = {
            hostname: "api.cloudflare.com",
            port: 443,
            path: `/client/v4/zones/${CLOUDFLARE_ZONE_ID}/settings/development_mode`,
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${CLOUDFLARE_ZONE_TOKEN}`,
                "Content-Length": Buffer.byteLength(data),
            },
        };

        const req = https.request(options, (res) => {
            let body = "";

            res.on("data", (chunk) => {
                body += chunk;
            });

            res.on("end", () => {
                try {
                    const response = JSON.parse(body);

                    if (response.success) {
                        console.log(
                            "✅ Cloudflare development mode enabled successfully"
                        );
                        resolve(response);
                    } else {
                        console.error(
                            "❌ Failed to enable development mode:",
                            response.errors
                        );
                        reject(
                            new Error(
                                `Cloudflare API error: ${JSON.stringify(
                                    response.errors
                                )}`
                            )
                        );
                    }
                } catch (error) {
                    console.error("❌ Failed to parse API response:", error);
                    reject(error);
                }
            });
        });

        req.on("error", (error) => {
            console.error("❌ Request error:", error);
            reject(error);
        });

        req.write(data);
        req.end();
    });
};

// Main execution
console.log("🔧 Enabling Cloudflare development mode...");
enableDevMode()
    .then(() => {
        console.log("🚀 Development mode is now active");
        process.exit(0);
    })
    .catch((error) => {
        console.error("💥 Failed to enable development mode:", error.message);
        process.exit(1);
    });
