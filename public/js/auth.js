// ===== AUTHENTICATION SYSTEM =====
// Firestore-backed authentication with SHA-256 hashed PINs and sessionStorage tokens.
//
// Participant documents live in the Firestore 'participants' collection.
// Create them via the Firebase console or the /scripts/hash-pin.js helper.
// Document shape:
//   {
//     participantId: "P001",
//     pinHash: "<SHA-256 hex of the PIN>",
//     studyGroup: "control" | "treatment" | "placebo",
//     assignedTests: ["ccpt", "nback"],
//     isActive: true,
//     sessionsCompleted: 0,
//     createdAt: <timestamp>
//   }

const SESSION_KEY = 'ccpt_session';

class AuthSystem {
    constructor() {
        this.currentUser = null;
        this._restoreSession();
    }

    // Restore session from sessionStorage on page reload within the same browser session.
    _restoreSession() {
        try {
            const raw = sessionStorage.getItem(SESSION_KEY);
            if (!raw) return;
            const { token, user } = JSON.parse(raw);
            if (token && user) {
                this.currentUser = user;
            }
        } catch (_) {
            sessionStorage.removeItem(SESSION_KEY);
        }
    }

    // Hash a PIN string to a hex SHA-256 digest using the Web Crypto API.
    async _hashPin(pin) {
        const encoder = new TextEncoder();
        const data = encoder.encode(pin);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    // Authenticate against Firestore.
    async authenticate(participantNumber, pin) {
        const id = participantNumber.trim().toUpperCase();

        // Require Firebase to be ready
        if (!window.CCPTApp || !window.CCPTApp.db) {
            // Fall back to built-in demo credentials when Firebase is unavailable
            return this._authenticateFallback(id, pin);
        }

        const pinHash = await this._hashPin(pin);

        let doc;
        try {
            doc = await window.CCPTApp.db.collection('participants').doc(id).get();
        } catch (err) {
            console.warn('Firestore lookup failed, trying fallback auth:', err.message);
            return this._authenticateFallback(id, pin);
        }

        if (!doc.exists) {
            throw new Error('Invalid participant number or PIN');
        }

        const data = doc.data();

        if (!data.isActive) {
            throw new Error('This participant account has been deactivated');
        }

        if (data.pinHash !== pinHash) {
            throw new Error('Invalid participant number or PIN');
        }

        const user = {
            participantNumber: id,
            permissions: data.permissions || 'participant',
            studyGroup: data.studyGroup || 'unknown',
            assignedTests: data.assignedTests || ['ccpt', 'nback'],
            loginTime: new Date()
        };

        this._saveSession(user);
        return user;
    }

    // Simple fallback for when Firestore is unavailable (development / demo mode).
    // Uses plaintext PINs — only for demo use, never in production.
    async _authenticateFallback(id, pin) {
        const demo = {
            P001: { pin: '1234', studyGroup: 'control', assignedTests: ['ccpt', 'nback'], permissions: 'participant' },
            P002: { pin: '5678', studyGroup: 'treatment', assignedTests: ['ccpt', 'nback'], permissions: 'participant' },
            ADMIN: { pin: '0000', studyGroup: 'admin', assignedTests: ['ccpt', 'nback'], permissions: 'admin' }
        };

        const record = demo[id];
        if (!record || record.pin !== pin) {
            throw new Error('Invalid participant number or PIN');
        }

        console.warn('⚠️ Using demo credentials — Firebase unavailable. Do not use in production.');

        const user = {
            participantNumber: id,
            permissions: record.permissions,
            studyGroup: record.studyGroup,
            assignedTests: record.assignedTests,
            loginTime: new Date()
        };

        this._saveSession(user);
        return user;
    }

    _saveSession(user) {
        this.currentUser = user;
        const token = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, user }));
    }

    getCurrentUser() {
        return this.currentUser;
    }

    isAdmin() {
        return this.currentUser && this.currentUser.permissions === 'admin';
    }

    hasTestAccess(testType) {
        return this.currentUser && this.currentUser.assignedTests.includes(testType);
    }

    logout() {
        this.currentUser = null;
        sessionStorage.removeItem(SESSION_KEY);
    }

    // Admin: enroll a participant into Firestore.
    // Requires Firebase to be available and the participant collection to allow writes
    // (currently disabled by Firestore rules — use Firebase console or scripts/hash-pin.js instead).
    async enrollParticipant(participantNumber, pin, studyGroup = 'control', assignedTests = ['ccpt', 'nback']) {
        if (!this.isAdmin()) {
            throw new Error('Admin access required');
        }
        if (!window.CCPTApp || !window.CCPTApp.db) {
            throw new Error('Firebase not available');
        }

        const id = participantNumber.trim().toUpperCase();
        const pinHash = await this._hashPin(pin);

        await window.CCPTApp.db.collection('participants').doc(id).set({
            participantId: id,
            pinHash,
            studyGroup,
            assignedTests,
            permissions: 'participant',
            isActive: true,
            sessionsCompleted: 0,
            createdAt: new Date(),
            createdBy: this.currentUser.participantNumber
        });

        return id;
    }

    // Admin: fetch all participant records from Firestore.
    async getAllParticipants() {
        if (!this.isAdmin()) {
            throw new Error('Admin access required');
        }
        if (!window.CCPTApp || !window.CCPTApp.db) {
            return [];
        }

        const snapshot = await window.CCPTApp.db.collection('participants').get();
        const participants = [];
        snapshot.forEach(doc => {
            const d = doc.data();
            if (d.permissions !== 'admin') {
                participants.push({
                    participantNumber: doc.id,
                    studyGroup: d.studyGroup,
                    assignedTests: d.assignedTests,
                    isActive: d.isActive,
                    sessionsCompleted: d.sessionsCompleted || 0,
                    createdAt: d.createdAt
                });
            }
        });
        return participants;
    }

    // Admin: deactivate a participant (prevents future logins).
    async deactivateParticipant(participantNumber) {
        if (!this.isAdmin()) {
            throw new Error('Admin access required');
        }
        if (!window.CCPTApp || !window.CCPTApp.db) {
            throw new Error('Firebase not available');
        }
        const id = participantNumber.trim().toUpperCase();
        await window.CCPTApp.db.collection('participants').doc(id).update({ isActive: false });
    }
}

// Initialise global auth system.
// If a session was saved in sessionStorage, currentUser is restored immediately.
window.AuthSystem = new AuthSystem();

// Re-hydrate CCPTApp login state if a session is already active.
document.addEventListener('DOMContentLoaded', function () {
    if (window.AuthSystem.currentUser && window.CCPTApp) {
        window.CCPTApp.currentUser = window.AuthSystem.currentUser;
        window.CCPTApp.isLoggedIn = true;
    }
});
