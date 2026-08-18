// Generic Puppeteer harness for browser-side tests.
//
// Two modes, both sharing one persistent browser profile:
//   - `npm run e2e:login` opens a visible window so you can sign in once. The
//     session is Firebase's, stored in IndexedDB inside the profile directory.
//   - `npm run e2e` runs test files headlessly, reusing that profile, so pages
//     behind auth are reachable without any credential being passed around.
//
// The profile directory holds a live session and is gitignored. Nothing here
// reads or prints tokens.
//
// Usage in a test file:
//
//   import { runSuite } from "./harness.mjs";
//   await runSuite("my feature", async ({ page, check, goto }) => {
//       await goto("/explore/thing.html");
//       check("it loaded", await page.$("#thing") !== null);
//   });

import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

export const PROFILE_DIR =
    process.env.E2E_PROFILE || path.join(ROOT, ".e2e-profile");

// Default to the local container rather than the tunnel hostname: Cloudflare
// sits in front of dev.roarscore.ai and will happily serve a stale bundle
// unless development mode is on.
export const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5007";

export async function launchBrowser({ headless = true, profile = true } = {}) {
    return await puppeteer.launch({
        headless: headless ? "new" : false,
        userDataDir: profile ? PROFILE_DIR : undefined,
        defaultViewport: { width: 1400, height: 900 },
        args: ["--no-first-run", "--no-default-browser-check"],
    });
}

/**
 * Run a suite. Handles browser lifecycle, collects page errors, prints a
 * report, and exits non-zero on failure so CI or a shell can gate on it.
 *
 * The callback receives { page, browser, check, goto, screenshot }.
 */
export async function runSuite(name, fn, options = {}) {
    const { headless = true, profile = true, viewport } = options;

    const browser = await launchBrowser({ headless, profile });
    const page = await browser.newPage();
    // The profile dir persists a disk cache between runs, so a rebuilt
    // tailwind.css would otherwise be ignored and layout checks would measure
    // the previous build's classes.
    await page.setCacheEnabled(false);
    if (viewport) await page.setViewport(viewport);

    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
        if (m.type() === "error") pageErrors.push(`console: ${m.text()}`);
    });

    const results = [];
    const check = (label, passed, detail = "") =>
        results.push({ label, passed: !!passed, detail });

    const goto = (url, opts = {}) =>
        page.goto(url.startsWith("http") ? url : BASE_URL + url, {
            waitUntil: "networkidle0",
            ...opts,
        });

    const screenshot = (file) =>
        page.screenshot({ path: file, fullPage: false });

    let thrown = null;
    try {
        await fn({ page, browser, check, goto, screenshot });
    } catch (error) {
        thrown = error;
    } finally {
        await browser.close();
    }

    console.log(`\n=== ${name} ===`);
    for (const r of results) {
        console.log(
            `${r.passed ? "PASS" : "FAIL"}  ${r.label}${r.detail ? "  — " + r.detail : ""}`
        );
    }
    if (thrown) console.log(`\nTHREW: ${thrown.stack || thrown}`);
    console.log(
        pageErrors.length
            ? `\nPAGE ERRORS:\n${pageErrors.join("\n")}`
            : "\nno page errors"
    );

    const passed = results.filter((r) => r.passed).length;
    console.log(`\n${passed}/${results.length} passed`);

    // Page errors fail the suite too — a silent exception in the app is a
    // failure even when every assertion happens to hold.
    const ok = !thrown && passed === results.length && pageErrors.length === 0;
    if (!ok) process.exitCode = 1;
    return ok;
}

// Hash the pixels of a canvas so a test can assert that a render changed (or
// didn't) without caring about exact contents.
export async function canvasSignature(page, selector) {
    return await page.evaluate((sel) => {
        const c = document.querySelector(sel);
        if (!c) return null;
        const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
        let hash = 0;
        let opaque = 0;
        for (let i = 0; i < d.length; i += 4) {
            hash = (hash * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) | 0;
            if (d[i + 3] > 0) opaque++;
        }
        return { hash, opaque };
    }, selector);
}
