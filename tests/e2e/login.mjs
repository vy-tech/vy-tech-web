// One-time interactive sign-in for the headless test profile.
//
//   npm run e2e:login
//
// Opens a real browser window on this machine pointed at the app. Sign in as
// you normally would, then close the window. Firebase persists the session in
// IndexedDB inside the profile directory, so subsequent `npm run e2e` runs
// reach authenticated pages without any token being copied anywhere.
//
// The profile directory contains a live session — it is gitignored, and should
// be treated like any other credential store. Delete it to sign out:
//   rm -rf .e2e-profile

import { launchBrowser, BASE_URL, PROFILE_DIR } from "./harness.mjs";

const target = process.argv[2] || "/chat";
const url = target.startsWith("http") ? target : BASE_URL + target;

console.log(`Profile : ${PROFILE_DIR}`);
console.log(`Opening : ${url}`);
console.log("");
console.log("Sign in in the window that just opened, then close it.");
console.log("Waiting for you to close the browser…");

const browser = await launchBrowser({ headless: false, profile: true });
const [page] = await browser.pages();
await page.goto(url, { waitUntil: "domcontentloaded" });

await new Promise((resolve) => browser.on("disconnected", resolve));

console.log("\nBrowser closed. Session saved to the test profile.");
console.log("Run `npm run e2e` to use it.");
