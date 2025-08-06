// ===== AUTHENTICATION SYSTEM =====
// Add this as public/js/auth.js

class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.users = new Map(); // In-memory storage for demo (replace with database)
        this.initializeDefaultUsers();
    }

    // Initialize some default users for testing
    initializeDefaultUsers() {
        // Format: participantNumber -> {pin, permissions, studyGroup, etc.}
        this.users.set('P001', { 
            pin: '1234', 
            permissions: 'participant',
            studyGroup: 'control',
            assignedTests: ['ccpt', 'nback']
        });
        this.users.set('P002', { 
            pin: '5678', 
            permissions: 'participant',
            studyGroup: 'treatment',
            assignedTests: ['ccpt', 'nback']
        });
        this.users.set('ADMIN', { 
            pin: '0000', 
            permissions: 'admin',
            studyGroup: 'admin',
            assignedTests: ['ccpt', 'nback']
        });
    }

    // Authenticate user with participant number and PIN
    async authenticate(participantNumber, pin) {
        console.log(`🔐 Attempting authentication for: ${participantNumber}`);
        
        // Check if user exists
        const user = this.users.get(participantNumber.toUpperCase());
        if (!user) {
            throw new Error('Invalid participant number');
        }

        // Check PIN
        if (user.pin !== pin) {
            throw new Error('Invalid PIN');
        }

        // Set current user
        this.currentUser = {
            participantNumber: participantNumber.toUpperCase(),
            ...user,
            loginTime: new Date()
        };

        console.log('✅ Authentication successful:', this.currentUser);
        return this.currentUser;
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }

    // Check if user is admin
    isAdmin() {
        return this.currentUser && this.currentUser.permissions === 'admin';
    }

    // Check if user has specific test assigned
    hasTestAccess(testType) {
        return this.currentUser && this.currentUser.assignedTests.includes(testType);
    }

    // Logout
    logout() {
        this.currentUser = null;
        console.log('👋 User logged out');
    }

    // Admin function: Add new participant
    addParticipant(participantNumber, pin, studyGroup = 'control', assignedTests = ['ccpt', 'nback']) {
        if (!this.isAdmin()) {
            throw new Error('Admin access required');
        }

        this.users.set(participantNumber.toUpperCase(), {
            pin: pin,
            permissions: 'participant',
            studyGroup: studyGroup,
            assignedTests: assignedTests,
            createdBy: this.currentUser.participantNumber,
            createdAt: new Date()
        });

        console.log(`👤 Added participant: ${participantNumber}`);
    }

    // Admin function: Get all participants
    getAllParticipants() {
        if (!this.isAdmin()) {
            throw new Error('Admin access required');
        }

        const participants = [];
        for (let [number, data] of this.users.entries()) {
            if (data.permissions === 'participant') {
                participants.push({
                    participantNumber: number,
                    studyGroup: data.studyGroup,
                    assignedTests: data.assignedTests,
                    createdAt: data.createdAt
                });
            }
        }
        return participants;
    }
}

// Initialize global auth system
window.AuthSystem = new AuthSystem();