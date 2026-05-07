# OptoMeasure — VR Fusional Vergence Testing System

Two-device, browser-based, peer-to-peer fusional vergence measurement.
Supports **VR split-screen** (cardboard headset) and **Red-Cyan Anaglyph** modes.

---

## Why Anaglyph Works Better for Base-In

With a split-screen VR headset the brain can **suppress** one image because both
eyes see identical targets — there is no compulsion to fuse them.

The anaglyph method uses **different but complementary targets** per eye (e.g. a
cage in the left eye, a cross in the right). The brain *cannot* make sense of
the scene without fusing both, so suppression is prevented and true vergence
demand is measured.

---

## Hardware

| Item | Specification |
|---|---|
| Patient phone (VR mode) | Vivo Y3 / 1938 in Google Cardboard + **+8.0 D** lenses |
| Patient device (Anaglyph) | Any phone / tablet — patient wears **Red-Cyan glasses** |
| Doctor phone | Any modern smartphone with a browser |
| Network | Same Wi-Fi, or mobile data (WebRTC STUN) |

---

## File Structure

```
OptoMeasure/
├── index.html          ← Landing page
├── controller.html     ← Doctor's interface
├── controller.js       ← All controller logic
├── controller.css      ← Controller styles
├── vr.html             ← Patient VR split-screen
├── vr.js               ← VR renderer + PeerJS receiver
├── vr.css              ← VR styles
├── anaglyph.html       ← Patient anaglyph view
├── anaglyph.js         ← Anaglyph canvas renderer + PeerJS
├── anaglyph.css        ← Anaglyph styles
├── shared.js           ← All constants, formulas, step tables
└── styles.css          ← Landing page styles
```

---

## Quick Start — Anaglyph Mode (Recommended)

1. Serve the folder over HTTPS (required for fullscreen + clipboard on Android):
   ```bash
   npx serve . --ssl-cert cert.pem --ssl-key key.pem
   # or deploy to GitHub Pages / Vercel / Netlify
   ```
2. Patient opens **`anaglyph.html`** and puts on Red-Cyan glasses.
3. Doctor opens **`controller.html`**, enters the room code, taps Connect.
4. On the controls screen, select **Anaglyph** display mode.
5. Choose target: **Cross in Cage** (recommended for clinical vergence).
6. Confirm patient sees BOTH corner suppression markers:
   - **▲ Red triangle** = right eye
   - **◆ Cyan diamond** = left eye
   - If one is missing → that eye is suppressing
7. Select **Base-Out**, tap **+** step by step.
8. Tap **Record Break (B)** when patient reports seeing double.
9. Continue stepping down, tap **Record Recovery (V)** when fusion returns.
10. Switch to **Base-In**, repeat.

---

## Anaglyph Targets

| Target | Left eye (Cyan) | Right eye (Red) | Fused percept |
|---|---|---|---|
| **Cross in Cage** | Open rectangle cage | Plus sign / cross | Cross inside the cage |
| **Dot in Circle** | Open circle ring | Filled dot | Dot at centre of circle |
| **Bird in Cage** | Open rectangle cage | Bird silhouette | Bird sitting in cage |

The **Cross in Cage** is the clinical standard — equivalent to what a synoptophore uses.

---

## Suppression Detection

Each colour channel carries a small unique shape in the screen corner:
- **▲ Triangle** (red, top-right) → right eye
- **◆ Diamond** (cyan, top-left) → left eye

Ask the patient to report what they see at all times. A missing marker means
that eye has suppressed. This is clinically significant and should be noted.

---

## Vergence Step Tables

### Base-Out (convergence demand — formula y = 65x + 2, max 38Δ)

| Step | Shift cm | Prism Δ |
|---|---|---|
| 0 | 0.000 | 0 |
| 1 | 0.092 | 8 |
| 2 | 0.200 | 15 |
| 3 | 0.277 | 20 |
| 4 | 0.338 | 24 |
| 5 | 0.431 | 30 |
| 6 | 0.554 | 38 |

### Base-In (divergence demand — formula y = 55x + 2, max 24Δ)

Gentler slope and extra intermediate steps to allow the eyes to relax outward
against the +8 D convergence bias.

| Step | Shift cm | Prism Δ |
|---|---|---|
| 0 | 0.000 | 0 |
| 1 | 0.055 | 5 |
| 2 | 0.109 | 8 |
| 3 | 0.164 | 11 |
| 4 | 0.236 | 15 |
| 5 | 0.327 | 20 |
| 6 | 0.400 | 24 |

BASE_IN_OFFSET = 4Δ is subtracted from all displayed values in BI mode to
correct for the +8 D convergence bias in the display value shown to the doctor.

---

## How Anaglyph Prism Shift Works

Instead of physically shifting two half-screens, both colour layers are drawn on
one canvas and shifted horizontally relative to each other:

```
Base-Out:  red layer →  cyan layer ←    (eyes must converge to fuse)
Base-In:   red layer ←  cyan layer →    (eyes must diverge to fuse)
```

Each step shifts by `step.shiftCm × pxPerCm` pixels. The patient's fusional
vergence system must compensate for the disparity to produce a single percept.
When the demand exceeds fusional reserves → diplopia → break point.

---

## Controller Keyboard Shortcuts

| Key | Action |
|---|---|
| `+` / `↑` / `→` | Next step |
| `−` / `↓` / `←` | Previous step |
| `R` | Reset to step 0 |
| `I` | Toggle Base-Out ↔ Base-In |
| `M` | Toggle VR ↔ Anaglyph |
| `B` | Record break point |
| `V` | Record recovery point |

---

## Deployment

- Must be served over **HTTPS** for fullscreen API + clipboard on Android Chrome.
- Entirely client-side — no patient data is uploaded anywhere.
- If WebRTC STUN is blocked (strict firewall), add a TURN server to the
  `iceServers` array in both `controller.js` and `anaglyph.js`.

---

## Clinical Comparison Table

| Parameter | VR Split-Screen | Anaglyph |
|---|---|---|
| Equipment | +8D cardboard headset | Red-Cyan glasses (~₹100) |
| Fusion compulsion | Weak (identical targets) | Strong (disparate targets) |
| Suppression detection | No | Yes (corner markers) |
| Base-In reliability | Limited | Good |
| IPD critical | Yes | No |
| Works on any screen | No | Yes |
| Closest clinical equiv. | Prism bar | Synoptophore / Amblyoscope |
