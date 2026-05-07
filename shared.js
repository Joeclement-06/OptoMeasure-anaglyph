/**
 * OptoMeasure — Shared Constants & Calculations  (shared.js)
 *
 * Device : Vivo Y3 / 1938  (6.27" × 2.94" active display)
 * Lens   : +8.0 D  |  Magnification ≈ 4×  |  Image distance ≈ 36 cm
 *
 * Modes:
 *   displayMode : 'VR'       — split-screen for cardboard headset
 *   displayMode : 'ANA'      — anaglyph red/cyan on single screen
 *
 * Vergence:
 *   Base-Out  y = 65x + 2   (y = prism Δ, x = per-eye shift cm)
 *   Base-In   y = 55x + 2   (gentler — fights +8 D convergence bias)
 *
 * Targets (anaglyph):
 *   'CAGE_CROSS'  — cage (cyan/left) + cross (red/right)  [clinical standard]
 *   'CIRCLE_DOT'  — circle (cyan) + dot (red)             [fixation disparity]
 *   'BIRD_CAGE'   — bird (red) + cage (cyan)              [Worth-style]
 */

'use strict';

const VR_CONFIG = {
    magnification:  4,
    lensPower:      8.0,
    objectDistance: 10,
    imageDistance:  36,

    device: {
        name:             'Vivo Y3 (1938)',
        physicalWidthCm:  15.93,
        physicalHeightCm:  7.47,
        resolutionW:      1544,
        resolutionH:       720,
        ppi:               270,
    },

    layout: {
        containerWidthCm:  15.93,
        containerHeightCm:  7.47,
        eyeWidthCm:         7.965,
        lineLengthCm:       3,
    },

    lineLengthCm:    3,
    lineThicknessPx: 4,
    dotSizePx:       12,

    defaultIPD: 75,
    minIPD:     50,
    maxIPD:     90,

    formula:   { m: 65, c: 2 },   // Base-Out
    formulaBI: { m: 55, c: 2 },   // Base-In

    // ── Display modes ────────────────────────────────────────────────────────
    displayModes: ['VR', 'ANA'],          // VR = split-screen, ANA = anaglyph
    defaultDisplayMode: 'ANA',

    // ── Anaglyph target types ────────────────────────────────────────────────
    targetTypes: ['CAGE_CROSS', 'CIRCLE_DOT', 'BIRD_CAGE'],
    defaultTarget: 'CAGE_CROSS',

    // ── Anaglyph: which eye sees which colour ────────────────────────────────
    // Standard: RED filter = Right eye, CYAN filter = Left eye
    anaColors: {
        right: '#ff0000',   // red   channel → right eye
        left:  '#00ffff',   // cyan  channel → left  eye
    },
};

// ── BASE-IN DISPLAY OFFSET ───────────────────────────────────────────────────
const BASE_IN_OFFSET = 4;

// ── Base-Out steps (m=65, max 38Δ) ──────────────────────────────────────────
VR_CONFIG.steps = [
    { index: 0, shiftCm: 0,      prism: 0  },
    { index: 1, shiftCm: 0.092,  prism: 8  },
    { index: 2, shiftCm: 0.200,  prism: 15 },
    { index: 3, shiftCm: 0.277,  prism: 20 },
    { index: 4, shiftCm: 0.338,  prism: 24 },
    { index: 5, shiftCm: 0.431,  prism: 30 },
    { index: 6, shiftCm: 0.554,  prism: 38 },
];

// ── Base-In steps (m=55, gentler, max 24Δ) ───────────────────────────────────
VR_CONFIG.stepsBI = [
    { index: 0, shiftCm: 0,      prism: 0  },
    { index: 1, shiftCm: 0.055,  prism: 5  },
    { index: 2, shiftCm: 0.109,  prism: 8  },
    { index: 3, shiftCm: 0.164,  prism: 11 },
    { index: 4, shiftCm: 0.236,  prism: 15 },
    { index: 5, shiftCm: 0.327,  prism: 20 },
    { index: 6, shiftCm: 0.400,  prism: 24 },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getActiveSteps(mode) {
    return (mode === 'BI') ? VR_CONFIG.stepsBI : VR_CONFIG.steps;
}

function shiftToPrism(shiftCm, mode) {
    const f = (mode === 'BI') ? VR_CONFIG.formulaBI : VR_CONFIG.formula;
    return f.m * shiftCm + f.c;
}

function prismToShift(prism, mode) {
    const f = (mode === 'BI') ? VR_CONFIG.formulaBI : VR_CONFIG.formula;
    return (prism - f.c) / f.m;
}

function getAdjustedPrism(prism, mode) {
    if (mode === 'BI') return Math.max(0, prism - BASE_IN_OFFSET);
    return prism;
}

function getDevicePxPerCm() {
    const sw = Math.max(window.innerWidth,  window.innerHeight);
    const sh = Math.min(window.innerWidth,  window.innerHeight);
    return {
        x: sw / VR_CONFIG.device.physicalWidthCm,
        y: sh / VR_CONFIG.device.physicalHeightCm,
    };
}

function cmToPixels(cm)  { return cm * getDevicePxPerCm().x; }
function cmToPixelsY(cm) { return cm * getDevicePxPerCm().y; }
function mmToPixels(mm)  { return (mm / 10) * getDevicePxPerCm().x; }

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}
