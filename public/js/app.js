// ===== UPDATED APP.JS WITH LOGIN & TEST FUNNEL =====
// Replace the existing app.js with this updated version

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
// ===== REPLACE YOUR initializeApp() FUNCTION WITH THIS =====

function initializeApp() {
    console.log('🚀 Initializing Clinical Trial Application...');
    
    // Hide loading screen
    hideLoadingScreen();
    
    // Initialize Firebase
    initializeFirebase();
    
    // Initialize authentication system - CRITICAL: This was missing!
    if (!window.AuthSystem) {
        window.AuthSystem = new AuthSystem();
        console.log('✅ Authentication system initialized');
    }
    
    // Set up event listeners
    setupEventListeners();
    
    // Show login screen
    showScreen('login-screen');
    
    console.log('✅ Application initialized successfully');
}

function initializeFirebase() {
    // Your Firebase configuration
    const firebaseConfig = {
        apiKey: "AIzaSyCstQjKap6OjGV4_KNWoPW8eG1eWJt9J0E",
        authDomain: "ccpt-test-f3da0.firebaseapp.com",
        projectId: "ccpt-test-f3da0",
        storageBucket: "ccpt-test-f3da0.firebasestorage.app",
        messagingSenderId: "501214918316",
        appId: "1:501214918316:web:b0534507f678d9e804d109"
    };
    
    try {
        firebase.initializeApp(firebaseConfig);
        window.CCPTApp.db = firebase.firestore();
        console.log('✅ Firebase initialized successfully');
    } catch (error) {
        console.error('❌ Firebase initialization failed:', error);
    }
}

// ===== AUTHENTICATION FLOW =====
function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Admin participant management
    const addParticipantForm = document.getElementById('add-participant-form');
    if (addParticipantForm) {
        addParticipantForm.addEventListener('submit', handleAddParticipant);
    }
    
    // Test configuration forms
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

async function handleLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const participantNumber = formData.get('participantNumber').trim();
    const pin = formData.get('pin').trim();
    
    const errorElement = document.getElementById('login-error');
    
    try {
        // Authenticate user
        const user = await window.AuthSystem.authenticate(participantNumber, pin);
        
        // Store current user
        window.CCPTApp.currentUser = user;
        window.CCPTApp.isLoggedIn = true;
        
        // Show user info
        displayUserInfo();
        
        // Navigate based on user type
        if (window.AuthSystem.isAdmin()) {
            showScreen('admin-dashboard');
        } else {
            showScreen('test-funnel');
        }
        
        // Hide error
        errorElement.style.display = 'none';
        
    } catch (error) {
        console.error('❌ Login failed:', error);
        errorElement.textContent = error.message;
        errorElement.style.display = 'block';
    }
}

function displayUserInfo() {
    // Create user info display
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
    window.AuthSystem.logout();
    window.CCPTApp.currentUser = null;
    window.CCPTApp.isLoggedIn = false;
    
    // Reset test progress
    resetTestFunnelProgress();
    
    // Hide user info
    const userInfo = document.getElementById('user-info');
    if (userInfo) {
        userInfo.remove();
    }
    
    // Go back to login
    showScreen('login-screen');
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
    console.log('🎯 Starting CCPT test flow...');
    
    // Set up CCPT configuration
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
    try {
        const results = await window.CCPTApp.ccptEngine.runPractice();
        displayCCPTPracticeResults(results);
    } catch (error) {
        console.error('❌ CCPT practice failed:', error);
        showError('CCPT practice failed. Please try again.');
    }
}

async function runCCPTMainTest() {
    try {
        showScreen('ccpt-test');
        const results = await window.CCPTApp.ccptEngine.runMainTest();
        
        // Save results and update progress
        await saveTestResults('ccpt', results);
        updateTestFunnelProgress('ccpt', results);
        
        window.CCPTApp.isTestInProgress = false;
        updateNavigationVisibility();
        
    } catch (error) {
        console.error('❌ CCPT main test failed:', error);
        window.CCPTApp.isTestInProgress = false;
        updateNavigationVisibility();
        showError('CCPT test failed. Please contact the researcher.');
    }
}

// ===== N-BACK TEST FLOW =====
function startNBackTest() {
    console.log('🧠 Starting N-Back test flow...');
    
    const config = {
        participantId: window.CCPTApp.currentUser.participantNumber,
        ...window.CCPTApp.testConfigurations.nback
    };
    
    window.CCPTApp.nbackEngine = new NBackTestEngine(config);
    window.CCPTApp.isTestInProgress = true;
    updateNavigationVisibility();
    
    showScreen('nback-practice');
}

async function runNBackPractice() {
    try {
        const results = await window.CCPTApp.nbackEngine.runPractice();
        displayNBackPracticeResults(results);
    } catch (error) {
        console.error('❌ N-Back practice failed:', error);
        showError('N-Back practice failed. Please try again.');
    }
}

async function runNBackMainTest() {
    try {
        showScreen('nback-test');
        const results = await window.CCPTApp.nbackEngine.runMainTest();
        
        // Save results and update progress
        await saveTestResults('nback', results);
        updateTestFunnelProgress('nback', results);
        
        window.CCPTApp.isTestInProgress = false;
        updateNavigationVisibility();
        
    } catch (error) {
        console.error('❌ N-Back main test failed:', error);
        window.CCPTApp.isTestInProgress = false;
        updateNavigationVisibility();
        showError('N-Back test failed. Please contact the researcher.');
    }
}

// ===== NAVIGATION & SCREEN MANAGEMENT =====
function showScreen(screenId) {
    // Check authentication requirements
    if (!window.CCPTApp.isLoggedIn && screenId !== 'login-screen') {
        showScreen('login-screen');
        return;
    }
    
    console.log(`📺 Showing screen: ${screenId}`);
    
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
        case 'test-funnel':
            setupTestFunnel();
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

function setupLoginScreen() {
    // Focus on participant number field
    setTimeout(() => {
        const participantField = document.getElementById('participant-number');
        if (participantField) {
            participantField.focus();
        }
    }, 100);
}

function setupTestFunnel() {
    updateTestFunnelDisplay();
}

function updateTestFunnelDisplay() {
    const progress = window.CCPTApp.testFunnelProgress;
    const funnelContainer = document.getElementById('test-funnel-container');
    
    if (!funnelContainer) return;
    
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

// ===== ADMIN FUNCTIONS =====
function setupAdminDashboard() {
    loadParticipantList();
    loadTestConfigurations();
    loadSessionStatistics();
}

function loadParticipantList() {
    try {
        const participants = window.AuthSystem.getAllParticipants();
        const listContainer = document.getElementById('participant-list');
        
        if (!listContainer) return;
        
        listContainer.innerHTML = participants.map(p => `
            <div class="participant-item">
                <strong>${p.participantNumber}</strong>
                <span class="study-group">${p.studyGroup}</span>
                <span class="test-assignment">${p.assignedTests.join(', ')}</span>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('❌ Failed to load participants:', error);
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
        window.AuthSystem.addParticipant(participantNumber, pin, studyGroup);
        loadParticipantList(); // Refresh list
        e.target.reset(); // Clear form
        showSuccess('Participant added successfully');
    } catch (error) {
        showError(`Failed to add participant: ${error.message}`);
    }
}

function handleCCPTConfigUpdate(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const newConfig = {};
    
    for (let [key, value] of formData.entries()) {
        // Convert numeric values
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
        // Convert numeric values
        if (['nLevel', 'gridSize', 'stimulusDuration', 'isiDuration', 'totalTrials', 'practiceTrials', 'targetProbability'].includes(key)) {
            newConfig[key] = parseFloat(value);
        } else {
            newConfig[key] = value;
        }
    }
    
    window.CCPTApp.testConfigurations.nback = { ...window.CCPTApp.testConfigurations.nback, ...newConfig };
    showSuccess('N-Back configuration updated');
}

// ===== PRACTICE RESULTS DISPLAY =====
function displayCCPTPracticeResults(results) {
    const resultsContainer = document.getElementById('ccpt-practice-results');
    if (!resultsContainer) return;
    
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
        <div style="text-align: center;">
            <div style="font-size: 24px; color: ${performanceColor}; font-weight: bold; margin-bottom: 20px;">
                ${performanceLevel}
            </div>
            <div class="metric">
                <strong>Accuracy:</strong> ${(results.accuracy * 100).toFixed(1)}%
            </div>
            <div class="metric">
                <strong>Response Time:</strong> ${results.averageRT ? results.averageRT.toFixed(0) + 'ms' : 'N/A'}
            </div>
            <p style="color: #666; margin-top: 15px;">${advice}</p>
        </div>
    `;
    
    resultsContainer.classList.add('show');
}

function displayNBackPracticeResults(results) {
    const resultsContainer = document.getElementById('nback-practice-results');
    if (!resultsContainer) return;
    
    let performanceLevel, performanceColor, advice;
    
    if (results.accuracy >= 0.7) {
        performanceLevel = 'Excellent!';
        performanceColor = '#28a745';
        advice = 'You\'re ready for the main N-Back test!';
    } else if (results.accuracy >= 0.5) {
        performanceLevel = 'Good!';
        performanceColor = '#ffc107';
        advice = 'Good work! Remember the position from ' + this.config.nLevel + ' steps back.';
    } else {
        performanceLevel = 'Keep Practicing';
        performanceColor = '#dc3545';
        advice = `Remember: Press SPACEBAR only when the current position matches the position from ${window.CCPTApp.testConfigurations.nback.nLevel} steps back.`;
    }
    
    resultsContainer.innerHTML = `
        <div style="text-align: center;">
            <div style="font-size: 24px; color: ${performanceColor}; font-weight: bold; margin-bottom: 20px;">
                ${performanceLevel}
            </div>
            <div class="nback-metrics">
                <div class="nback-metric">
                    <span class="nback-metric-label">Accuracy</span>
                    <span class="nback-metric-value">${(results.accuracy * 100).toFixed(1)}%</span>
                </div>
                <div class="nback-metric">
                    <span class="nback-metric-label">Working Memory Capacity</span>
                    <span class="nback-metric-value">${results.workingMemoryCapacity.toFixed(2)}</span>
                </div>
                <div class="nback-metric">
                    <span class="nback-metric-label">Average Response Time</span>
                    <span class="nback-metric-value">${results.averageRT ? results.averageRT.toFixed(0) + 'ms' : 'N/A'}</span>
                </div>
            </div>
            <p style="color: #666; margin-top: 15px;">${advice}</p>
        </div>
    `;
    
    resultsContainer.classList.add('show');
}

// ===== FINAL RESULTS =====
function displayFinalResults() {
    const resultsContainer = document.getElementById('final-results-container');
    if (!resultsContainer) return;
    
    const ccptResults = window.CCPTApp.testFunnelProgress.ccpt.results;
    const nbackResults = window.CCPTApp.testFunnelProgress.nback.results;
    
    resultsContainer.innerHTML = `
        <div class="final-results-summary">
            <h3>📊 Test Session Complete</h3>
            <p><strong>Participant:</strong> ${window.CCPTApp.currentUser.participantNumber}</p>
            <p><strong>Study Group:</strong> ${window.CCPTApp.currentUser.studyGroup}</p>
            <p><strong>Completed:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="results-grid">
            <div class="result-card">
                <h4>CCPT Results</h4>
                <div class="metric">Accuracy: ${(ccptResults.accuracy * 100).toFixed(1)}%</div>
                <div class="metric">d': ${ccptResults.dPrime.toFixed(2)}</div>
                <div class="metric">Response Time: ${ccptResults.averageRT.toFixed(0)}ms</div>
            </div>
            
            <div class="result-card">
                <h4>N-Back Results</h4>
                <div class="metric">Accuracy: ${(nbackResults.accuracy * 100).toFixed(1)}%</div>
                <div class="metric">Working Memory Capacity: ${nbackResults.workingMemoryCapacity.toFixed(2)}</div>
                <div class="metric">Response Time: ${nbackResults.averageRT ? nbackResults.averageRT.toFixed(0) + 'ms' : 'N/A'}</div>
            </div>
        </div>
    `;
}

// ===== DATA MANAGEMENT =====
async function saveTestResults(testType, results) {
    if (!window.CCPTApp.db) {
        console.warn('⚠️ Firebase not available, data not saved to cloud');
        return;
    }
    
    try {
        const sessionData = {
            participantId: window.CCPTApp.currentUser.participantNumber,
            testType: testType,
            timestamp: new Date(),
            studyGroup: window.CCPTApp.currentUser.studyGroup,
            results: results,
            configuration: window.CCPTApp.testConfigurations[testType],
            userAgent: navigator.userAgent
        };
        
        await window.CCPTApp.db.collection('test_sessions').add(sessionData);
        console.log(`✅ ${testType.toUpperCase()} results saved to Firebase`);
        
    } catch (error) {
        console.error(`❌ Failed to save ${testType} results:`, error);
    }
}

// ===== UTILITY FUNCTIONS =====
function showError(message) {
    // Create or update error display
    let errorElement = document.getElementById('global-error');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.id = 'global-error';
        errorElement.className = 'error-message';
        errorElement.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 3000;
            max-width: 400px;
        `;
        document.body.appendChild(errorElement);
    }
    
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}

function showSuccess(message) {
    // Similar to showError but with success styling
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
            padding: 12px;
            border-radius: 8px;
            border: 1px solid #c3e6cb;
        `;
        document.body.appendChild(successElement);
    }
    
    successElement.textContent = message;
    successElement.style.display = 'block';
    
    setTimeout(() => {
        successElement.style.display = 'none';
    }, 3000);
}

function updateNavigationVisibility() {
    const userInfo = document.getElementById('user-info');
    
    if (window.CCPTApp.isTestInProgress) {
        if (userInfo) userInfo.style.display = 'none';
    } else {
        if (userInfo) userInfo.style.display = 'block';
    }
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }
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

function endTestEarly() {
    // Clean up any running tests
    if (window.CCPTApp.ccptEngine) {
        window.CCPTApp.ccptEngine.forceStop();
    }
    if (window.CCPTApp.nbackEngine) {
        window.CCPTApp.nbackEngine.forceStop();
    }
    
    window.CCPTApp.isTestInProgress = false;
    updateNavigationVisibility();
    
    showScreen('test-funnel');
}

// ===== BACKWARDS COMPATIBILITY =====
// Keep existing functions for current CCPT implementation
function setupPracticeScreen() {
    setupCCPTPracticeScreen();
}

function setupCCPTPracticeScreen() {
    // Setup for CCPT practice
    console.log('🎯 Setting up CCPT practice screen...');
}

function setupNBackPracticeScreen() {
    // Setup for N-Back practice
    console.log('🧠 Setting up N-Back practice screen...');
}

// ===== APP INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});
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
    console.log('💾 Complete session results downloaded');
}

function loadSessionStatistics() {
    const statsContainer = document.getElementById('session-statistics');
    if (!statsContainer) return;
    
    if (!window.CCPTApp.db) {
        statsContainer.innerHTML = '<p style="color: #dc3545;">Firebase not connected</p>';
        return;
    }
    
    // Load basic statistics
    window.CCPTApp.db.collection('test_sessions')
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get()
        .then(querySnapshot => {
            const sessions = [];
            querySnapshot.forEach(doc => {
                sessions.push({ id: doc.id, ...doc.data() });
            });
            
            const totalSessions = querySnapshot.size;
            const ccptSessions = sessions.filter(s => s.testType === 'ccpt').length;
            const nbackSessions = sessions.filter(s => s.testType === 'nback').length;
            
            statsContainer.innerHTML = `
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-label">Recent Sessions:</span>
                        <span class="stat-value">${totalSessions}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">CCPT Sessions:</span>
                        <span class="stat-value">${ccptSessions}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">N-Back Sessions:</span>
                        <span class="stat-value">${nbackSessions}</span>
                    </div>
                </div>
            `;
        })
        .catch(error => {
            console.error('Error loading statistics:', error);
            statsContainer.innerHTML = '<p style="color: #dc3545;">Error loading statistics</p>';
        });
}

// Legacy function compatibility
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

// Legacy function compatibility  
function startNewTest() {
    if (!window.CCPTApp.isLoggedIn) {
        showScreen('login-screen');
        return;
    }
    
    // Reset test progress and go to test funnel
    resetTestFunnelProgress();
    showScreen('test-funnel');
}

// Add these missing practice button functions
function showCCPTMainTestButton() {
    const mainTestBtn = document.getElementById('ccpt-main-test-btn');
    const practiceAgainBtn = document.getElementById('ccpt-practice-again-btn');
    
    if (mainTestBtn) mainTestBtn.style.display = 'block';
    if (practiceAgainBtn) practiceAgainBtn.style.display = 'block';
}

function showNBackMainTestButton() {
    const mainTestBtn = document.getElementById('nback-main-test-btn');
    const practiceAgainBtn = document.getElementById('nback-practice-again-btn');
    
    if (mainTestBtn) mainTestBtn.style.display = 'block';
    if (practiceAgainBtn) practiceAgainBtn.style.display = 'block';
}
// ===== ADD THESE MISSING FUNCTIONS TO END OF APP.JS =====

// Navigation Functions (called by HTML buttons)
function goHome() {
    console.log('🏠 Going home...');
    
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

function showNavigationWarning() {
    const modal = document.getElementById('navigation-warning-modal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeModal() {
    const modal = document.getElementById('navigation-warning-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Initialize the authentication system in the app
function initializeApp() {
    console.log('🚀 Initializing Clinical Trial Application...');
    
    // Hide loading screen
    hideLoadingScreen();
    
    // Initialize Firebase
    initializeFirebase();
    
    // Initialize authentication system - ADD THIS
    if (!window.AuthSystem) {
        window.AuthSystem = new AuthSystem();
    }
    
    // Set up event listeners
    setupEventListeners();
    
    // Show login screen
    showScreen('login-screen');
    
    console.log('✅ Application initialized successfully');
}

// Screen Setup Functions
function setupCCPTPracticeScreen() {
    console.log('🎯 Setting up CCPT practice screen...');
    
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
}

function setupNBackPracticeScreen() {
    console.log('🧠 Setting up N-Back practice screen...');
    
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
}

// Enhanced Practice Results Functions
function displayCCPTPracticeResults(results) {
    const resultsContainer = document.getElementById('ccpt-practice-results');
    if (!resultsContainer) return;
    
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
    
    // Show the main test and practice again buttons
    showCCPTMainTestButton();
}

function displayNBackPracticeResults(results) {
    const resultsContainer = document.getElementById('nback-practice-results');
    if (!resultsContainer) return;
    
    let performanceLevel, performanceColor, advice;
    
    if (results.accuracy >= 0.7) {
        performanceLevel = 'Excellent!';
        performanceColor = '#28a745';
        advice = 'You\'re ready for the main N-Back test!';
    } else if (results.accuracy >= 0.5) {
        performanceLevel = 'Good!';
        performanceColor = '#ffc107';
        advice = `Good work! Remember the position from ${window.CCPTApp.testConfigurations.nback.nLevel} steps back.`;
    } else {
        performanceLevel = 'Keep Practicing';
        performanceColor = '#dc3545';
        advice = `Remember: Press SPACEBAR only when the current position matches the position from ${window.CCPTApp.testConfigurations.nback.nLevel} steps back.`;
    }
    
    resultsContainer.innerHTML = `
        <h3>Practice Complete!</h3>
        <div style="text-align: center;">
            <div style="font-size: 24px; color: ${performanceColor}; font-weight: bold; margin-bottom: 20px;">
                ${performanceLevel}
            </div>
            <div class="nback-metrics">
                <div class="nback-metric">
                    <span class="nback-metric-label">Accuracy</span>
                    <span class="nback-metric-value">${(results.accuracy * 100).toFixed(1)}%</span>
                </div>
                <div class="nback-metric">
                    <span class="nback-metric-label">Working Memory Capacity</span>
                    <span class="nback-metric-value">${results.workingMemoryCapacity.toFixed(2)}</span>
                </div>
                <div class="nback-metric">
                    <span class="nback-metric-label">Average Response Time</span>
                    <span class="nback-metric-value">${results.averageRT ? results.averageRT.toFixed(0) + 'ms' : 'N/A'}</span>
                </div>
            </div>
            <p style="color: #666; margin-top: 15px;">${advice}</p>
        </div>
    `;
    
    resultsContainer.classList.add('show');
    
    // Show the main test and practice again buttons
    showNBackMainTestButton();
}

// ===== ADD THIS CCPT INTEGRATION TO END OF APP.JS =====

// Enhanced CCPT Practice Results Display
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
    
    // Show the main test and practice again buttons
    showCCPTMainTestButton();
}

// CCPT Test Engine Setup
function setupCCPTTestEnvironment() {
    console.log('🎮 Setting up CCPT test environment...');
    
    // Make sure we have the correct stimulus and fixation elements for CCPT
    const stimulusArea = document.getElementById('ccpt-stimulus-area');
    if (stimulusArea) {
        // Set up the stimulus display area for CCPT
        const fixationElement = document.getElementById('ccpt-fixation');
        const stimulusElement = document.getElementById('ccpt-stimulus');
        
        if (fixationElement && stimulusElement) {
            console.log('✅ CCPT stimulus elements found');
        } else {
            console.warn('⚠️ CCPT stimulus elements not found');
        }
    }
}

// Update the runCCPTPractice function to handle errors better
async function runCCPTPractice() {
    console.log('▶️ Running CCPT Practice...');
    
    if (!window.CCPTApp.ccptEngine) {
        console.error('❌ CCPT Engine not initialized');
        showError('CCPT Engine not ready. Please try again.');
        return;
    }
    
    try {
        // Setup test environment first
        setupCCPTTestEnvironment();
        
        // Run the practice
        const results = await window.CCPTApp.ccptEngine.runPractice();
        console.log('✅ CCPT Practice completed:', results);
        
        // Display results
        displayCCPTPracticeResults(results);
        
    } catch (error) {
        console.error('❌ CCPT practice failed:', error);
        showError('CCPT practice failed: ' + error.message);
    }
}

// Debug function to check system state
function debugSystemState() {
    console.log('🔍 System Debug Info:');
    console.log('- Auth System:', window.AuthSystem);
    console.log('- Current User:', window.CCPTApp.currentUser);
    console.log('- Is Logged In:', window.CCPTApp.isLoggedIn);
    console.log('- CCPT Engine:', window.CCPTApp.ccptEngine);
    console.log('- Test Configurations:', window.CCPTApp.testConfigurations);
    
    // Test authentication
    if (window.AuthSystem) {
        console.log('- Available participants:', Array.from(window.AuthSystem.users.keys()));
    }
}

// Call this debug function after login to check everything is working
window.debugSystemState = debugSystemState;