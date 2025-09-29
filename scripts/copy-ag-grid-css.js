#!/usr/bin/env node

/**
 * Script to copy AG Grid CSS files to the public directory
 * Run this after installing or updating ag-grid-community
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.join(
    __dirname,
    "..",
    "node_modules",
    "ag-grid-community",
    "styles"
);
const targetDir = path.join(__dirname, "..", "public", "css");

const filesToCopy = [
    "ag-grid.css",
    "ag-theme-alpine.css",
    // Note: ag-theme-alpine-dark.css doesn't exist as a separate file
    // Dark theme is handled via CSS custom properties in the main alpine theme
];

// Ensure target directory exists
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

console.log("Copying AG Grid CSS files...");

filesToCopy.forEach((file) => {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);

    if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`✓ Copied ${file}`);
    } else {
        console.log(`✗ Source file not found: ${file}`);
    }
});

console.log("Done!");
