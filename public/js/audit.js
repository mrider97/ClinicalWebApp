// ===== AUDIT LOGGER =====
// Appends structured events to the Firestore 'audit_log' collection.
// The collection is write-only from the client; read access is via Firebase console only.
//
// Call AuditLogger.log(action, details) at key application events.
// Events are fire-and-forget — failures are logged to console.warn but do not
// interrupt the application flow.

const AuditLogger = {
    // action: string identifying the event (see constants below)
    // details: object with event-specific fields
    log(action, details = {}) {
        if (!window.CCPTApp || !window.CCPTApp.db) return;

        const entry = {
            action,
            timestamp: new Date(),
            userAgent: navigator.userAgent,
            ...details
        };

        window.CCPTApp.db.collection('audit_log').add(entry)
            .catch(err => console.warn('Audit log write failed:', err.message));
    }
};

// Audit event constants — use these strings as the 'action' argument.
AuditLogger.EVENTS = {
    PARTICIPANT_LOGIN:   'participant_login',
    ADMIN_LOGIN:         'admin_login',
    LOGIN_FAILED:        'login_failed',
    LOGOUT:              'logout',
    CONSENT_RECORDED:    'consent_recorded',
    TEST_STARTED:        'test_started',
    TEST_COMPLETED:      'test_completed',
    TEST_ABANDONED:      'test_abandoned',
    DATA_EXPORTED:       'data_exported',
    PARTICIPANT_ENROLLED:'participant_enrolled',
    PARTICIPANT_DEACTIVATED: 'participant_deactivated'
};

window.AuditLogger = AuditLogger;
