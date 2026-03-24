// ===== CONSENT MANAGER =====
// Handles informed consent workflow for research participants.
//
// Flow:
//   1. After login, showScreen('consent-screen') is called.
//   2. Participant scrolls through consent text — "I Agree" button is gated until bottom is reached.
//   3. On agreement, consent is written to Firestore 'consent_records' and cached in sessionStorage.
//   4. Navigation proceeds to 'environment-check' screen.
//
// Bump CONSENT_VERSION whenever the study protocol or consent text changes.
// This forces all participants to re-consent on their next login.

const CONSENT_VERSION = '1.0.0';

const ConsentManager = {
    // Check whether the current participant has already consented in this browser session.
    hasConsented() {
        try {
            const raw = sessionStorage.getItem('ccpt_consent');
            if (!raw) return false;
            const { participantId, version } = JSON.parse(raw);
            const currentUser = window.CCPTApp && window.CCPTApp.currentUser;
            return currentUser
                && participantId === currentUser.participantNumber
                && version === CONSENT_VERSION;
        } catch (_) {
            return false;
        }
    },

    // Record consent to Firestore and sessionStorage.
    async recordConsent() {
        const currentUser = window.CCPTApp && window.CCPTApp.currentUser;
        if (!currentUser) throw new Error('Not logged in');

        const record = {
            participantId: currentUser.participantNumber,
            consentVersion: CONSENT_VERSION,
            consentTimestamp: new Date(),
            userAgent: navigator.userAgent,
            screenResolution: `${window.screen.width}x${window.screen.height}`
        };

        // Write to Firestore (append-only — no client reads)
        if (window.CCPTApp.db) {
            try {
                await window.CCPTApp.db.collection('consent_records').add(record);
            } catch (err) {
                console.warn('Consent Firestore write failed (continuing):', err.message);
            }
        }

        // Cache in sessionStorage so we don't re-prompt on refresh
        sessionStorage.setItem('ccpt_consent', JSON.stringify({
            participantId: currentUser.participantNumber,
            version: CONSENT_VERSION
        }));

        AuditLogger.log(AuditLogger.EVENTS.CONSENT_RECORDED, {
            participantId: currentUser.participantNumber,
            consentVersion: CONSENT_VERSION
        });
    },

    // Set up the consent screen UI (call from showScreen switch).
    setupConsentScreen() {
        const scrollBox = document.getElementById('consent-text-box');
        const agreeBtn = document.getElementById('consent-agree-btn');
        const checkbox = document.getElementById('consent-checkbox');
        const confirmId = document.getElementById('consent-confirm-id');

        if (!scrollBox || !agreeBtn) return;

        // Disable agree button until scrolled to bottom
        agreeBtn.disabled = true;

        const checkScrolled = () => {
            const atBottom = scrollBox.scrollTop + scrollBox.clientHeight >= scrollBox.scrollHeight - 10;
            if (atBottom) {
                scrollBox.removeEventListener('scroll', checkScrolled);
                if (checkbox) checkbox.disabled = false;
                _updateAgreeButton();
            }
        };
        scrollBox.addEventListener('scroll', checkScrolled);

        if (checkbox) {
            checkbox.checked = false;
            checkbox.disabled = true;
            checkbox.addEventListener('change', _updateAgreeButton);
        }

        function _updateAgreeButton() {
            const checked = checkbox ? checkbox.checked : true;
            agreeBtn.disabled = !checked;
        }

        // Handle form submission
        const form = document.getElementById('consent-form');
        if (form) {
            // Remove any previous listener to avoid duplication on re-entry
            form.replaceWith(form.cloneNode(true));
            const freshForm = document.getElementById('consent-form');
            freshForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const idInput = document.getElementById('consent-confirm-id');
                if (idInput && window.CCPTApp.currentUser) {
                    const entered = idInput.value.trim().toUpperCase();
                    const expected = window.CCPTApp.currentUser.participantNumber;
                    if (entered !== expected) {
                        const errEl = document.getElementById('consent-error');
                        if (errEl) {
                            errEl.textContent = `Participant ID does not match your login (${expected}).`;
                            errEl.style.display = 'block';
                        }
                        return;
                    }
                }

                try {
                    await ConsentManager.recordConsent();
                    showScreen('environment-check');
                } catch (err) {
                    console.error('Consent recording failed:', err);
                    showError('Failed to record consent. Please try again.');
                }
            });
        }
    }
};

window.ConsentManager = ConsentManager;
window.CONSENT_VERSION = CONSENT_VERSION;
