/**
 * OptoMeasure — Patient VR View (vr.js)
 * Handles split-screen cardboard mode.
 * Now also responds to displayMode switch from controller.
 */
(function () {
    'use strict';

    const vrState = {
        currentStep: 0,
        ipd:  VR_CONFIG.defaultIPD,
        mode: 'BO',
        connected: false,
        peer: null,
        conn: null,
        roomCode: '',
    };

    const $ = id => document.getElementById(id);

    function activeSteps() { return getActiveSteps(vrState.mode); }

    function computeLayout() {
        const L       = VR_CONFIG.layout;
        const pxPerCm = getDevicePxPerCm();
        const c       = $('vrContainer');
        c.style.setProperty('--container-w', (L.containerWidthCm  * pxPerCm.x) + 'px');
        c.style.setProperty('--container-h', (L.containerHeightCm * pxPerCm.y) + 'px');
        c.style.setProperty('--eye-w',       (L.eyeWidthCm        * pxPerCm.x) + 'px');
    }

    function renderLines() {
        const llH  = cmToPixels (VR_CONFIG.layout.lineLengthCm);
        const llV  = cmToPixelsY(VR_CONFIG.layout.lineLengthCm);
        const lw   = VR_CONFIG.lineThicknessPx;
        const ds   = VR_CONFIG.dotSizePx;
        const hd   = ds / 2;
        $('hLineLeft').style.cssText  = `width:${llH}px;height:${lw}px;right:${hd}px;left:auto;`;
        $('hLineRight').style.cssText = `width:${llH}px;height:${lw}px;left:${hd}px;right:auto;`;
        $('vLineTop').style.cssText    = `height:${llV}px;width:${lw}px;bottom:${hd}px;top:auto;`;
        $('vLineBottom').style.cssText = `height:${llV}px;width:${lw}px;top:${hd}px;bottom:auto;`;
        ['dotLeft','dotRight'].forEach(id => {
            $(id).style.cssText = `width:${ds}px;height:${ds}px;`;
        });
    }

    function applyVisualState() {
        const steps   = activeSteps();
        const stepIdx = Math.max(0, Math.min(vrState.currentStep, steps.length - 1));
        const step    = steps[stepIdx];
        const p       = getDevicePxPerCm();
        const shiftPx = step.shiftCm * p.x;
        const eyeWPx  = VR_CONFIG.layout.eyeWidthCm * p.x;
        const ipdOff  = (mmToPixels(vrState.ipd) / 2) - (eyeWPx / 2);
        const sign    = (vrState.mode === 'BO') ? 1 : -1;
        const leftX   = -ipdOff + sign * shiftPx;
        const rightX  =  ipdOff - sign * shiftPx;
        const lc = $('leftContent');
        const rc = $('rightContent');
        lc.style.marginLeft = '';
        rc.style.marginLeft = '';
        lc.style.transform  = `translate(calc(-50% + ${leftX}px), -50%)`;
        rc.style.transform  = `translate(calc(-50% + ${rightX}px), -50%)`;
    }

    function handleCommand(data) {
        switch (data.type) {
            case 'update':
                if (data.activeStepTable) vrState.mode = data.activeStepTable;
                else if (data.mode)       vrState.mode = data.mode;
                if (data.ipd !== undefined) vrState.ipd = data.ipd;
                vrState.currentStep = Math.max(0,
                    Math.min(data.step, activeSteps().length - 1));
                applyVisualState();
                break;
            case 'reset':
                vrState.currentStep = 0;
                applyVisualState();
                break;
            case 'ipd':
                vrState.ipd = data.value;
                applyVisualState();
                break;
            case 'mode':
                vrState.mode = data.value;
                vrState.currentStep = 0;
                applyVisualState();
                break;
            case 'displayMode':
                // Controller switched to anaglyph — redirect
                if (data.value === 'ANA') window.location.href = 'anaglyph.html';
                break;
        }
    }

    function requestFullscreen() {
        const el  = document.documentElement;
        const rfs = el.requestFullscreen || el.webkitRequestFullscreen;
        if (!rfs) return;
        rfs.call(el).then(function () {
            setTimeout(function () { computeLayout(); renderLines(); applyVisualState(); }, 300);
        }).catch(function () {});
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(function () {});
        }
    }

    function initPeer() {
        vrState.roomCode = generateRoomCode();
        $('roomCode').textContent = vrState.roomCode;
        const peerId   = 'optovr-' + vrState.roomCode.toLowerCase();
        const peerOpts = {
            debug: 1,
            config: { iceServers: [
                { urls: 'stun:stun.l.google.com:19302'  },
                { urls: 'stun:stun1.l.google.com:19302' },
            ]},
        };
        vrState.peer = new Peer(peerId, peerOpts);
        vrState.peer.on('open', function () {
            console.log('[VR] Peer ready:', peerId);
        });
        vrState.peer.on('connection', function (conn) {
            vrState.conn = conn;
            conn.on('open', function () {
                vrState.connected = true;
                $('connectOverlay').classList.add('hidden');
                $('connIndicator').classList.add('connected');
                conn.send({ type: 'connected', roomCode: vrState.roomCode });
                requestFullscreen();
            });
            conn.on('data',  function (data) { handleCommand(data); });
            conn.on('close', function () {
                vrState.connected = false;
                $('connIndicator').classList.remove('connected');
                $('connectOverlay').classList.remove('hidden');
                const txt = $('connectStatus');
                if (txt) txt.innerHTML =
                    '<span class="status-dot waiting"></span> Disconnected. Waiting…';
            });
        });
        vrState.peer.on('error', function (err) {
            console.error('[VR] error:', err);
            setTimeout(initPeer, 3000);
        });
    }

    function init() {
        computeLayout();
        renderLines();
        applyVisualState();
        initPeer();
        window.addEventListener('resize', function () {
            computeLayout(); renderLines(); applyVisualState();
        });
        document.addEventListener('click', function (e) {
            if (e.target.closest('#btnCopy')) return;
            if (vrState.connected) requestFullscreen();
        });
        const btnCopy = $('btnCopy');
        if (btnCopy) {
            btnCopy.addEventListener('click', async function () {
                try {
                    await navigator.clipboard.writeText(vrState.roomCode);
                    btnCopy.textContent = '✅';
                    setTimeout(() => btnCopy.textContent = '📋', 2000);
                } catch (e) {}
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
