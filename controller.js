/**
 * OptoMeasure — Controller (controller.js)
 *
 * New in this version:
 *  • Display mode toggle: VR (split-screen) ↔ ANA (anaglyph)
 *  • Target switcher: CAGE_CROSS | CIRCLE_DOT | BIRD_CAGE (anaglyph only)
 *  • All fixes: separate connect/control pages, working +/−, BI step table
 */
(function () {
    'use strict';

    const ctrl = {
        currentStep:  0,
        mode:         'BO',
        ipd:          VR_CONFIG.defaultIPD,
        displayMode:  VR_CONFIG.defaultDisplayMode,  // 'VR' | 'ANA'
        targetType:   VR_CONFIG.defaultTarget,        // 'CAGE_CROSS' etc.
        connected:    false,
        peer:         null,
        conn:         null,
    };

    const $ = id => document.getElementById(id);

    function showToast(msg, duration = 2500) {
        const t = $('toast');
        t.textContent = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), duration);
    }

    function activeSteps() {
        return getActiveSteps(ctrl.mode);
    }

    // ── Page switching ────────────────────────────────────────────────────────
    function showControls() {
        $('connectSection').style.display = 'none';
        $('mainControls').style.display   = 'flex';
        $('mainControls').style.flexDirection = 'column';
    }
    function showConnect() {
        $('connectSection').style.display = 'flex';
        $('mainControls').style.display   = 'none';
    }

    // ── Connection ────────────────────────────────────────────────────────────
    function connect() {
        const code = $('inputRoomCode').value.trim().toUpperCase();
        if (code.length < 4) {
            $('connectHint').textContent = 'Enter a valid room code (4–6 chars).';
            return;
        }
        $('connectHint').textContent = 'Connecting…';
        $('btnConnect').disabled = true;

        const myId     = 'optoctrl-' + Date.now();
        const peerOpts = {
            debug: 1,
            config: { iceServers: [
                { urls: 'stun:stun.l.google.com:19302'  },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
            ]},
        };

        ctrl.peer = new Peer(myId, peerOpts);

        ctrl.peer.on('open', function () {
            const targetId = 'optovr-' + code.toLowerCase();
            ctrl.conn = ctrl.peer.connect(targetId, { reliable: true });

            ctrl.conn.on('open', function () {
                ctrl.connected = true;
                onConnected();
            });
            ctrl.conn.on('data', function (data) {
                if (data.type === 'connected') console.log('[Ctrl] VR connected');
            });
            ctrl.conn.on('close', function () {
                ctrl.connected = false;
                onDisconnected();
            });
            ctrl.conn.on('error', function (err) {
                $('connectHint').textContent = 'Connection error: ' + err;
                $('btnConnect').disabled = false;
            });

            setTimeout(function () {
                if (!ctrl.connected) {
                    $('connectHint').textContent = 'Could not connect. Check code and retry.';
                    $('btnConnect').disabled = false;
                    if (ctrl.peer) ctrl.peer.destroy();
                }
            }, 12000);
        });

        ctrl.peer.on('error', function (err) {
            $('connectHint').textContent = 'Peer error: ' + err.type;
            $('btnConnect').disabled = false;
        });
    }

    function onConnected() {
        $('connDot').classList.add('connected');
        $('connText').textContent = 'Connected';
        showToast('✅ Connected to patient device!');
        showControls();
        buildStepTable();
        updateUI();
        sendUpdate();
    }

    function onDisconnected() {
        $('connDot').classList.remove('connected');
        $('connText').textContent = 'Offline';
        $('btnConnect').disabled  = false;
        $('connectHint').textContent = 'Connection lost. Re-enter code.';
        showToast('⚠️ Disconnected');
        showConnect();
    }

    function sendCommand(data) {
        if (ctrl.connected && ctrl.conn && ctrl.conn.open) {
            ctrl.conn.send(data);
        }
    }

    function sendUpdate() {
        const steps = activeSteps();
        const step  = steps[ctrl.currentStep];
        sendCommand({
            type:            'update',
            step:            ctrl.currentStep,
            shiftCm:         step.shiftCm,
            prism:           step.prism,
            adjustedPrism:   getAdjustedPrism(step.prism, ctrl.mode),
            mode:            ctrl.mode,
            ipd:             ctrl.ipd,
            activeStepTable: ctrl.mode,
            displayMode:     ctrl.displayMode,
            targetType:      ctrl.targetType,
        });
    }

    // ── Step table ────────────────────────────────────────────────────────────
    function buildStepTable() {
        const steps = activeSteps();
        const tbody = $('stepTableBody');
        tbody.innerHTML = '';
        steps.forEach(function (s) {
            const row = document.createElement('div');
            row.className    = 'step-row';
            row.dataset.step = s.index;
            const dp = getAdjustedPrism(s.prism, ctrl.mode);
            row.innerHTML =
                '<span>' + s.index + '</span>' +
                '<span>' + s.shiftCm.toFixed(3) + '</span>' +
                '<span>' + dp + 'Δ</span>';
            tbody.appendChild(row);
        });
        if ($('stepMax')) $('stepMax').textContent = steps.length - 1;
    }

    // ── Arc SVG ───────────────────────────────────────────────────────────────
    function updateArc() {
        const arcFill = $('arcFill');
        if (!arcFill) return;
        const steps    = activeSteps();
        const step     = steps[ctrl.currentStep];
        const maxPrism = steps[steps.length - 1].prism;
        const pct      = step.prism / maxPrism;
        arcFill.style.strokeDashoffset = (283 - pct * 283).toFixed(1);
        const ml = $('modeLabel');
        if (ml) ml.textContent = ctrl.mode === 'BO' ? 'BASE-OUT' : 'BASE-IN';
    }

    // ── IPD fill ──────────────────────────────────────────────────────────────
    function updateIPDFill() {
        const fill = $('ipdFill');
        if (!fill) return;
        const pct = (ctrl.ipd - VR_CONFIG.minIPD) / (VR_CONFIG.maxIPD - VR_CONFIG.minIPD) * 100;
        fill.style.width = pct + '%';
    }

    // ── Update display mode buttons ───────────────────────────────────────────
    function updateDisplayModeUI() {
        const isAna = ctrl.displayMode === 'ANA';
        $('btnDisplayVR').classList.toggle('active',  !isAna);
        $('btnDisplayANA').classList.toggle('active',  isAna);

        // Show/hide target panel (only relevant for anaglyph)
        const tp = $('targetPanel');
        if (tp) tp.style.display = isAna ? 'block' : 'none';
    }

    // ── Update target buttons ─────────────────────────────────────────────────
    function updateTargetUI() {
        document.querySelectorAll('.btn-target').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.target === ctrl.targetType);
        });
    }

    // ── Main UI update ────────────────────────────────────────────────────────
    function updateUI() {
        const steps        = activeSteps();
        const step         = steps[ctrl.currentStep];
        const displayPrism = getAdjustedPrism(step.prism, ctrl.mode);

        $('prismValue').textContent = displayPrism;
        $('stepNum').textContent    = ctrl.currentStep;
        $('shiftValue').textContent = step.shiftCm.toFixed(3);
        if ($('stepMax')) $('stepMax').textContent = steps.length - 1;

        document.querySelectorAll('.step-row[data-step]').forEach(row => {
            const s = parseInt(row.dataset.step, 10);
            row.classList.remove('active', 'passed');
            if (s === ctrl.currentStep)    row.classList.add('active');
            else if (s < ctrl.currentStep) row.classList.add('passed');
        });

        $('btnBO').classList.toggle('active', ctrl.mode === 'BO');
        $('btnBI').classList.toggle('active', ctrl.mode === 'BI');

        $('ipdValue').textContent = ctrl.ipd;
        $('ipdSlider').value      = ctrl.ipd;

        $('btnMinus').disabled = ctrl.currentStep <= 0;
        $('btnPlus').disabled  = ctrl.currentStep >= steps.length - 1;

        updateArc();
        updateIPDFill();
        updateDisplayModeUI();
        updateTargetUI();
    }

    // ── Actions ───────────────────────────────────────────────────────────────
    function stepForward() {
        const steps = activeSteps();
        if (ctrl.currentStep >= steps.length - 1) {
            showToast('⛔ Maximum ' + steps[steps.length-1].prism + 'Δ reached');
            return;
        }
        ctrl.currentStep++;
        updateUI();
        sendUpdate();
    }

    function stepBackward() {
        if (ctrl.currentStep <= 0) {
            showToast('Already at step 0');
            return;
        }
        ctrl.currentStep--;
        updateUI();
        sendUpdate();
    }

    function resetSteps() {
        ctrl.currentStep = 0;
        updateUI();
        sendCommand({ type: 'reset' });
        showToast('↺ Reset to step 0');
    }

    function setMode(mode) {
        ctrl.mode = mode;
        ctrl.currentStep = 0;
        buildStepTable();
        updateUI();
        sendUpdate();
        showToast(mode === 'BO'
            ? '◀▶  Base-Out — convergence demand'
            : '▶◀  Base-In  — divergence demand (gentle)');
    }

    function setIPD(value) {
        ctrl.ipd = parseInt(value, 10);
        $('ipdValue').textContent = ctrl.ipd;
        updateIPDFill();
        sendCommand({ type: 'ipd', value: ctrl.ipd });
    }

    function setDisplayMode(mode) {
        ctrl.displayMode = mode;
        updateUI();
        sendCommand({ type: 'displayMode', value: mode });
        showToast(mode === 'ANA'
            ? '🕶️  Anaglyph mode — Red-Cyan glasses'
            : '🥽  VR split-screen mode');
    }

    function setTarget(target) {
        ctrl.targetType = target;
        updateTargetUI();
        sendCommand({ type: 'target', value: target });
        const labels = {
            CAGE_CROSS:  '🎯 Target: Cross in Cage',
            CIRCLE_DOT:  '⭕ Target: Dot in Circle',
            BIRD_CAGE:   '🐦 Target: Bird in Cage',
        };
        showToast(labels[target] || target);
    }

    function recordBreak() {
        const step = activeSteps()[ctrl.currentStep];
        const dp   = getAdjustedPrism(step.prism, ctrl.mode);
        $('breakVal').textContent = dp + 'Δ (Step ' + ctrl.currentStep + ')';
        showToast('🔴 Break: ' + dp + 'Δ');
    }

    function recordRecovery() {
        const step = activeSteps()[ctrl.currentStep];
        const dp   = getAdjustedPrism(step.prism, ctrl.mode);
        $('recoveryVal').textContent = dp + 'Δ (Step ' + ctrl.currentStep + ')';
        showToast('🟢 Recovery: ' + dp + 'Δ');
    }

    function clearResults() {
        $('breakVal').textContent    = '—';
        $('recoveryVal').textContent = '—';
        showToast('Results cleared');
    }

    // ── Events ────────────────────────────────────────────────────────────────
    function bindEvents() {
        $('btnConnect').addEventListener('click', connect);
        $('inputRoomCode').addEventListener('keydown', e => {
            if (e.key === 'Enter') connect();
        });

        $('btnPlus').addEventListener('click',  stepForward);
        $('btnMinus').addEventListener('click', stepBackward);
        $('btnReset').addEventListener('click', resetSteps);

        $('btnBO').addEventListener('click', () => setMode('BO'));
        $('btnBI').addEventListener('click', () => setMode('BI'));

        $('ipdSlider').addEventListener('input', function () { setIPD(this.value); });

        $('btnDisplayVR').addEventListener('click',  () => setDisplayMode('VR'));
        $('btnDisplayANA').addEventListener('click', () => setDisplayMode('ANA'));

        document.querySelectorAll('.btn-target').forEach(btn => {
            btn.addEventListener('click', () => setTarget(btn.dataset.target));
        });

        $('btnBreak').addEventListener('click',        recordBreak);
        $('btnRecovery').addEventListener('click',     recordRecovery);
        $('btnClearResults').addEventListener('click', clearResults);

        document.addEventListener('keydown', function (e) {
            if (document.activeElement === $('inputRoomCode')) return;
            switch (e.key) {
                case '+': case '=': case 'ArrowRight': case 'ArrowUp':
                    e.preventDefault(); stepForward();  break;
                case '-': case 'ArrowLeft': case 'ArrowDown':
                    e.preventDefault(); stepBackward(); break;
                case 'r': case 'R':
                    if (!e.ctrlKey) { e.preventDefault(); resetSteps(); } break;
                case 'b': case 'B': e.preventDefault(); recordBreak();    break;
                case 'v': case 'V': e.preventDefault(); recordRecovery(); break;
                case 'i': case 'I':
                    e.preventDefault(); setMode(ctrl.mode === 'BO' ? 'BI' : 'BO'); break;
                case 'm': case 'M':
                    e.preventDefault();
                    setDisplayMode(ctrl.displayMode === 'ANA' ? 'VR' : 'ANA'); break;
            }
        });

        document.querySelectorAll('.btn-move, .btn-record, .mode-btn, .btn-display, .btn-target')
            .forEach(btn => {
                btn.addEventListener('touchend', function (e) {
                    e.preventDefault(); btn.click();
                }, { passive: false });
            });
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    function init() {
        showConnect();
        const slider = $('ipdSlider');
        slider.min   = VR_CONFIG.minIPD;
        slider.max   = VR_CONFIG.maxIPD;
        slider.value = VR_CONFIG.defaultIPD;
        bindEvents();
        buildStepTable();
        updateUI();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
