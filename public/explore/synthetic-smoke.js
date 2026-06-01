import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";

// Sample VRM 1.0 model published by Pixiv as part of the three-vrm examples.
// Pinned to a commit-stable URL via jsdelivr's @dev branch alias. For the
// smoke test we fetch once and parse N times to produce N independent VRM
// instances (each with its own skeleton + expression manager).
const VRM_URL =
    "https://cdn.jsdelivr.net/gh/pixiv/three-vrm@dev/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm";

// VRM 1.0 standardized expression presets we'll exercise. Maps directly to
// 5 of our 7 Core emotions; Disgust + Fear (Phase B) will be expressed as
// blends of these.
const PRESETS = ["happy", "angry", "sad", "surprised", "neutral"];

const canvas = document.getElementById("scene");
const fpsEl = document.getElementById("fps");
const statusEl = document.getElementById("status");
const countSlider = document.getElementById("count");
const countVEl = document.getElementById("countV");
const speedSlider = document.getElementById("speed");
const speedVEl = document.getElementById("speedV");
const minimalCheck = document.getElementById("minimal");
const minimalVEl = document.getElementById("minimalV");
const statsEl = document.getElementById("stats");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e0e12);

const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
camera.position.set(0, 0, 9);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
keyLight.position.set(1.5, 2, 2);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xb8c4ff, 0.4);
fillLight.position.set(-2, 0.5, 1);
scene.add(fillLight);
scene.add(new THREE.AmbientLight(0x404050, 0.6));

const root = new THREE.Group();
scene.add(root);

// State
let vrmBuffer = null; // ArrayBuffer of fetched VRM bytes
let vrms = []; // active VRM instances currently in the scene
let exprSpeed = 0.6; // multiplier on time-based expression cycling
let minimalUpdate = true; // when true: only flush expressions; skip springbones/lookat/constraints

const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));

function setStatus(msg) {
    statusEl.textContent = msg;
}

async function fetchVRM() {
    setStatus("fetching VRM…");
    const res = await fetch(VRM_URL);
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    vrmBuffer = await res.arrayBuffer();
    setStatus(`VRM loaded (${(vrmBuffer.byteLength / 1024 / 1024).toFixed(1)} MB) — parsing instances…`);
}

function parseVRM(buf) {
    return new Promise((resolve, reject) => {
        // GLTFLoader.parse accepts an ArrayBuffer directly.
        loader.parse(
            buf,
            "",
            (gltf) => {
                const vrm = gltf.userData.vrm;
                if (!vrm) reject(new Error("no VRM in parsed glTF"));
                else resolve(vrm);
            },
            reject
        );
    });
}

function layout(instances) {
    const n = instances.length;
    // Choose grid dimensions so the grid fits roughly the canvas aspect.
    const aspect = canvas.clientWidth / canvas.clientHeight || 16 / 9;
    const cols = Math.max(1, Math.round(Math.sqrt(n * aspect)));
    const rows = Math.ceil(n / cols);
    const spacingX = 0.6;
    const spacingY = 0.6;

    instances.forEach((vrm, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        // Shift so grid is centered on origin (X) and head is at origin (Y).
        // Sample VRM heads sit ~1.4 units above the body root, so we offset
        // -1.4 in Y so the head is roughly at the origin of each cell.
        vrm.scene.position.set(
            (col - (cols - 1) / 2) * spacingX,
            -(row - (rows - 1) / 2) * spacingY - 1.4,
            0
        );
        // VRM 1.0 forward axis is +Z, and our camera sits on +Z looking at
        // the origin — so the default orientation already faces the camera.
        vrm.scene.rotation.y = 0;
        vrm.scene.scale.setScalar(0.55);
        root.add(vrm.scene);
    });

    // Triangle count for the assembled scene — useful for understanding the
    // GPU-side cost when interpreting FPS numbers.
    let tris = 0;
    let morphTargets = 0;
    root.traverse((obj) => {
        if (obj.isMesh && obj.geometry) {
            const idx = obj.geometry.index;
            tris += (idx ? idx.count : obj.geometry.attributes.position.count) / 3;
            if (obj.morphTargetInfluences) morphTargets += obj.morphTargetInfluences.length;
        }
    });
    statsEl.textContent = `${(tris / 1000).toFixed(1)}K tris · ${morphTargets} morph targets`;

    // Auto-fit camera distance based on grid size.
    const gridW = cols * spacingX;
    const gridH = rows * spacingY;
    const fovV = (camera.fov * Math.PI) / 180;
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * camera.aspect);
    const distV = (gridH / 2) / Math.tan(fovV / 2);
    const distH = (gridW / 2) / Math.tan(fovH / 2);
    camera.position.z = Math.max(distV, distH) * 1.15 + 1.5;
}

async function rebuild(targetCount) {
    // Tear down existing instances.
    for (const vrm of vrms) {
        root.remove(vrm.scene);
        VRMUtils.deepDispose(vrm.scene);
    }
    vrms = [];

    setStatus(`parsing ${targetCount} VRM instances…`);

    // Parse sequentially with yields so the UI stays responsive on slow CPUs.
    // For 60 instances of the sample VRM this typically takes a few seconds.
    const fresh = [];
    for (let i = 0; i < targetCount; i++) {
        const vrm = await parseVRM(vrmBuffer);
        fresh.push(vrm);
        if ((i + 1) % 10 === 0 || i === targetCount - 1) {
            setStatus(`parsed ${i + 1}/${targetCount}…`);
            await new Promise((r) => setTimeout(r, 0));
        }
    }
    vrms = fresh;
    layout(vrms);
    setStatus(`rendering ${vrms.length} instances`);
}

function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * renderer.getPixelRatio() || canvas.height !== h * renderer.getPixelRatio()) {
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
}

let lastTime = performance.now();
let fpsCount = 0;
let fpsAccum = 0;
let fpsLast = lastTime;

function tick() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    const t = now / 1000;
    for (let i = 0; i < vrms.length; i++) {
        const vrm = vrms[i];
        const phase = t * exprSpeed + i * 0.13;
        // Cycle through presets with smoothly overlapping weights so each
        // instance shows a moving blend, not a snap.
        for (let j = 0; j < PRESETS.length; j++) {
            const w = Math.max(0, Math.sin(phase + j * 1.25));
            vrm.expressionManager?.setValue(PRESETS[j], w * 0.85);
        }
        if (minimalUpdate) {
            // Production-mode update: just flush expression weights to morph
            // target influences. Skips springbone sim, look-at solver, and
            // node constraints — none of which our use case needs.
            vrm.expressionManager?.update();
        } else {
            // Full VRM update — runs everything the model author shipped.
            vrm.update(dt);
        }
    }

    resize();
    renderer.render(scene, camera);

    fpsCount++;
    fpsAccum += dt;
    if (now - fpsLast > 500) {
        const fps = (fpsCount / fpsAccum).toFixed(1);
        fpsEl.textContent = `${fps} fps · ${vrms.length} instances`;
        fpsCount = 0;
        fpsAccum = 0;
        fpsLast = now;
    }

    requestAnimationFrame(tick);
}

// --- UI wiring ---
let rebuildPending = null;
function scheduleRebuild(n) {
    if (rebuildPending) return;
    rebuildPending = (async () => {
        try {
            await rebuild(n);
        } catch (err) {
            console.error(err);
            setStatus("error: " + err.message);
        } finally {
            rebuildPending = null;
            // If user moved the slider further while we were rebuilding,
            // pick up the latest value and rebuild again.
            const latest = parseInt(countSlider.value, 10);
            if (latest !== n) scheduleRebuild(latest);
        }
    })();
}

countSlider.addEventListener("input", () => {
    countVEl.textContent = countSlider.value;
});
countSlider.addEventListener("change", () => {
    scheduleRebuild(parseInt(countSlider.value, 10));
});
speedSlider.addEventListener("input", () => {
    exprSpeed = parseInt(speedSlider.value, 10) / 100;
    speedVEl.textContent = exprSpeed.toFixed(2) + "×";
});
minimalCheck.addEventListener("change", () => {
    minimalUpdate = minimalCheck.checked;
    minimalVEl.textContent = minimalUpdate ? "on" : "off";
});

// --- Boot ---
(async function main() {
    try {
        await fetchVRM();
        await rebuild(parseInt(countSlider.value, 10));
        requestAnimationFrame(tick);
    } catch (err) {
        console.error(err);
        setStatus("error: " + err.message);
    }
})();
