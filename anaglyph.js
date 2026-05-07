/**
 * OptoMeasure — Anaglyph Patient View (anaglyph.js)
 *
 * Renders two colour-separated target layers on a single screen.
 * Patient wears Red-Cyan anaglyph glasses:
 *   Red  filter (right eye) → sees only RED   layer
 *   Cyan filter (left  eye) → sees only CYAN  layer
 *
 * Vergence demand is created by shifting the two layers horizontally:
 *   Base-Out: red layer shifts RIGHT, cyan shifts LEFT  → convergence demand
 *   Base-In:  red layer shifts LEFT,  cyan shifts RIGHT → divergence demand
 *
 * Target types (switchable from controller):
 *   CAGE_CROSS  — open rectangle (cyan/left) + cross (red/right)
 *   CIRCLE_DOT  — open circle   (cyan/left) + filled dot (red/right)
 *   BIRD_CAGE   — bird silhouette (red/right) + open cage (cyan/left)
 *
 * Suppression indicators:
 *   A small unique shape in each channel corner.
 *   If patient reports losing one shape, that eye is suppressing.
 */
(function () {
    'use strict';

    // ── State ─────────────────────────────────────────────────────────────────
    const anaState = {
        currentStep:  0,
        mode:         'BO',          // 'BO' | 'BI'
        ipd:          VR_CONFIG.defaultIPD,
        targetType:   VR_CONFIG.defaultTarget,  // 'CAGE_CROSS'|'CIRCLE_DOT'|'BIRD_CAGE'
        displayMode:  'ANA',
        connected:    false,
        peer:         null,
        conn:         null,
        roomCode:     '',
        canvas:       null,
        ctx:          null,
        W:            0,
        H:            0,
        cx:           0,
        cy:           0,
        pxPerCm:      1,
    };

    const $ = id => document.getElementById(id);

    function activeSteps() {
        return getActiveSteps(anaState.mode);
    }

    // ── Canvas setup ──────────────────────────────────────────────────────────
    function setupCanvas() {
        anaState.canvas = $('anaCanvas');
        anaState.ctx    = anaState.canvas.getContext('2d');
        resizeCanvas();
        window.addEventListener('resize', function () {
            resizeCanvas();
            render();
        });
    }

    function resizeCanvas() {
        const canvas      = anaState.canvas;
        canvas.width      = window.innerWidth;
        canvas.height     = window.innerHeight;
        anaState.W        = canvas.width;
        anaState.H        = canvas.height;
        anaState.cx       = anaState.W / 2;
        anaState.cy       = anaState.H / 2;
        // px per cm using physical screen dimensions
        anaState.pxPerCm  = anaState.W / VR_CONFIG.device.physicalWidthCm;
    }

    // ── Core render ───────────────────────────────────────────────────────────
    function render() {
        const ctx = anaState.ctx;
        const W   = anaState.W;
        const H   = anaState.H;

        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, W, H);

        // Compute horizontal shift in pixels
        const steps   = activeSteps();
        const stepIdx = Math.max(0, Math.min(anaState.currentStep, steps.length - 1));
        const step    = steps[stepIdx];
        const shiftPx = step.shiftCm * anaState.pxPerCm;

        // Direction:
        //   BO: red (right eye) shifts right (+), cyan (left eye) shifts left (-)
        //   BI: red (right eye) shifts left  (-), cyan (left eye) shifts right (+)
        const sign        = (anaState.mode === 'BO') ? 1 : -1;
        const redOffsetX  =  sign * shiftPx;   // right eye layer
        const cyanOffsetX = -sign * shiftPx;   // left eye layer

        // Draw in additive-like approach: set globalCompositeOperation
        // RED layer first
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        drawLayer(ctx, 'red',  redOffsetX,  anaState.cx, anaState.cy);
        ctx.restore();

        // CYAN layer
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        drawLayer(ctx, 'cyan', cyanOffsetX, anaState.cx, anaState.cy);
        ctx.restore();

        // Step / mode info overlay (small, top-left, dim)
        drawInfoOverlay(ctx, step);
    }

    // ── Layer drawing dispatcher ──────────────────────────────────────────────
    function drawLayer(ctx, channel, offsetX, cx, cy) {
        const col    = channel === 'red' ? '#ff2020' : '#00e5ff';
        const lx     = cx + offsetX;   // shifted centre X for this layer
        const ly     = cy;

        const p = anaState.pxPerCm;
        const targetSize = 3.5 * p;   // 3.5 cm target radius/half-size

        switch (anaState.targetType) {
            case 'CAGE_CROSS':
                if (channel === 'cyan') drawCage(ctx, col, lx, ly, targetSize);
                else                    drawCross(ctx, col, lx, ly, targetSize);
                break;
            case 'CIRCLE_DOT':
                if (channel === 'cyan') drawCircle(ctx, col, lx, ly, targetSize);
                else                    drawDot(ctx, col, lx, ly, targetSize * 0.18);
                break;
            case 'BIRD_CAGE':
                if (channel === 'red')  drawBird(ctx, col, lx, ly, targetSize);
                else                    drawCage(ctx, col, lx, ly, targetSize);
                break;
        }

        // Suppression marker — unique per channel
        drawSuppressionMarker(ctx, col, channel, offsetX);
    }

    // ── Target: Cage (open rectangle) ────────────────────────────────────────
    function drawCage(ctx, col, cx, cy, size) {
        const lw = Math.max(3, size * 0.045);
        ctx.strokeStyle = col;
        ctx.lineWidth   = lw;
        ctx.shadowColor = col;
        ctx.shadowBlur  = 8;
        ctx.strokeRect(cx - size, cy - size * 0.75, size * 2, size * 1.5);
        // Cage bars — 3 vertical bars inside
        const barSpacing = (size * 2) / 4;
        ctx.lineWidth = lw * 0.6;
        for (let i = 1; i <= 3; i++) {
            const bx = (cx - size) + barSpacing * i;
            ctx.beginPath();
            ctx.moveTo(bx, cy - size * 0.75);
            ctx.lineTo(bx, cy + size * 0.75);
            ctx.stroke();
        }
        ctx.shadowBlur = 0;
    }

    // ── Target: Cross / Plus ──────────────────────────────────────────────────
    function drawCross(ctx, col, cx, cy, size) {
        const lw = Math.max(4, size * 0.06);
        ctx.strokeStyle = col;
        ctx.lineWidth   = lw;
        ctx.lineCap     = 'round';
        ctx.shadowColor = col;
        ctx.shadowBlur  = 10;
        // Horizontal arm
        ctx.beginPath();
        ctx.moveTo(cx - size, cy);
        ctx.lineTo(cx + size, cy);
        ctx.stroke();
        // Vertical arm
        ctx.beginPath();
        ctx.moveTo(cx, cy - size * 0.75);
        ctx.lineTo(cx, cy + size * 0.75);
        ctx.stroke();
        // Centre dot
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(cx, cy, lw * 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // ── Target: Open Circle ───────────────────────────────────────────────────
    function drawCircle(ctx, col, cx, cy, size) {
        const lw = Math.max(3, size * 0.05);
        ctx.strokeStyle = col;
        ctx.lineWidth   = lw;
        ctx.shadowColor = col;
        ctx.shadowBlur  = 8;
        ctx.beginPath();
        ctx.arc(cx, cy, size, 0, Math.PI * 2);
        ctx.stroke();
        // Tick marks at cardinal points to aid alignment
        const tick = size * 0.15;
        [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy]) => {
            ctx.beginPath();
            ctx.moveTo(cx + dx*(size-tick), cy + dy*(size-tick));
            ctx.lineTo(cx + dx*(size+tick), cy + dy*(size+tick));
            ctx.stroke();
        });
        ctx.shadowBlur = 0;
    }

    // ── Target: Filled Dot ────────────────────────────────────────────────────
    function drawDot(ctx, col, cx, cy, r) {
        ctx.fillStyle   = col;
        ctx.shadowColor = col;
        ctx.shadowBlur  = 14;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(r, 8), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // ── Target: Bird silhouette ───────────────────────────────────────────────
    function drawBird(ctx, col, cx, cy, size) {
        ctx.fillStyle   = col;
        ctx.strokeStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur  = 8;
        const s = size * 0.55;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.beginPath();
        // Body
        ctx.ellipse(0, 0, s, s * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Head
        ctx.beginPath();
        ctx.arc(s * 0.75, -s * 0.3, s * 0.3, 0, Math.PI * 2);
        ctx.fill();
        // Beak
        ctx.beginPath();
        ctx.moveTo(s * 1.05, -s * 0.3);
        ctx.lineTo(s * 1.35, -s * 0.18);
        ctx.lineTo(s * 1.05, -s * 0.1);
        ctx.closePath();
        ctx.fill();
        // Wing
        ctx.lineWidth = Math.max(2, s * 0.06);
        ctx.beginPath();
        ctx.moveTo(-s * 0.2, -s * 0.1);
        ctx.quadraticCurveTo(-s * 0.1, -s * 0.7, s * 0.3, -s * 0.35);
        ctx.stroke();
        // Tail
        ctx.beginPath();
        ctx.moveTo(-s * 0.85, 0);
        ctx.lineTo(-s * 1.3, -s * 0.3);
        ctx.moveTo(-s * 0.85, 0);
        ctx.lineTo(-s * 1.3,  s * 0.05);
        ctx.moveTo(-s * 0.85, 0);
        ctx.lineTo(-s * 1.2,  s * 0.2);
        ctx.stroke();
        ctx.restore();
        ctx.shadowBlur = 0;
    }

    // ── Suppression markers ───────────────────────────────────────────────────
    // Small unique shape in the corner of each colour channel.
    // Patient should always see BOTH. If one vanishes → that eye suppresses.
    function drawSuppressionMarker(ctx, col, channel, offsetX) {
        const W   = anaState.W;
        const H   = anaState.H;
        const r   = 14;
        const pad = 28;

        ctx.fillStyle   = col;
        ctx.strokeStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur  = 6;
        ctx.lineWidth   = 2.5;

        if (channel === 'red') {
            // Red: small triangle — top-right corner
            const tx = W - pad + offsetX;
            const ty = pad;
            ctx.beginPath();
            ctx.moveTo(tx,     ty - r);
            ctx.lineTo(tx + r, ty + r);
            ctx.lineTo(tx - r, ty + r);
            ctx.closePath();
            ctx.fill();
        } else {
            // Cyan: small diamond — top-left corner
            const tx = pad + offsetX;
            const ty = pad;
            ctx.beginPath();
            ctx.moveTo(tx,     ty - r);
            ctx.lineTo(tx + r, ty);
            ctx.lineTo(tx,     ty + r);
            ctx.lineTo(tx - r, ty);
            ctx.closePath();
            ctx.fill();
        }
        ctx.shadowBlur = 0;
    }

    // ── Info overlay ──────────────────────────────────────────────────────────
    function drawInfoOverlay(ctx, step) {
        const displayPrism = getAdjustedPrism(step.prism, anaState.mode);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.font      = '11px monospace';
        ctx.fillText(
            anaState.mode + '  ' + displayPrism + 'Δ  Step ' + anaState.currentStep +
            '  ' + anaState.targetType,
            10, anaState.H - 10
        );
    }

    // ── Handle commands from controller ───────────────────────────────────────
    function handleCommand(data) {
        switch (data.type) {
            case 'update':
                if (data.activeStepTable) anaState.mode = data.activeStepTable;
                else if (data.mode)       anaState.mode = data.mode;
                if (data.ipd !== undefined) anaState.ipd = data.ipd;
                anaState.currentStep = Math.max(0,
                    Math.min(data.step, activeSteps().length - 1));
                render();
                break;
            case 'reset':
                anaState.currentStep = 0;
                render();
                break;
            case 'ipd':
                anaState.ipd = data.value;
                render();
                break;
            case 'mode':
                anaState.mode = data.value;
                anaState.currentStep = 0;
                render();
                break;
            case 'target':
                anaState.targetType = data.value;
                render();
                break;
            case 'displayMode':
                // Controller is telling us to switch display mode
                if (data.value === 'VR') {
                    window.location.href = 'vr.html';
                }
                break;
        }
    }

    // ── Fullscreen ────────────────────────────────────────────────────────────
    function requestFullscreen() {
        const el  = document.documentElement;
        const rfs = el.requestFullscreen || el.webkitRequestFullscreen;
        if (rfs) {
            rfs.call(el).then(function () {
                setTimeout(function () { resizeCanvas(); render(); }, 300);
            }).catch(function () {});
        }
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(function () {});
        }
    }

    // ── PeerJS ────────────────────────────────────────────────────────────────
    function initPeer() {
        anaState.roomCode = generateRoomCode();
        $('roomCode').textContent = anaState.roomCode;

        const peerId   = 'optovr-' + anaState.roomCode.toLowerCase();
        const peerOpts = {
            debug: 1,
            config: { iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ]},
        };

        anaState.peer = new Peer(peerId, peerOpts);

        anaState.peer.on('open', function () {
            console.log('[ANA] Peer ready:', peerId);
        });

        anaState.peer.on('connection', function (conn) {
            anaState.conn = conn;

            conn.on('open', function () {
                anaState.connected = true;
                $('connectOverlay').classList.add('hidden');
                $('connIndicator').classList.add('connected');
                conn.send({ type: 'connected', roomCode: anaState.roomCode });
                requestFullscreen();
                render();
            });

            conn.on('data', function (data) { handleCommand(data); });

            conn.on('close', function () {
                anaState.connected = false;
                $('connIndicator').classList.remove('connected');
                $('connectOverlay').classList.remove('hidden');
                const txt = $('connectStatus');
                if (txt) txt.innerHTML =
                    '<span class="status-dot waiting"></span> Controller disconnected. Waiting…';
            });
        });

        anaState.peer.on('error', function (err) {
            console.error('[ANA] Peer error:', err);
            setTimeout(initPeer, 3000);
        });
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    function init() {
        setupCanvas();
        render();
        initPeer();

        // Copy room code button
        const btnCopy = $('btnCopy');
        if (btnCopy) {
            btnCopy.addEventListener('click', async function () {
                try {
                    await navigator.clipboard.writeText(anaState.roomCode);
                    btnCopy.textContent = '✅';
                    setTimeout(() => btnCopy.textContent = '📋', 2000);
                } catch (e) {}
            });
        }

        // Tap to fullscreen once connected
        document.addEventListener('click', function (e) {
            if (e.target.closest('#btnCopy')) return;
            if (anaState.connected) requestFullscreen();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
