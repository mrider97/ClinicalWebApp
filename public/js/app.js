// ===== CLINICAL TRIAL APPLICATION =====

// ===== APP LOGGER =====
// Replace console.log with AppLogger.debug() so debug output can be toggled.
// Enable by appending ?debug=true to the URL.
const _debugEnabled = new URLSearchParams(window.location.search).get('debug') === 'true';
const AppLogger = {
    debug: (...args) => { if (_debugEnabled) console.log(...args); },
    warn:  (...args) => console.warn(...args),
    error: (...args) => console.error(...args)
};
window.AppLogger = AppLogger;

// ===== GLOBAL APPLICATION STATE =====
window.CCPTApp = {
    // Authentication state
    currentUser: null,
    isLoggedIn: false,
    
    // Test flow state
    currentScreen: 'login-screen',
    testFunnelProgress: {
        ccpt: { completed: false, results: null },
        nback: { completed: false, results: null }
    },
    
    // Test configurations (admin-controlled)
    testConfigurations: {
        ccpt: {
            duration: 5, // minutes
            stimulusDuration: 250, // ms
            isiDuration: 1500, // ms
            target: 'X',
            nonTargets: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
            targetProbability: 0.1
        },
        nback: {
            nLevel: 2,
            gridSize: 3,
            stimulusDuration: 500, // ms
            isiDuration: 2500, // ms
            totalTrials: 40,
            practiceTrials: 10,
            targetProbability: 0.3
        }
    },
    
    // Test engines
    ccptEngine: null,
    nbackEngine: null,
    
    // Data storage
    db: null,
    
    // UI state
    isTestInProgress: false
};

// ===== INITIALIZATION =====
function initializeApp() {
    AppLogger.debug('🚀 Initializing Clinical Trial Application...');
    
    hideLoadingScreen();
    initializeFirebase();
    
    // Initialize authentication system
    if (!window.AuthSystem) {
        window.AuthSystem = new AuthSystem();
        AppLogger.debug('✅ Authentication system initialized');
    }
    
    setupEventListeners();
    showScreen('login-screen');
    
    AppLogger.debug('✅ Application initialized successfully');
}

function initializeFirebase() {
    if (!window.FIREBASE_CONFIG) {
        console.error('❌ Firebase config missing. Copy firebase-config.example.js to firebase-config.js and fill in credentials.');
        window.CCPTApp.db = null;
        return;
    }

    try {
        firebase.initializeApp(window.FIREBASE_CONFIG);
        window.CCPTApp.db = firebase.firestore();
        AppLogger.debug('✅ Firebase initialized successfully');
        
        // Test Firebase connection
        window.CCPTApp.db.collection('test_sessions').limit(1).get()
            .then(() => AppLogger.debug('✅ Firebase connection verified'))
            .catch((error) => {
                console.warn('⚠️ Firebase connection issue (continuing without cloud storage):', error.message);
                window.CCPTApp.db = null;
            });
            
    } catch (error) {
        console.error('❌ Firebase initialization failed:', error);
        window.CCPTApp.db = null;
    }
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Admin forms
    const addParticipantForm = document.getElementById('add-participant-form');
    if (addParticipantForm) {
        addParticipantForm.addEventListener('submit', handleAddParticipant);
    }
    
    const ccptConfigForm = document.getElementById('ccpt-config-form');
    if (ccptConfigForm) {
        ccptConfigForm.addEventListener('submit', handleCCPTConfigUpdate);
    }
    
    const nbackConfigForm = document.getElementById('nback-config-form');
    if (nbackConfigForm) {
        nbackConfigForm.addEventListener('submit', handleNBackConfigUpdate);
    }
    
    // Global keypress handling
    document.addEventListener('keydown', handleGlobalKeypress);
    
    // Prevent navigation during tests
    window.addEventListener('beforeunload', (e) => {
        if (window.CCPTApp.isTestInProgress) {
            e.preventDefault();
            e.returnValue = 'Test in progress. Are you sure you want to leave?';
            return e.returnValue;
        }
    });
}

function handleGlobalKeypress(e) {
    // Handle escape key to quit test
    if (e.key === 'Escape' && window.CCPTApp.isTestInProgress) {
        if (confirm('Are you sure you want to end the test early? This will lose current progress.')) {
            endTestEarly();
        }
    }
    
    // Prevent browser shortcuts during test
    if (window.CCPTApp.isTestInProgress) {
        if (e.key === 'F5' || 
            (e.ctrlKey && ['r', 'R', 'w', 'W'].includes(e.key)) ||
            e.key === 'F11') {
            e.preventDefault();
            return false;
        }
    }
}

// ===== AUTHENTICATION =====
async function handleLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const participantNumber = formData.get('participantNumber').trim();
    const pin = formData.get('pin').trim();
    const errorElement = document.getElementById('login-error');
    
    try {
        const user = await window.AuthSystem.authenticate(participantNumber, pin);

        window.CCPTApp.currentUser = user;
        window.CCPTApp.isLoggedIn = true;

        // Generate a session group ID for grouping tests from the same visit
        window.CCPTApp.sessionGroupId = `${user.participantNumber}_${new Date().toISOString().slice(0, 10)}`;

        const eventType = user.permissions === 'admin'
            ? AuditLogger.EVENTS.ADMIN_LOGIN
            : AuditLogger.EVENTS.PARTICIPANT_LOGIN;
        AuditLogger.log(eventType, { participantId: user.participantNumber, studyGroup: user.studyGroup });

        displayUserInfo();

        if (window.AuthSystem.isAdmin()) {
            showScreen('admin-dashboard');
        } else {
            showScreen('consent-screen');
        }

        errorElement.style.display = 'none';

    } catch (error) {
        AuditLogger.log(AuditLogger.EVENTS.LOGIN_FAILED, { attemptedId: participantNumber });
        console.error('❌ Login failed:', error);
        errorElement.textContent = error.message;
        errorElement.style.display = 'block';
    }
}

function displayUserInfo() {
    let userInfoElement = document.getElementById('user-info');
    if (!userInfoElement) {
        userInfoElement = document.createElement('div');
        userInfoElement.id = 'user-info';
        userInfoElement.className = 'user-info';
        document.body.appendChild(userInfoElement);
    }
    
    const user = window.CCPTApp.currentUser;
    userInfoElement.innerHTML = `
        <span class="participant-id">${user.participantNumber}</span>
        <span class="study-group">(${user.studyGroup})</span>
        <button class="logout-btn" onclick="logout()">Logout</button>
    `;
}

function logout() {
    if (window.CCPTApp.currentUser) {
        AuditLogger.log(AuditLogger.EVENTS.LOGOUT, { participantId: window.CCPTApp.currentUser.participantNumber });
    }
    window.AuthSystem.logout();
    window.CCPTApp.currentUser = null;
    window.CCPTApp.isLoggedIn = false;
    window.CCPTApp.sessionGroupId = null;

    resetTestFunnelProgress();

    const userInfo = document.getElementById('user-info');
    if (userInfo) userInfo.remove();

    showScreen('login-screen');
}

// ===== NAVIGATION =====
function showScreen(screenId) {
    // Check authentication requirements
    if (!window.CCPTApp.isLoggedIn && screenId !== 'login-screen') {
        showScreen('login-screen');
        return;
    }
    
    AppLogger.debug(`📺 Showing screen: ${screenId}`);
    
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show target screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        window.CCPTApp.currentScreen = screenId;
    } else {
        console.error(`❌ Screen not found: ${screenId}`);
        return;
    }
    
    // Screen-specific setup
    switch (screenId) {
        case 'login-screen':
            setupLoginScreen();
            break;
        case 'consent-screen':
            ConsentManager.setupConsentScreen();
            break;
        case 'environment-check':
            EnvironmentChecker.runAndDisplay();
            break;
        case 'test-funnel':
            setupTestFunnel();
            break;
        case 'inter-test-rest':
            startInterTestRest();
            break;
        case 'post-session-questionnaire':
            setupPostSessionQuestionnaire();
            break;
        case 'admin-dashboard':
            setupAdminDashboard();
            break;
        case 'ccpt-practice':
            setupCCPTPracticeScreen();
            break;
        case 'nback-practice':
            setupNBackPracticeScreen();
            break;
        case 'final-results':
            displayFinalResults();
            break;
    }
}

function goHome() {
    AppLogger.debug('🏠 Going home...');
    
    // Check for running tests
    const anySessionRunning = window.CCPTApp.isTestInProgress || 
        (window.CCPTApp.ccptEngine && window.CCPTApp.ccptEngine.isAnySessionRunning()) ||
        (window.CCPTApp.nbackEngine && window.CCPTApp.nbackEngine.isAnySessionRunning());
        
    if (anySessionRunning) {
        showNavigationWarning();
        return;
    }
    
    // Navigate based on login status and user type
    if (!window.CCPTApp.isLoggedIn) {
        showScreen('login-screen');
    } else if (window.AuthSystem && window.AuthSystem.isAdmin()) {
        showScreen('admin-dashboard');
    } else {
        showScreen('test-funnel');
    }
}

function goToAdmin() {
    if (!window.CCPTApp.isLoggedIn) {
        showScreen('login-screen');
        return;
    }
    
    if (window.AuthSystem.isAdmin()) {
        showScreen('admin-dashboard');
    } else {
        showError('Admin access required');
    }
}

function showNavigationWarning() {
    const modal = document.getElementById('navigation-warning-modal');
    if (modal) modal.style.display = 'block';
}

function closeModal() {
    const modal = document.getElementById('navigation-warning-modal');
    if (modal) modal.style.display = 'none';
}

// ===== SCREEN SETUP FUNCTIONS =====
function setupLoginScreen() {
    setTimeout(() => {
        const participantField = document.getElementById('participant-number');
        if (participantField) participantField.focus();
    }, 100);
}

function setupTestFunnel() {
    updateTestFunnelDisplay();

    // Show checklist only before the very first test; hide after CCPT is done
    const checklist = document.getElementById('pre-test-checklist');
    const progress = window.CCPTApp.testFunnelProgress;
    const anyDone = progress.ccpt.completed || progress.nback.completed;
    if (checklist) checklist.style.display = anyDone ? 'none' : 'block';

    // Update session label with session number if available
    const sessionLabel = document.getElementById('session-label');
    if (sessionLabel && window.CCPTApp.currentUser) {
        const gid = window.CCPTApp.sessionGroupId;
        if (gid) sessionLabel.textContent = `Session ${gid.split('_')[1] || ''} — Complete both tests to finish`;
    }
}

function startNextTestWithChecklist() {
    const progress = window.CCPTApp.testFunnelProgress;
    const anyDone = progress.ccpt.completed || progress.nback.completed;

    // Only enforce checklist before the first test
    if (!anyDone) {
        const checkboxes = document.querySelectorAll('.checklist-cb');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        if (!allChecked) {
            const errEl = document.getElementById('checklist-error');
            if (errEl) errEl.style.display = 'block';
            return;
        }
        const errEl = document.getElementById('checklist-error');
        if (errEl) errEl.style.display = 'none';
    }

    startNextTest();
}

function setupCCPTPracticeScreen() {
    AppLogger.debug('🎯 Setting up CCPT practice screen...');
    
    // Update target display
    const targetDisplay = document.getElementById('ccpt-target-display');
    if (targetDisplay && window.CCPTApp.testConfigurations.ccpt.target) {
        targetDisplay.textContent = window.CCPTApp.testConfigurations.ccpt.target;
    }
    
    // Hide practice results initially
    const resultsContainer = document.getElementById('ccpt-practice-results');
    if (resultsContainer) {
        resultsContainer.classList.remove('show');
    }
    
    // Hide stimulus area initially
    const stimulusArea = document.getElementById('ccpt-practice-stimulus-area');
    if (stimulusArea) {
        stimulusArea.style.display = 'none';
    }
}

function setupNBackPracticeScreen() {
    AppLogger.debug('🧠 Setting up N-Back practice screen...');
    
    // Update N-level display
    const levelDisplay = document.getElementById('nback-level-display');
    if (levelDisplay && window.CCPTApp.testConfigurations.nback.nLevel) {
        levelDisplay.textContent = window.CCPTApp.testConfigurations.nback.nLevel;
    }
    
    // Hide practice results initially
    const resultsContainer = document.getElementById('nback-practice-results');
    if (resultsContainer) {
        resultsContainer.classList.remove('show');
    }
    
    // Hide test area initially
    const testArea = document.getElementById('nback-practice-test-area');
    if (testArea) {
        testArea.style.display = 'none';
    }
}

function setupAdminDashboard() {
    loadParticipantList();
    loadTestConfigurations();
    loadSessionStatistics();
}

// ===== TEST FUNNEL MANAGEMENT =====
function resetTestFunnelProgress() {
    window.CCPTApp.testFunnelProgress = {
        ccpt: { completed: false, results: null },
        nback: { completed: false, results: null }
    };
}

function updateTestFunnelProgress(testType, results) {
    window.CCPTApp.testFunnelProgress[testType] = {
        completed: true,
        results: results
    };
    
    // Check if all tests are completed
    const allCompleted = Object.values(window.CCPTApp.testFunnelProgress)
        .every(test => test.completed);
        
    if (allCompleted) {
        showScreen('final-results');
    } else {
        showScreen('test-funnel');
    }
}

function updateTestFunnelDisplay() {
    const progress = window.CCPTApp.testFunnelProgress;
    
    // Calculate progress percentage
    const completedTests = Object.values(progress).filter(test => test.completed).length;
    const totalTests = Object.keys(progress).length;
    const progressPercent = (completedTests / totalTests) * 100;
    
    // Update progress bar
    const progressFill = document.querySelector('.test-progress-fill');
    if (progressFill) {
        progressFill.style.width = `${progressPercent}%`;
    }
    
    // Update test cards
    updateTestCard('ccpt', progress.ccpt);
    updateTestCard('nback', progress.nback);
    
    // Show appropriate button
    const nextTest = getNextIncompleteTest();
    const continueBtn = document.getElementById('continue-test-btn');
    const viewResultsBtn = document.getElementById('view-results-btn');
    
    if (nextTest) {
        continueBtn.style.display = 'block';
        continueBtn.textContent = nextTest === 'ccpt' ? 'Start CCPT Test' : 'Start N-Back Test';
        viewResultsBtn.style.display = 'none';
    } else {
        continueBtn.style.display = 'none';
        viewResultsBtn.style.display = 'block';
    }
}

function updateTestCard(testType, testProgress) {
    const card = document.getElementById(`${testType}-card`);
    if (!card) return;
    
    const nextTest = getNextIncompleteTest();
    
    if (testProgress.completed) {
        card.className = 'test-card completed';
        card.querySelector('.test-status').textContent = 'Completed';
        card.querySelector('.test-status').className = 'test-status completed';
    } else if (testType === nextTest) {
        card.className = 'test-card current';
        card.querySelector('.test-status').textContent = 'Ready to Start';
        card.querySelector('.test-status').className = 'test-status current';
    } else {
        card.className = 'test-card';
        card.querySelector('.test-status').textContent = 'Pending';
        card.querySelector('.test-status').className = 'test-status pending';
    }
}

function getNextIncompleteTest() {
    const progress = window.CCPTApp.testFunnelProgress;
    
    if (!progress.ccpt.completed) return 'ccpt';
    if (!progress.nback.completed) return 'nback';
    
    return null; // All tests completed
}

function startNextTest() {
    const nextTest = getNextIncompleteTest();
    
    if (!nextTest) {
        showScreen('final-results');
        return;
    }
    
    if (nextTest === 'ccpt') {
        startCCPTTest();
    } else if (nextTest === 'nback') {
        startNBackTest();
    }
}

// ===== CCPT TEST FLOW =====
function startCCPTTest() {
    AppLogger.debug('🎯 Starting CCPT test flow...');
    
    const config = {
        participantId: window.CCPTApp.currentUser.participantNumber,
        ...window.CCPTApp.testConfigurations.ccpt
    };
    
    window.CCPTApp.ccptEngine = new CCPTTestEngine(config);
    window.CCPTApp.isTestInProgress = true;
    updateNavigationVisibility();
    
    showScreen('ccpt-practice');
}

async function runCCPTPractice() {
    AppLogger.debug('▶️ Running CCPT Practice...');
    
    // Check if user is logged in
    if (!window.CCPTApp.isLoggedIn || !window.CCPTApp.currentUser) {
        console.error('❌ User not logged in');
        showError('Please log in first to start the practice.');
        showScreen('login-screen');
        return;
    }
    
    // Initialize CCPT engine if it doesn't exist
    if (!window.CCPTApp.ccptEngine) {
        AppLogger.debug('🔧 Initializing CCPT engine...');
        
        const config = {
            participantId: window.CCPTApp.currentUser.participantNumber,
            ...window.CCPTApp.testConfigurations.ccpt
        };
        
        try {
            window.CCPTApp.ccptEngine = new CCPTTestEngine(config);
            AppLogger.debug('✅ CCPT Engine initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize CCPT Engine:', error);
            showError('Failed to initialize CCPT test. Please try again.');
            return;
        }
    }
    
    try {
        // Prepare UI for test
        const startBtn = document.querySelector('button[onclick="runCCPTPractice()"]');
        const instructions = document.querySelector('#ccpt-practice .instructions-box');
        const stimulusArea = document.getElementById('ccpt-practice-stimulus-area');
        
        if (startBtn) startBtn.style.display = 'none';
        if (instructions) instructions.style.display = 'none';
        if (stimulusArea) stimulusArea.style.display = 'block';
        
        // Run the practice
        AppLogger.debug('🎯 Starting practice session...');
        const results = await window.CCPTApp.ccptEngine.runPractice();
        AppLogger.debug('✅ CCPT Practice completed:', results);
        
        // Restore UI
        if (stimulusArea) stimulusArea.style.display = 'none';
        if (startBtn) startBtn.style.display = 'inline-block';
        if (instructions) instructions.style.display = 'block';
        
        // Display results
        displayCCPTPracticeResults(results);
        
    } catch (error) {
        console.error('❌ CCPT practice failed:', error);
        showError('CCPT practice failed: ' + error.message);
        
        // Restore UI on error
        const startBtn = document.querySelector('button[onclick="runCCPTPractice()"]');
        const instructions = document.querySelector('#ccpt-practice .instructions-box');
        const stimulusArea = document.getElementById('ccpt-practice-stimulus-area');
        
        if (startBtn) startBtn.style.display = 'inline-block';
        if (instructions) instructions.style.display = 'block';
        if (stimulusArea) stimulusArea.style.display = 'none';
    }
}

async function runCCPTMainTest() {
    AuditLogger.log(AuditLogger.EVENTS.TEST_STARTED, {
        participantId: window.CCPTApp.currentUser.participantNumber,
        testType: 'ccpt',
        sessionGroupId: window.CCPTApp.sessionGroupId
    });
    try {
        showScreen('ccpt-test');
        const results = await window.CCPTApp.ccptEngine.runMainTest();

        const quality = window.QualityAnalyzer ? window.QualityAnalyzer.analyze('ccpt', results, window.CCPTApp.testConfigurations.ccpt) : null;
        await saveTestResults('ccpt', results, quality);
        updateTestFunnelProgress('ccpt', results);

        AuditLogger.log(AuditLogger.EVENTS.TEST_COMPLETED, {
            participantId: window.CCPTApp.currentUser.participantNumber,
            testType: 'ccpt',
            sessionGroupId: window.CCPTApp.sessionGroupId,
            qualityScore: quality ? quality.overallScore : 'unchecked'
        });

        window.CCPTApp.isTestInProgress = false;
        updateNavigationVisibility();

        showScreen('inter-test-rest');

    } catch (error) {
        console.error('❌ CCPT main test failed:', error);
        window.CCPTApp.isTestInProgress = false;
        updateNavigationVisibility();
        showError('CCPT test failed. Please contact the researcher.');
    }
}

// ===== N-BACK TEST FLOW =====
function startNBackTest() {
    AppLogger.debug('🧠 Starting N-Back test flow...');
    
    const config = {
        participantId: window.CCPTApp.currentUser.participantNumber,
        ...window.CCPTApp.testConfigurations.nback
    };
    
    window.CCPTApp.nbackEngine = new NBackTestEngine(config);
    window.CCPTApp.isTestInProgress = true;
    updateNavigationVisibility();
    
    showScreen('nback-practice');
}

// Replace the runNBackPractice() function in public/js/app.js

async function runNBackPractice() {
    AppLogger.debug('▶️ Running N-Back Practice...');
    
    // Check if user is logged in
    if (!window.CCPTApp.isLoggedIn || !window.CCPTApp.currentUser) {
        console.error('❌ User not logged in');
        showError('Please log in first to start the practice.');
        showScreen('login-screen');
        return;
    }
    
    // Initialize N-Back engine if it doesn't exist
    if (!window.CCPTApp.nbackEngine) {
        AppLogger.debug('🔧 Initializing N-Back engine...');
        
        const config = {
            participantId: window.CCPTApp.currentUser.participantNumber,
            ...window.CCPTApp.testConfigurations.nback
        };
        
        try {
            window.CCPTApp.nbackEngine = new NBackTestEngine(config);
            AppLogger.debug('✅ N-Back Engine initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize N-Back Engine:', error);
            showError('Failed to initialize N-Back test. Please try again.');
            return;
        }
    }
    
    try {
        // Prepare UI for test - UPDATED ID HERE
        const startBtn = document.querySelector('button[onclick="runNBackPractice()"]');
        const instructions = document.querySelector('#nback-practice .instructions-box');
        const testArea = document.getElementById('nback-practice-test-area'); // Changed ID
        
        if (startBtn) startBtn.style.display = 'none';
        if (instructions) instructions.style.display = 'none';
        if (testArea) testArea.style.display = 'block';
        
        // Run the practice
        AppLogger.debug('🧠 Starting N-Back practice session...');
        const results = await window.CCPTApp.nbackEngine.runPractice();
        AppLogger.debug('✅ N-Back Practice completed:', results);
        
        // Restore UI
        if (testArea) testArea.style.display = 'none';
        if (startBtn) startBtn.style.display = 'inline-block';
        if (instructions) instructions.style.display = 'block';
        
        // Display results
        displayNBackPracticeResults(results);
        
    } catch (error) {
        console.error('❌ N-Back practice failed:', error);
        showError('N-Back practice failed: ' + error.message);
        
        // Restore UI on error - UPDATED ID HERE
        const startBtn = document.querySelector('button[onclick="runNBackPractice()"]');
        const instructions = document.querySelector('#nback-practice .instructions-box');
        const testArea = document.getElementById('nback-practice-test-area'); // Changed ID
        
        if (startBtn) startBtn.style.display = 'inline-block';
        if (instructions) instructions.style.display = 'block';
        if (testArea) testArea.style.display = 'none';
    }
}


// REPLACE your runNBackMainTest() function in app.js with this:


// ===== COMPLETE FIX FOR N-BACK DISPLAY ISSUES =====
// Add this as the FIRST thing in your runNBackMainTest() function in app.js

async function runNBackMainTest() {
    AppLogger.debug('🚀 Starting N-Back Main Test...');

        // CRITICAL: Force hide loading screen
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
        loadingScreen.classList.add('hidden');
    }
    
    // CRITICAL: Remove any existing overlays first
    AppLogger.debug('🧹 Cleaning up any existing overlays...');
    document.querySelectorAll('.nback-overlay, .test-overlay, [id*="countdown"]').forEach(el => {
        AppLogger.debug('Removing overlay:', el.className, el.id);
        el.remove();
    });
    
    try {
        // Switch to main test screen
        showScreen('nback-test');
        
        // CRITICAL: Make the test area visible with VERY high z-index
        const testArea = document.getElementById('nback-main-test-area');
        if (testArea) {
            testArea.style.display = 'flex';
            testArea.style.flexDirection = 'column';
            testArea.style.alignItems = 'center';
            testArea.style.justifyContent = 'center';
            testArea.style.visibility = 'visible';
            testArea.style.opacity = '1';
            testArea.style.zIndex = '5000'; // VERY high z-index
            testArea.style.position = 'relative';
            AppLogger.debug('✅ Main test area made visible with high z-index');
            AppLogger.debug('Test area computed style:', getComputedStyle(testArea).display, getComputedStyle(testArea).zIndex);
        } else {
            console.error('❌ Could not find nback-main-test-area element');
        }
        
        // Run the main test
        const results = await window.CCPTApp.nbackEngine.runMainTest();

        const quality = window.QualityAnalyzer ? window.QualityAnalyzer.analyze('nback', results, window.CCPTApp.testConfigurations.nback) : null;
        await saveTestResults('nback', results, quality);
        updateTestFunnelProgress('nback', results);

        AuditLogger.log(AuditLogger.EVENTS.TEST_COMPLETED, {
            participantId: window.CCPTApp.currentUser.participantNumber,
            testType: 'nback',
            sessionGroupId: window.CCPTApp.sessionGroupId,
            qualityScore: quality ? quality.overallScore : 'unchecked'
        });

        // Test complete
        window.CCPTApp.isTestInProgress = false;
        updateNavigationVisibility();

        // Show post-session questionnaire before final results
        showScreen('post-session-questionnaire');
        
    } catch (error) {
        console.error('❌ N-Back main test failed:', error);
        window.CCPTApp.isTestInProgress = false;
        updateNavigationVisibility();
        showError('N-Back test failed. Please contact the researcher.');
    }
}

// ===== PRACTICE RESULTS DISPLAY =====
function displayCCPTPracticeResults(results) {
    const resultsContainer = document.getElementById('ccpt-practice-results');
    if (!resultsContainer) {
        console.error('❌ CCPT practice results container not found');
        return;
    }
    
    let performanceLevel, performanceColor, advice;
    
    if (results.accuracy >= 0.8) {
        performanceLevel = 'Excellent!';
        performanceColor = '#28a745';
        advice = 'You\'re ready for the main CCPT test!';
    } else if (results.accuracy >= 0.6) {
        performanceLevel = 'Good!';
        performanceColor = '#ffc107';
        advice = 'Good work! Remember to only respond to targets.';
    } else {
        performanceLevel = 'Keep Practicing';
        performanceColor = '#dc3545';
        advice = `Remember: Only press SPACEBAR for "${window.CCPTApp.testConfigurations.ccpt.target}". Ignore other letters.`;
    }
    
    resultsContainer.innerHTML = `
        <h3>Practice Complete!</h3>
        <div style="text-align: center;">
            <div style="font-size: 24px; color: ${performanceColor}; font-weight: bold; margin-bottom: 20px;">
                ${performanceLevel}
            </div>
            <div class="metric" style="margin: 10px 0;">
                <strong>Accuracy:</strong> ${(results.accuracy * 100).toFixed(1)}%
            </div>
            <div class="metric" style="margin: 10px 0;">
                <strong>Response Time:</strong> ${results.averageRT ? results.averageRT.toFixed(0) + 'ms' : 'N/A'}
            </div>
            <p style="color: #666; margin-top: 15px;">${advice}</p>
        </div>
    `;
    
    resultsContainer.classList.add('show');
    showCCPTMainTestButton();
}

function displayNBackPracticeResults(results) {
    const resultsContainer = document.getElementById('nback-practice-results');
    if (!resultsContainer) {
        console.error('❌ N-Back practice results container not found');
        return;
    }
    
    let performanceLevel, performanceColor, advice;
    
    if (results.accuracy >= 0.7) {
        performanceLevel = 'Excellent!';
        performanceColor = '#28a745';
        advice = 'You\'re ready for the main N-Back test!';
    } else if (results.accuracy >= 0.5) {
        performanceLevel = 'Good!';
        performanceColor = '#ffc107';
        advice = 'Good work! Keep focusing on the sequence.';
    } else {
        performanceLevel = 'Keep Practicing';
        performanceColor = '#dc3545';
        advice = `Try to remember the last ${window.CCPTApp.testConfigurations.nback.nLevel} positions. Press SPACEBAR only when you see a match.`;
    }
    
    resultsContainer.innerHTML = `
        <h3>Practice Complete!</h3>
        <div style="text-align: center;">
            <div class="nback-performance-level" style="color: ${performanceColor};">
                ${performanceLevel}
            </div>
            
            <div class="nback-metrics">
                <div class="nback-metric">
                    <span class="nback-metric-label">Accuracy</span>
                    <span class="nback-metric-value">${(results.accuracy * 100).toFixed(1)}%</span>
                </div>
                <div class="nback-metric">
                    <span class="nback-metric-label">Hit Rate</span>
                    <span class="nback-metric-value">${(results.hitRate * 100).toFixed(1)}%</span>
                </div>
                <div class="nback-metric">
                    <span class="nback-metric-label">Response Time</span>
                    <span class="nback-metric-value">${results.averageRT ? results.averageRT.toFixed(0) + 'ms' : 'N/A'}</span>
                </div>
                <div class="nback-metric">
                    <span class="nback-metric-label">Working Memory</span>
                    <span class="nback-metric-value">${results.workingMemoryCapacity ? results.workingMemoryCapacity.toFixed(2) : 'N/A'}</span>
                </div>
            </div>
            
            <p style="color: #666; margin-top: 20px;">${advice}</p>
        </div>
    `;
    
    resultsContainer.classList.add('show');
    showNBackMainTestButton();
}

// Add after displayNBackPracticeResults() function

function showCCPTMainTestButton() {
    const mainTestBtn = document.getElementById('ccpt-main-test-btn');
    const practiceAgainBtn = document.getElementById('ccpt-practice-again-btn');
    
    if (mainTestBtn) mainTestBtn.classList.add('show');
    if (practiceAgainBtn) practiceAgainBtn.classList.add('show');
}

function showNBackMainTestButton() {
    const mainTestBtn = document.getElementById('nback-main-test-btn');
    const practiceAgainBtn = document.getElementById('nback-practice-again-btn');
    
    if (mainTestBtn) mainTestBtn.classList.add('show');
    if (practiceAgainBtn) practiceAgainBtn.classList.add('show');
}

// ===== FINAL RESULTS =====
function displayFinalResults() {
    const resultsContainer = document.getElementById('final-results-container');
    if (!resultsContainer) return;
    
    const ccptResults = window.CCPTApp.testFunnelProgress.ccpt.results;
    const nbackResults = window.CCPTApp.testFunnelProgress.nback.results;
    
    // Add safety checks
    if (!ccptResults || !nbackResults) {
        resultsContainer.innerHTML = `
            <div class="final-results-summary">
                <h3>⚠️ Results Incomplete</h3>
                <p>Not all tests have been completed yet.</p>
            </div>
        `;
        return;
    }
    
    resultsContainer.innerHTML = `
        <div class="final-results-summary">
            <h3>📊 Test Session Complete</h3>
            <p><strong>Participant:</strong> ${window.CCPTApp.currentUser.participantNumber}</p>
            <p><strong>Study Group:</strong> ${window.CCPTApp.currentUser.studyGroup}</p>
            <p><strong>Completed:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="results-grid">
            <div class="result-card">
                <h4>🎯 CCPT Results</h4>
                <div class="metric">
                    <span class="metric-label">Accuracy:</span>
                    <span class="metric-value">${(ccptResults.accuracy * 100).toFixed(1)}%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">d-prime (d'):</span>
                    <span class="metric-value">${ccptResults.dPrime ? ccptResults.dPrime.toFixed(2) : 'N/A'}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Response Time:</span>
                    <span class="metric-value">${ccptResults.meanRT ? ccptResults.meanRT.toFixed(0) + 'ms' : 'N/A'}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Hits:</span>
                    <span class="metric-value">${ccptResults.hits || 0}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">False Alarms:</span>
                    <span class="metric-value">${ccptResults.falseAlarms || 0}</span>
                </div>
            </div>
            
            <div class="result-card">
                <h4>🧠 N-Back Results</h4>
                <div class="metric">
                    <span class="metric-label">Accuracy:</span>
                    <span class="metric-value">${(nbackResults.accuracy * 100).toFixed(1)}%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Working Memory Capacity:</span>
                    <span class="metric-value">${nbackResults.workingMemoryCapacity ? nbackResults.workingMemoryCapacity.toFixed(2) : 'N/A'}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Response Time:</span>
                    <span class="metric-value">${nbackResults.averageRT ? nbackResults.averageRT.toFixed(0) + 'ms' : 'N/A'}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Hit Rate:</span>
                    <span class="metric-value">${nbackResults.hitRate ? (nbackResults.hitRate * 100).toFixed(1) + '%' : 'N/A'}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">d-prime (d'):</span>
                    <span class="metric-value">${nbackResults.dPrime ? nbackResults.dPrime.toFixed(2) : 'N/A'}</span>
                </div>
            </div>
        </div>
    `;
}

// ===== ADMIN FUNCTIONS =====
async function loadParticipantList() {
    const listContainer = document.getElementById('participant-list');
    if (!listContainer) return;

    listContainer.innerHTML = '<p>Loading...</p>';

    try {
        const participants = await window.AuthSystem.getAllParticipants();

        if (participants.length === 0) {
            listContainer.innerHTML = '<p>No participants found. Add participants via the Firebase console or the form above.</p>';
            return;
        }

        listContainer.innerHTML = participants.map(p => `
            <div class="participant-item ${p.isActive === false ? 'participant-inactive' : ''}">
                <strong>${p.participantNumber}</strong>
                <span class="study-group">${p.studyGroup}</span>
                <span class="participant-sessions">Sessions: ${p.sessionsCompleted || 0}</span>
                <span class="participant-status ${p.isActive === false ? 'status-inactive' : 'status-active'}">
                    ${p.isActive === false ? 'Inactive' : 'Active'}
                </span>
                ${p.isActive !== false ? `<button class="btn-sm btn-danger" onclick="deactivateParticipant('${p.participantNumber}')">Deactivate</button>` : ''}
            </div>
        `).join('');

    } catch (error) {
        AppLogger.error('Failed to load participants:', error);
        listContainer.innerHTML = '<p style="color:#dc3545;">Could not load participants from Firestore.</p>';
    }
}

async function deactivateParticipant(participantNumber) {
    if (!confirm(`Deactivate participant ${participantNumber}? They will not be able to log in.`)) return;
    try {
        await window.AuthSystem.deactivateParticipant(participantNumber);
        AuditLogger.log(AuditLogger.EVENTS.PARTICIPANT_DEACTIVATED, {
            adminId: window.CCPTApp.currentUser.participantNumber,
            targetParticipant: participantNumber
        });
        showSuccess(`${participantNumber} deactivated`);
        loadParticipantList();
    } catch (err) {
        showError(`Failed to deactivate: ${err.message}`);
    }
}

function loadTestConfigurations() {
    // Populate CCPT config form
    const ccptForm = document.getElementById('ccpt-config-form');
    if (ccptForm) {
        const config = window.CCPTApp.testConfigurations.ccpt;
        Object.keys(config).forEach(key => {
            const input = ccptForm.querySelector(`[name="${key}"]`);
            if (input) {
                input.value = config[key];
            }
        });
    }
    
    // Populate N-Back config form
    const nbackForm = document.getElementById('nback-config-form');
    if (nbackForm) {
        const config = window.CCPTApp.testConfigurations.nback;
        Object.keys(config).forEach(key => {
            const input = nbackForm.querySelector(`[name="${key}"]`);
            if (input) {
                input.value = config[key];
            }
        });
    }
}

async function handleAddParticipant(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const participantNumber = formData.get('participantNumber').trim();
    const pin = formData.get('pin').trim();
    const studyGroup = formData.get('studyGroup');

    try {
        await window.AuthSystem.enrollParticipant(participantNumber, pin, studyGroup);
        AuditLogger.log(AuditLogger.EVENTS.PARTICIPANT_ENROLLED, {
            adminId: window.CCPTApp.currentUser.participantNumber,
            newParticipant: participantNumber.toUpperCase(),
            studyGroup
        });
        loadParticipantList();
        e.target.reset();
        showSuccess(`Participant ${participantNumber.toUpperCase()} added to Firestore`);
    } catch (error) {
        showError(`Failed to add participant: ${error.message}`);
    }
}

function handleCCPTConfigUpdate(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const newConfig = {};
    
    for (let [key, value] of formData.entries()) {
        if (['duration', 'stimulusDuration', 'isiDuration', 'targetProbability'].includes(key)) {
            newConfig[key] = parseFloat(value);
        } else if (key === 'nonTargets') {
            newConfig[key] = value.split(',').map(s => s.trim());
        } else {
            newConfig[key] = value;
        }
    }
    
    window.CCPTApp.testConfigurations.ccpt = { ...window.CCPTApp.testConfigurations.ccpt, ...newConfig };
    showSuccess('CCPT configuration updated');
}

function handleNBackConfigUpdate(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const newConfig = {};
    
    for (let [key, value] of formData.entries()) {
        if (['nLevel', 'gridSize', 'stimulusDuration', 'isiDuration', 'totalTrials', 'practiceTrials', 'targetProbability'].includes(key)) {
            newConfig[key] = parseFloat(value);
        } else {
            newConfig[key] = value;
        }
    }
    
    window.CCPTApp.testConfigurations.nback = { ...window.CCPTApp.testConfigurations.nback, ...newConfig };
    showSuccess('N-Back configuration updated');
}

function loadSessionStatistics() {
    const statsContainer = document.getElementById('session-statistics');
    if (!statsContainer) return;

    if (!window.CCPTApp.db) {
        statsContainer.innerHTML = '<p style="color: #dc3545;">Firebase not connected — statistics unavailable</p>';
        return;
    }

    statsContainer.innerHTML = '<p>Loading...</p>';

    window.CCPTApp.db.collection('test_sessions')
        .orderBy('timestamp', 'desc')
        .limit(200)
        .get()
        .then(querySnapshot => {
            const sessions = [];
            querySnapshot.forEach(doc => sessions.push({ id: doc.id, ...doc.data() }));

            // Cache for export
            window.CCPTApp._cachedSessions = sessions;

            const ccpt = sessions.filter(s => s.testType === 'ccpt');
            const nback = sessions.filter(s => s.testType === 'nback');
            const flagged = sessions.filter(s => s.dataQuality && s.dataQuality.overallScore !== 'good');
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
            const recent = sessions.filter(s => {
                const ts = s.timestamp && s.timestamp.toDate ? s.timestamp.toDate() : new Date(s.timestamp);
                return ts >= sevenDaysAgo;
            });

            statsContainer.innerHTML = `
                <div class="stats-grid">
                    <div class="stat-item"><span class="stat-label">Total Sessions (last 200):</span><span class="stat-value">${sessions.length}</span></div>
                    <div class="stat-item"><span class="stat-label">Last 7 Days:</span><span class="stat-value">${recent.length}</span></div>
                    <div class="stat-item"><span class="stat-label">CCPT Sessions:</span><span class="stat-value">${ccpt.length}</span></div>
                    <div class="stat-item"><span class="stat-label">N-Back Sessions:</span><span class="stat-value">${nback.length}</span></div>
                    <div class="stat-item"><span class="stat-label">Flagged Sessions:</span><span class="stat-value ${flagged.length > 0 ? 'stat-warn' : ''}">${flagged.length}</span></div>
                </div>
                <div class="admin-export-section">
                    <h4>Export Data</h4>
                    <div class="form-actions" style="flex-wrap:wrap;gap:8px;">
                        <button class="btn btn-primary" onclick="exportAllSessionsCSV()">Export All Sessions (CSV)</button>
                        <button class="btn btn-secondary" onclick="exportParticipantSummaryCSV()">Participant Summary (CSV)</button>
                    </div>
                    <p class="form-help">For a complete export beyond 200 sessions, use <code>scripts/export-csv.js</code> with a service account key.</p>
                </div>
            `;
        })
        .catch(error => {
            AppLogger.error('Error loading statistics:', error);
            statsContainer.innerHTML = '<p style="color: #dc3545;">Error loading statistics from Firestore</p>';
        });
}

function exportAllSessionsCSV() {
    const sessions = window.CCPTApp._cachedSessions;
    if (!sessions || sessions.length === 0) {
        showError('No session data loaded. Open the Admin Dashboard first.');
        return;
    }
    ExportManager.exportSessionsCSV(sessions, `sessions_all_${new Date().toISOString().slice(0, 10)}.csv`);
    showSuccess(`Exported ${sessions.length} sessions`);
}

function exportParticipantSummaryCSV() {
    const sessions = window.CCPTApp._cachedSessions;
    if (!sessions || sessions.length === 0) {
        showError('No session data loaded. Open the Admin Dashboard first.');
        return;
    }
    ExportManager.exportParticipantSummaryCSV(sessions, `participant_summary_${new Date().toISOString().slice(0, 10)}.csv`);
    showSuccess('Participant summary exported');
}

// ===== DATA MANAGEMENT =====
async function saveTestResults(testType, results, quality = null) {
    AppLogger.debug(`Saving ${testType} results...`);

    const sessionData = {
        participantId: window.CCPTApp.currentUser.participantNumber,
        testType: testType,
        timestamp: new Date(),
        studyGroup: window.CCPTApp.currentUser.studyGroup,
        results: results,
        configuration: window.CCPTApp.testConfigurations[testType],
        sessionGroupId: window.CCPTApp.sessionGroupId || null,
        userAgent: navigator.userAgent,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        dataQuality: quality || null,
        environmentCheckResults: window.CCPTApp.environmentCheckResults || null,
        postSessionResponses: window.CCPTApp.postSessionResponses || null
    };

    // Always save to local storage as backup
    try {
        const existing = JSON.parse(localStorage.getItem('ccpt_test_results') || '[]');
        existing.push({ ...sessionData, timestamp: sessionData.timestamp.toISOString() });
        localStorage.setItem('ccpt_test_results', JSON.stringify(existing));
    } catch (error) {
        console.warn('⚠️ Failed to save to local storage:', error);
    }

    if (!window.CCPTApp.db) {
        console.warn('⚠️ Firebase not available, using local storage only');
        return;
    }

    try {
        await window.CCPTApp.db.collection('test_sessions').add(sessionData);
        AppLogger.debug(`${testType.toUpperCase()} results saved to Firebase`);
    } catch (error) {
        console.warn(`⚠️ Failed to save ${testType} results to Firebase (using local storage):`, error.message);
    }
}

function downloadAllResults() {
    if (!window.CCPTApp.testFunnelProgress.ccpt.completed || 
        !window.CCPTApp.testFunnelProgress.nback.completed) {
        showError('Complete both tests before downloading results');
        return;
    }
    
    const allData = {
        participantId: window.CCPTApp.currentUser.participantNumber,
        studyGroup: window.CCPTApp.currentUser.studyGroup,
        sessionTimestamp: new Date().toISOString(),
        ccptResults: window.CCPTApp.testFunnelProgress.ccpt.results,
        nbackResults: window.CCPTApp.testFunnelProgress.nback.results,
        configurations: window.CCPTApp.testConfigurations
    };
    
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `session_results_${window.CCPTApp.currentUser.participantNumber}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    AppLogger.debug('💾 Complete session results downloaded');
}

// ===== UTILITY FUNCTIONS =====
function showError(message) {
    console.error('❌ Error:', message);
    
    let errorElement = document.getElementById('global-error');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.id = 'global-error';
        errorElement.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 3000;
            max-width: 400px;
            background: #f8d7da;
            color: #721c24;
            padding: 15px 20px;
            border-radius: 8px;
            border: 1px solid #f5c6cb;
            border-left: 4px solid #dc3545;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        document.body.appendChild(errorElement);
    }
    
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}

function showSuccess(message) {
    AppLogger.debug('✅ Success:', message);
    
    let successElement = document.getElementById('global-success');
    if (!successElement) {
        successElement = document.createElement('div');
        successElement.id = 'global-success';
        successElement.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 3000;
            max-width: 400px;
            background: #d4edda;
            color: #155724;
            padding: 15px 20px;
            border-radius: 8px;
            border: 1px solid #c3e6cb;
            border-left: 4px solid #28a745;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        document.body.appendChild(successElement);
    }
    
    successElement.textContent = message;
    successElement.style.display = 'block';
    
    setTimeout(() => {
        successElement.style.display = 'none';
    }, 3000);
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }
}

function updateNavigationVisibility() {
    const userInfo = document.getElementById('user-info');
    
    if (window.CCPTApp.isTestInProgress) {
        if (userInfo) userInfo.style.display = 'none';
    } else {
        if (userInfo) userInfo.style.display = 'block';
    }
}

function endTestEarly() {
    const currentTest = window.CCPTApp.isTestInProgress
        ? (window.CCPTApp.ccptEngine && window.CCPTApp.ccptEngine.isAnySessionRunning() ? 'ccpt' : 'nback')
        : 'unknown';

    AuditLogger.log(AuditLogger.EVENTS.TEST_ABANDONED, {
        participantId: window.CCPTApp.currentUser ? window.CCPTApp.currentUser.participantNumber : 'unknown',
        testType: currentTest,
        sessionGroupId: window.CCPTApp.sessionGroupId
    });

    if (window.CCPTApp.ccptEngine) {
        window.CCPTApp.ccptEngine.stop();
    }
    if (window.CCPTApp.nbackEngine) {
        window.CCPTApp.nbackEngine.stop();
    }

    window.CCPTApp.isTestInProgress = false;
    updateNavigationVisibility();

    showScreen('test-funnel');
}

// ===== INTER-TEST REST SCREEN =====
let _restTimer = null;

function startInterTestRest() {
    let remaining = 60;
    const countdown = document.getElementById('rest-countdown');
    if (!countdown) { startNextTest(); return; }

    countdown.textContent = remaining;

    if (_restTimer) clearInterval(_restTimer);
    _restTimer = setInterval(() => {
        remaining -= 1;
        countdown.textContent = remaining;
        if (remaining <= 0) {
            clearInterval(_restTimer);
            _restTimer = null;
            startNextTest();
        }
    }, 1000);
}

// ===== POST-SESSION QUESTIONNAIRE =====
function setupPostSessionQuestionnaire() {
    const form = document.getElementById('post-session-form');
    if (!form) return;

    // Show/hide detail fields based on Yes/No answers
    ['interrupted', 'technicalIssues'].forEach(name => {
        const detailId = name === 'interrupted' ? 'interrupted-details' : 'technical-details';
        form.querySelectorAll(`[name="${name}"]`).forEach(radio => {
            radio.addEventListener('change', () => {
                const detail = document.getElementById(detailId);
                if (detail) detail.style.display = radio.value === 'yes' ? 'block' : 'none';
            });
        });
    });

    // Remove any stale listener, then attach fresh one
    const fresh = form.cloneNode(true);
    form.parentNode.replaceChild(fresh, form);
    document.getElementById('post-session-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        window.CCPTApp.postSessionResponses = {
            alertness: parseInt(data.alertness) || null,
            comfort: parseInt(data.comfort) || null,
            interrupted: data.interrupted === 'yes',
            interruptedDetails: data.interruptedDetails || '',
            technicalIssues: data.technicalIssues === 'yes',
            technicalDetails: data.technicalDetails || '',
            submittedAt: new Date().toISOString()
        };
        showScreen('final-results');
    });
}

// ===== ENVIRONMENT CHECK — proceed callback =====
function proceedFromEnvironmentCheck() {
    showScreen('test-funnel');
}

// ===== LEGACY COMPATIBILITY =====
function startNewTest() {
    if (!window.CCPTApp.isLoggedIn) {
        showScreen('login-screen');
        return;
    }
    
    resetTestFunnelProgress();
    showScreen('test-funnel');
}

function setupPracticeScreen() {
    setupCCPTPracticeScreen();
}

// ===== DEBUG UTILITIES =====
function debugSystemState() {
    AppLogger.debug('🔍 System Debug Info:');
    AppLogger.debug('- Auth System:', window.AuthSystem);
    AppLogger.debug('- Current User:', window.CCPTApp.currentUser);
    AppLogger.debug('- Is Logged In:', window.CCPTApp.isLoggedIn);
    AppLogger.debug('- CCPT Engine:', window.CCPTApp.ccptEngine);
    AppLogger.debug('- N-Back Engine:', window.CCPTApp.nbackEngine);
    AppLogger.debug('- Test Configurations:', window.CCPTApp.testConfigurations);
    
    if (window.AuthSystem) {
        AppLogger.debug('- Available participants:', Array.from(window.AuthSystem.users.keys()));
    }
}

// Make debug function globally available
window.debugSystemState = debugSystemState;

// ===== INITIALIZATION =====
// initializeApp() is called from the inline script in index.html after DOMContentLoaded.