// ===== ENVIRONMENT CHECKER =====
// Validates the participant's device and browser before tests begin.
// Returns { passed: bool, blockers: string[], warnings: string[] }.
// Results are stored in window.CCPTApp.environmentCheckResults and
// included in the Firestore session document.

const EnvironmentChecker = {
    async runChecks() {
        const blockers = [];
        const warnings = [];
        const info = {};

        // 1. Screen size — minimum 800×600 for stimulus display
        info.screenWidth = window.innerWidth;
        info.screenHeight = window.innerHeight;
        if (window.innerWidth < 800 || window.innerHeight < 600) {
            blockers.push(`Screen too small (${window.innerWidth}×${window.innerHeight}). Please use a laptop or desktop with at least 800×600 pixels.`);
        }

        // 2. Required browser APIs
        if (typeof performance === 'undefined' || typeof performance.now !== 'function') {
            blockers.push('Your browser does not support high-resolution timing (performance.now). Please update your browser.');
        }
        if (typeof crypto === 'undefined' || typeof crypto.subtle === 'undefined') {
            blockers.push('Your browser does not support the Web Crypto API. Please update your browser.');
        }
        if (typeof sessionStorage === 'undefined') {
            blockers.push('Your browser does not support sessionStorage. Please enable cookies/storage or update your browser.');
        }

        // 3. Mobile device warning (touch-only, no physical keyboard)
        const isTouchOnly = ('ontouchstart' in window) && !window.matchMedia('(pointer: fine)').matches;
        if (isTouchOnly) {
            warnings.push('You appear to be on a touch-only device. These tests require a physical keyboard. If you have a keyboard attached, you may proceed.');
        }
        info.isTouchOnly = isTouchOnly;

        // 4. Battery check (where API is available)
        if (navigator.getBattery) {
            try {
                const battery = await navigator.getBattery();
                info.batteryLevel = Math.round(battery.level * 100);
                info.batteryCharging = battery.charging;
                if (battery.level < 0.2 && !battery.charging) {
                    warnings.push(`Battery is low (${info.batteryLevel}%). Please plug in your device before starting the tests.`);
                }
            } catch (_) { /* API not supported or denied */ }
        }

        // 5. Timer precision check — run a 200ms sleep and check actual elapsed time
        try {
            const t0 = performance.now();
            await new Promise(resolve => setTimeout(resolve, 200));
            const elapsed = performance.now() - t0;
            info.timerDeviation = Math.round(Math.abs(elapsed - 200));
            if (info.timerDeviation > 100) {
                warnings.push(`Timer precision may be reduced (deviation: ${info.timerDeviation}ms). Ensure this tab is in the foreground and your device is not in power-saving mode.`);
            }
        } catch (_) {}

        const results = {
            passed: blockers.length === 0,
            blockers,
            warnings,
            info,
            checkedAt: new Date().toISOString()
        };

        if (window.CCPTApp) {
            window.CCPTApp.environmentCheckResults = results;
        }

        return results;
    },

    // Run checks and render results into the environment-check screen.
    async runAndDisplay() {
        const container = document.getElementById('env-check-results');
        const keyboardSection = document.getElementById('env-check-keyboard-test');
        const actionsSection = document.getElementById('env-check-actions');
        const proceedBtn = document.getElementById('env-proceed-btn');

        if (!container) return;

        // Show spinner while running
        container.innerHTML = '<div class="env-check-running"><div class="spinner-small"></div><p>Running checks...</p></div>';

        const results = await EnvironmentChecker.runChecks();

        // Build results HTML
        let html = '<ul class="env-check-list">';

        if (results.blockers.length === 0 && results.warnings.length === 0) {
            html += '<li class="env-check-item env-check-pass">All checks passed — your setup looks good!</li>';
        }

        results.blockers.forEach(b => {
            html += `<li class="env-check-item env-check-fail"><strong>Issue:</strong> ${b}</li>`;
        });

        results.warnings.forEach(w => {
            html += `<li class="env-check-item env-check-warn"><strong>Warning:</strong> ${w}</li>`;
        });

        // Info items
        const { info } = results;
        html += `<li class="env-check-item env-check-info">Screen: ${info.screenWidth}×${info.screenHeight} px</li>`;
        if (info.batteryLevel !== undefined) {
            html += `<li class="env-check-item env-check-info">Battery: ${info.batteryLevel}%${info.batteryCharging ? ' (charging)' : ''}</li>`;
        }
        if (info.timerDeviation !== undefined) {
            html += `<li class="env-check-item env-check-info">Timer deviation: ${info.timerDeviation}ms</li>`;
        }

        html += '</ul>';

        if (results.warnings.length > 0) {
            html += '<p class="env-check-notice">You may still proceed despite the warnings above, but please ensure your environment is as quiet and distraction-free as possible.</p>';
        }

        container.innerHTML = html;

        if (results.blockers.length > 0) {
            // Hard stop — cannot proceed
            if (actionsSection) actionsSection.style.display = 'block';
            if (proceedBtn) proceedBtn.disabled = true;
            return;
        }

        // Show keyboard test
        if (keyboardSection) {
            keyboardSection.style.display = 'block';
            EnvironmentChecker._runKeyboardTest(proceedBtn, actionsSection);
        } else {
            if (actionsSection) actionsSection.style.display = 'block';
            if (proceedBtn) proceedBtn.disabled = false;
        }
    },

    _runKeyboardTest(proceedBtn, actionsSection) {
        const statusEl = document.getElementById('env-keyboard-status');
        let passed = false;

        const handler = (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                passed = true;
                if (statusEl) {
                    statusEl.textContent = 'Spacebar detected!';
                    statusEl.className = 'env-keyboard-status env-keyboard-pass';
                }
                document.removeEventListener('keydown', handler);
                if (actionsSection) actionsSection.style.display = 'block';
                if (proceedBtn) proceedBtn.disabled = false;

                // Update stored results with keyboard pass
                if (window.CCPTApp && window.CCPTApp.environmentCheckResults) {
                    window.CCPTApp.environmentCheckResults.keyboardPassed = true;
                }
            }
        };

        document.addEventListener('keydown', handler);
    }
};

window.EnvironmentChecker = EnvironmentChecker;
