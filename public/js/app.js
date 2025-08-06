// ===== GLOBAL APPLICATION STATE =====
window.CCPTApp = {
    // Current screen and state
    currentScreen: 'home-screen',
    isTestInProgress: false,
    config: null,
    practiceResults: null,
    testResults: null,
    
    // Firebase connection (will be initialized later)
    db: null,
    
    // Test instance
    testEngine: null
};

// ===== INITIALIZATION =====
function initializeApp() {
    console.log('🚀 Initializing CCPT Application...');
    
    // Hide loading screen
    hideLoadingScreen();
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize Firebase (you'll need to add your config)
    initializeFirebase();
    
    // Show home screen
    showScreen('home-screen');
    
    // Set up keyboard shortcuts (for development)
    setupKeyboardShortcuts();
    
    console.log('✅ CCPT Application initialized successfully');
}

// ===== FIREBASE INITIALIZATION =====
function initializeFirebase() {
    // TODO: Replace with your Firebase configuration
// Your actual Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCstQjKap6OjGV4_KNWoPW8eG1eWJt9J0E",
    authDomain: "ccpt-test-f3da0.firebaseapp.com",
    projectId: "ccpt-test-f3da0",
    storageBucket: "ccpt-test-f3da0.firebasestorage.app",
    messagingSenderId: "501214918316",
    appId: "1:501214918316:web:b0534507f678d9e804d109"
    // Note: We're not using measurementId/analytics for this app
};
    
    try {
        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
        window.CCPTApp.db = firebase.firestore();
        console.log('✅ Firebase initialized successfully');
    } catch (error) {
        console.warn('⚠️ Firebase initialization failed:', error);
        // App can still work without Firebase for testing
    }
}

// ===== SCREEN MANAGEMENT =====
function showScreen(screenId) {
    console.log(`📱 Switching to screen: ${screenId}`);
    
    // ENHANCED: Stop ANY running session (practice or main test)
    if (window.CCPTApp.testEngine && window.CCPTApp.testEngine.isAnySessionRunning()) {
        console.log('⏹️ Stopping running session due to screen change');
        window.CCPTApp.testEngine.stop();
        window.CCPTApp.isTestInProgress = false;
        
        // Clear any practice-specific state
        const practiceResults = document.getElementById('practice-results');
        if (practiceResults) {
            practiceResults.classList.remove('show');
        }
        
        // Re-enable practice start button
        const startBtn = document.getElementById('start-practice-btn');
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.textContent = '🎯 Start Practice (15 trials)';
        }
    }
    
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show target screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        window.CCPTApp.currentScreen = screenId;
        updateNavigationVisibility();
        initializeScreen(screenId);
    } else {
        console.error(`❌ Screen not found: ${screenId}`);
    }
}

function initializeScreen(screenId) {
    switch (screenId) {
        case 'home-screen':
            // Nothing special needed
            break;
            
            case 'config-screen':
                // Focus on participant ID field and setup timing preview
                setTimeout(() => {
                    const participantField = document.getElementById('participant-id');
                    if (participantField) participantField.focus();
                    setupTimingPreview(); // Add this line
                }, 100);
                break;
            
        case 'practice-screen':
            setupPracticeScreen();
            break;
            
        case 'test-screen':
            // Test screen will be handled by test engine
            break;
            
        case 'results-screen':
            displayResults();
            break;
            
        case 'admin-screen':
            loadAdminData();
            break;
    }
}

// ===== NAVIGATION FUNCTIONS =====
function goHome() {
    // Check for ANY running session
    const anySessionRunning = window.CCPTApp.isTestInProgress || 
        (window.CCPTApp.testEngine && window.CCPTApp.testEngine.isAnySessionRunning());
        
    if (anySessionRunning) {
        showNavigationWarning();
        return;
    }
    showScreen('home-screen');
}

function goToConfig() {
    showScreen('config-screen');
}

function goToAdmin() {
    showScreen('admin-screen');
}

function startNewTest() {
    // Reset any existing state
    window.CCPTApp.config = null;
    window.CCPTApp.practiceResults = null;
    window.CCPTApp.testResults = null;
    
    showScreen('config-screen');
}

// ===== NAVIGATION CONTROL =====
function updateNavigationVisibility() {
    const navControls = document.getElementById('nav-controls');
    const testWarning = document.getElementById('test-progress-warning');
    
    // Check for ANY running session
    const anySessionRunning = window.CCPTApp.isTestInProgress || 
        (window.CCPTApp.testEngine && window.CCPTApp.testEngine.isAnySessionRunning());
    
    if (anySessionRunning) {
        navControls.classList.add('hidden');
        testWarning.classList.add('show');
    } else {
        navControls.classList.remove('hidden');
        testWarning.classList.remove('show');
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

// ===== CONFIGURATION HANDLING =====
function setupEventListeners() {
    // Configuration form
    const configForm = document.getElementById('config-form');
    if (configForm) {
        configForm.addEventListener('submit', handleConfigSubmit);
    }
    
    // Stimulus type change
    const stimulusType = document.getElementById('stimulus-type');
    if (stimulusType) {
        stimulusType.addEventListener('change', updateStimulusPreview);
    }
    
    // Prevent accidental navigation during test
    window.addEventListener('beforeunload', (e) => {
        if (window.CCPTApp.isTestInProgress) {
            e.preventDefault();
            e.returnValue = 'Test in progress. Are you sure you want to leave?';
            return e.returnValue;
        }
    });
    
    // Keyboard shortcuts for test
    document.addEventListener('keydown', handleGlobalKeypress);
}

function handleConfigSubmit(e) {
    e.preventDefault();
    
    console.log('📝 Processing configuration...');
    
    // Collect form data
    const formData = new FormData(e.target);
    const config = {};
    
    // Convert FormData to object
    for (let [key, value] of formData.entries()) {
        config[key] = value;
    }
    
    // Validate required fields
    if (!config.participantId || config.participantId.trim() === '') {
        showError('Please enter a Participant ID');
        return;
    }
    
    // Process and store configuration
    window.CCPTApp.config = processConfiguration(config);
    
    console.log('✅ Configuration saved:', window.CCPTApp.config);
    
    // Go to practice screen
    showScreen('practice-screen');
}

function processConfiguration(rawConfig) {
    console.log('📝 Processing raw configuration:', rawConfig);
    
    const processed = {
        // Participant info
        participantId: rawConfig.participantId.trim(),
        age: rawConfig.age ? parseInt(rawConfig.age) : null,
        gender: rawConfig.gender,
        condition: rawConfig.condition,
        
        // Test parameters with validation
duration: parseFloat(rawConfig.duration) * 60, // Convert to seconds
targetProbability: parseFloat(rawConfig.targetProbability) / 100, // Convert to decimal
stimulusDuration: (() => {
    const stimDur = parseInt(rawConfig.stimulusDuration);
    if (stimDur < 50 || stimDur > 5000) {
        throw new Error('Stimulus duration must be between 50-5000ms');
    }
    console.log(`⏱️ Stimulus duration: ${stimDur}ms`);
    return stimDur;
})(),
isiDuration: (() => {
    const isiDur = parseFloat(rawConfig.isiDuration) * 1000; // Convert to milliseconds
    if (isiDur < 500 || isiDur > 10000) {
        throw new Error('ISI duration must be between 0.5-10.0 seconds');
    }
    console.log(`⏱️ ISI duration: ${isiDur}ms`);
    return isiDur;
})(),
        
        // Stimulus settings
        stimulusType: rawConfig.stimulusType,
        
        // Generated timestamp
        timestamp: new Date().toISOString()
    };
    
    // Get stimulus sets
    const stimulusSet = getStimulusSet(rawConfig.stimulusType);
    processed.target = stimulusSet.target;
    processed.nonTargets = stimulusSet.nonTargets;
    processed.description = stimulusSet.description;
    
    console.log('✅ Processed configuration:', processed);
    console.log(`🎯 Using stimulus type: "${processed.stimulusType}" with target: "${processed.target}"`);
    
    return processed;
}

function getStimulusSet(type) {
    const stimulusSets = {
        letters: {
            target: 'X',
            nonTargets: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'Y', 'Z'],
            description: 'Press SPACEBAR when you see the letter X'
        },
        numbers: {
            target: '7',
            nonTargets: ['0', '1', '2', '3', '4', '5', '6', '8', '9'],
            description: 'Press SPACEBAR when you see the number 7'
        },
        shapes: {
            target: '●',
            nonTargets: ['○', '□', '■', '△', '▲', '◇', '◆', '☆', '★'],
            description: 'Press SPACEBAR when you see the filled circle ●'
        }
    };
    
    console.log(`🎯 Getting stimulus set for type: "${type}"`);
    const selected = stimulusSets[type] || stimulusSets.letters;
    console.log(`📝 Selected stimulus set:`, selected);
    
    return selected;
}

function updateStimulusPreview() {
    const stimulusTypeSelect = document.getElementById('stimulus-type');
    if (!stimulusTypeSelect) return;
    
    const stimulusType = stimulusTypeSelect.value;
    console.log(`🔄 Updating stimulus preview for: "${stimulusType}"`);
    
    const stimulusSet = getStimulusSet(stimulusType);
    
    // Update preview
    const targetPreview = document.querySelector('.target-preview');
    const nonTargetPreview = document.querySelector('.nontarget-preview');
    
    if (targetPreview) {
        targetPreview.textContent = stimulusSet.target;
        console.log(`📱 Target preview updated to: "${stimulusSet.target}"`);
    }
    
    if (nonTargetPreview) {
        const nonTargetSample = stimulusSet.nonTargets.slice(0, 5).join(', ') + '...';
        nonTargetPreview.textContent = nonTargetSample;
        console.log(`📱 Non-target preview updated to: "${nonTargetSample}"`);
    }
}

// ===== PRACTICE SCREEN =====
function setupPracticeScreen() {
    if (!window.CCPTApp.config) {
        console.error('❌ No configuration found for practice');
        showScreen('config-screen');
        return;
    }
    
    // Update instructions with current target
    const targetDisplay = document.getElementById('target-display');
    const practiceInstructions = document.getElementById('practice-instructions');
    
    if (targetDisplay) {
        targetDisplay.textContent = window.CCPTApp.config.target;
    }
    
    if (practiceInstructions) {
        practiceInstructions.innerHTML = `
            <p><strong>Your Task:</strong></p>
            <p>Press the <kbd>SPACEBAR</kbd> when you see the target stimulus: <span class="target-highlight">${window.CCPTApp.config.target}</span></p>
            <p><strong>Ignore</strong> all other stimuli</p>
            <p>Respond as <strong>quickly</strong> and <strong>accurately</strong> as possible</p>
        `;
    }
    
    // Reset practice results display
    const practiceResults = document.getElementById('practice-results');
    if (practiceResults) {
        practiceResults.classList.remove('show');
    }
}

function startPractice() {
    console.log('🎯 Starting practice session...');
    
    // Enhanced safety check
    if (window.CCPTApp.testEngine && window.CCPTApp.testEngine.isAnySessionRunning()) {
        console.log('⚠️ Session already running, stopping first');
        window.CCPTApp.testEngine.stop();
    }
    
    const startBtn = document.getElementById('start-practice-btn');
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.textContent = 'Practice Running...';
    }
    
    showScreen('test-screen');
    
    setTimeout(() => {
        // Create fresh test engine
        if (window.CCPTApp.testEngine) {
            window.CCPTApp.testEngine.stop();
            window.CCPTApp.testEngine = null;
        }
        
        window.CCPTApp.testEngine = new CCPTTestEngine(window.CCPTApp.config);
        
        window.CCPTApp.testEngine.runPractice()
            .then(results => {
                console.log('✅ Practice completed, returning to practice screen');
                window.CCPTApp.practiceResults = results;
                showScreen('practice-screen');
                displayPracticeResults(results);
            })
            .catch(error => {
                console.error('❌ Practice session failed:', error);
                showScreen('practice-screen');
                showError('Practice session failed. Please try again.');
            })
            .finally(() => {
                if (startBtn) {
                    startBtn.disabled = false;
                    startBtn.textContent = '🎯 Start Practice (15 trials)';
                }
            });
    }, 500);
}

function displayPracticeResults(results) {
    const practiceResults = document.getElementById('practice-results');
    const practiceSummary = document.getElementById('practice-summary');
    
    if (!practiceResults || !practiceSummary) return;
    
    // Calculate performance level
    let performanceLevel, performanceColor, advice;
    
    if (results.accuracy >= 0.8) {
        performanceLevel = 'Excellent!';
        performanceColor = '#28a745';
        advice = 'You\'re ready for the main test!';
    } else if (results.accuracy >= 0.6) {
        performanceLevel = 'Good!';
        performanceColor = '#ffc107';
        advice = 'You\'re getting the hang of it. Remember to only respond to targets.';
    } else {
        performanceLevel = 'Keep Practicing';
        performanceColor = '#dc3545';
        advice = 'Remember: Only press SPACEBAR for the target stimulus. Ignore everything else.';
    }
    
    practiceSummary.innerHTML = `
        <div style="text-align: center; margin: 20px 0;">
            <div style="font-size: 24px; color: ${performanceColor}; font-weight: bold;">${performanceLevel}</div>
            <div style="margin: 15px 0;">
                <strong>Accuracy:</strong> ${(results.accuracy * 100).toFixed(1)}% 
                (${results.correct}/${results.total} correct)
            </div>
            <div style="margin: 15px 0;">
                <strong>Average Response Time:</strong> ${results.averageRT ? results.averageRT.toFixed(0) + 'ms' : 'N/A'}
            </div>
            <p style="color: #666; margin-top: 15px;">${advice}</p>
        </div>
    `;
    
    practiceResults.classList.add('show');
}

// ===== MAIN TEST =====
function startMainTest() {
    console.log('🚀 Starting main test...');
    
    if (!window.CCPTApp.config) {
        console.error('❌ No configuration found for main test');
        showScreen('config-screen');
        return;
    }
    
    // Set test in progress
    window.CCPTApp.isTestInProgress = true;
    updateNavigationVisibility();
    
    // Switch to test screen
    showScreen('test-screen');
    
    // Initialize test engine if needed
    if (!window.CCPTApp.testEngine) {
        window.CCPTApp.testEngine = new CCPTTestEngine(window.CCPTApp.config);
    }
    
    // Run main test
    window.CCPTApp.testEngine.runMainTest()
        .then(results => {
            window.CCPTApp.testResults = results;
            completeTest(results);
        })
        .catch(error => {
            console.error('❌ Main test failed:', error);
            window.CCPTApp.isTestInProgress = false;
            updateNavigationVisibility();
            showError('Test failed. Please contact the researcher.');
        });
}

function completeTest(results) {
    console.log('✅ Test completed successfully');
    
    // Test is no longer in progress
    window.CCPTApp.isTestInProgress = false;
    updateNavigationVisibility();
    
    // Save data to Firebase
    saveTestData(results);
    
    // Show results screen
    showScreen('results-screen');
}

function confirmQuitTest() {
    if (confirm('Are you sure you want to end the test early? This will lose all current data.')) {
        quitTest();
    }
}

function quitTest() {
    console.log('⏹️ Test quit by user');
    
    if (window.CCPTApp.testEngine) {
        window.CCPTApp.testEngine.stop();
    }
    
    window.CCPTApp.isTestInProgress = false;
    updateNavigationVisibility();
    
    showScreen('home-screen');
}

// ===== RESULTS DISPLAY =====
function displayResults() {
    const resultsContainer = document.getElementById('results-container');
    
    if (!window.CCPTApp.testResults || !resultsContainer) {
        console.error('❌ No test results to display');
        return;
    }
    
    const results = window.CCPTApp.testResults;
    
    // Calculate performance level
    let performanceLevel, performanceColor;
    if (results.dPrime >= 2.0) {
        performanceLevel = 'Excellent';
        performanceColor = '#28a745';
    } else if (results.dPrime >= 1.0) {
        performanceLevel = 'Good';
        performanceColor = '#ffc107';
    } else if (results.dPrime >= 0.5) {
        performanceLevel = 'Fair';
        performanceColor = '#fd7e14';
    } else {
        performanceLevel = 'Poor';
        performanceColor = '#dc3545';
    }
    
    resultsContainer.innerHTML = `
        <div class="performance-summary">
            <h3>Overall Performance</h3>
            <div class="performance-level" style="color: ${performanceColor};">${performanceLevel}</div>
            <p>Sensitivity (d'): ${results.dPrime.toFixed(2)}</p>
        </div>
        
        <div class="results-grid">
            <div class="results-card">
                <h3>📊 Accuracy Metrics</h3>
                <div class="metric">
                    <span class="metric-label">Overall Accuracy:</span>
                    <span class="metric-value">${(results.accuracy * 100).toFixed(1)}%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Targets Detected:</span>
                    <span class="metric-value">${results.hits}/${results.totalTargets} (${(results.hitRate * 100).toFixed(1)}%)</span>
                </div>
                <div class="metric">
                    <span class="metric-label">False Alarms:</span>
                    <span class="metric-value">${results.falseAlarms}/${results.totalNonTargets} (${(results.falseAlarmRate * 100).toFixed(1)}%)</span>
                </div>
            </div>
            
            <div class="results-card">
                <h3>⚡ Response Times</h3>
                <div class="metric">
                    <span class="metric-label">Average RT:</span>
                    <span class="metric-value">${results.meanRT ? results.meanRT.toFixed(0) + 'ms' : 'N/A'}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Median RT:</span>
                    <span class="metric-value">${results.medianRT ? results.medianRT.toFixed(0) + 'ms' : 'N/A'}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">RT Variability:</span>
                    <span class="metric-value">${results.rtStd ? results.rtStd.toFixed(0) + 'ms' : 'N/A'}</span>
                </div>
            </div>

            <div class="results-card">
                <h3>⚡ ISI Response Analysis</h3>
                <div class="metric">
                    <span class="metric-label">Premature Responses:</span>
                    <span class="metric-value">${results.totalIsiResponses}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Trials with Premature:</span>
                    <span class="metric-value">${results.trialsWithIsiResponses}/${results.totalTrials}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Premature Rate:</span>
                    <span class="metric-value ${results.prematureResponseRate > 0.1 ? 'warning' : results.prematureResponseRate > 0.2 ? 'poor' : 'good'}">${(results.prematureResponseRate * 100).toFixed(1)}%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Avg Premature/Trial:</span>
                    <span class="metric-value">${results.avgIsiResponsesPerTrial.toFixed(2)}</span>
                </div>
            </div>
            
            <div class="results-card">
                <h3>🧠 Advanced Metrics</h3>
                <div class="metric">
                    <span class="metric-label">Sensitivity (d'):</span>
                    <span class="metric-value ${results.dPrime >= 1.0 ? 'good' : results.dPrime >= 0.5 ? 'warning' : 'poor'}">${results.dPrime.toFixed(2)}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Response Bias:</span>
                    <span class="metric-value">${results.bias.toFixed(2)}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Total Trials:</span>
                    <span class="metric-value">${results.totalTrials}</span>
                </div>
            </div>
        </div>
        
        <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 10px; text-align: center;">
            <p><strong>Test completed on:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Participant ID:</strong> ${window.CCPTApp.config.participantId}</p>
            <p><strong>Duration:</strong> ${(window.CCPTApp.config.duration / 60).toFixed(1)} minutes</p>
        </div>
    `;
}

// ===== DATA MANAGEMENT =====
async function saveTestData(results) {
    if (!window.CCPTApp.db) {
        console.warn('⚠️ Firebase not available, data not saved to cloud');
        return;
    }
    
    try {
        const testData = {
            // Participant and session info
            participantId: window.CCPTApp.config.participantId,
            timestamp: new Date(),
            
            // Configuration
            configuration: window.CCPTApp.config,
            
            // Results
            results: results,
            
            // Practice results if available
            practiceResults: window.CCPTApp.practiceResults,
            
            // Browser/system info
            systemInfo: {
                userAgent: navigator.userAgent,
                screen: {
                    width: screen.width,
                    height: screen.height
                },
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                }
            }
        };
        
        await window.CCPTApp.db.collection('ccpt_sessions').add(testData);
        console.log('✅ Test data saved to Firebase');
        
    } catch (error) {
        console.error('❌ Failed to save test data:', error);
        // Don't show error to user, as local download is still available
    }
}

function downloadResults() {
    if (!window.CCPTApp.testResults) {
        showError('No results available to download');
        return;
    }
    
    const data = {
        participantId: window.CCPTApp.config.participantId,
        timestamp: new Date().toISOString(),
        configuration: window.CCPTApp.config,
        practiceResults: window.CCPTApp.practiceResults,
        testResults: window.CCPTApp.testResults,
        trialData: window.CCPTApp.testEngine ? window.CCPTApp.testEngine.getTrialData() : null
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `ccpt_results_${window.CCPTApp.config.participantId}_${new Date().toISOString().slice(0, 19).replace(':', '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    
    console.log('💾 Results downloaded');
}

// ===== ADMIN FUNCTIONS =====
function loadAdminData() {
    const adminStats = document.getElementById('admin-stats');
    
    if (!window.CCPTApp.db) {
        adminStats.innerHTML = '<p style="color: #dc3545;">Firebase not connected</p>';
        return;
    }
    
    adminStats.innerHTML = '<p>Loading statistics...</p>';
    
    // Load recent session count
    window.CCPTApp.db.collection('ccpt_sessions')
        .where('timestamp', '>', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        .get()
        .then(querySnapshot => {
            const recentSessions = querySnapshot.size;
            adminStats.innerHTML = `
                <div class="metric">
                    <span class="metric-label">Recent Sessions (7 days):</span>
                    <span class="metric-value">${recentSessions}</span>
                </div>
            `;
        })
        .catch(error => {
            console.error('Error loading admin data:', error);
            adminStats.innerHTML = '<p style="color: #dc3545;">Error loading data</p>';
        });
}

function exportAllData() {
    // TODO: Implement data export functionality
    showError('Data export functionality coming soon');
}

function exportRecentData() {
    // TODO: Implement recent data export
    showError('Recent data export functionality coming soon');
}

function clearCache() {
    if ('caches' in window) {
        caches.keys().then(names => {
            names.forEach(name => {
                caches.delete(name);
            });
        });
    }
    
    localStorage.clear();
    sessionStorage.clear();
    
    alert('Cache cleared successfully');
}

function showSystemInfo() {
    const info = {
        userAgent: navigator.userAgent,
        screen: `${screen.width}x${screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        language: navigator.language,
        online: navigator.onLine,
        cookieEnabled: navigator.cookieEnabled
    };
    
    const infoText = Object.entries(info)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
    
    alert(`System Information:\n\n${infoText}`);
}

// ===== UTILITY FUNCTIONS =====
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
    }
}

function showError(message) {
    alert(`❌ Error: ${message}`);
    console.error('Application Error:', message);
}

function setupKeyboardShortcuts() {
    // Development shortcuts (remove in production)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey) {
            switch(e.key) {
                case 'H':
                    e.preventDefault();
                    goHome();
                    break;
                case 'C':
                    e.preventDefault();
                    showScreen('config-screen');
                    break;
                case 'A':
                    e.preventDefault();
                    showScreen('admin-screen');
                    break;
            }
        }
    });
}

function handleGlobalKeypress(e) {
    // Handle escape key to quit test
    if (e.key === 'Escape' && window.CCPTApp.isTestInProgress) {
        confirmQuitTest();
    }
    
    // Prevent common browser shortcuts during test
    if (window.CCPTApp.isTestInProgress) {
        if (e.key === 'F5' || 
            (e.ctrlKey && (e.key === 'r' || e.key === 'R' || e.key === 'w' || e.key === 'W')) ||
            e.key === 'F11') {
            e.preventDefault();
            return false;
        }
    }
}

// ===== TIMING PREVIEW FUNCTIONS =====
function updateTimingPreview() {
    const stimDuration = parseFloat(document.getElementById('stimulus-duration')?.value) || 250;
    const isiDuration = parseFloat(document.getElementById('isi-duration')?.value) || 1.5;
    const targetProb = parseFloat(document.getElementById('target-probability')?.value) || 10;
    
    // Calculate timing metrics
    const trialDuration = (stimDuration / 1000) + isiDuration; // Convert ms to seconds
    const trialsPerMinute = 60 / trialDuration;
    const targetsPerMinute = trialsPerMinute * (targetProb / 100);
    
    // Update display elements
    const trialDurationEl = document.getElementById('trial-duration');
    const trialsPerMinuteEl = document.getElementById('trials-per-minute');
    const targetsPerMinuteEl = document.getElementById('targets-per-minute');
    
    if (trialDurationEl) trialDurationEl.textContent = trialDuration.toFixed(2) + 's';
    if (trialsPerMinuteEl) trialsPerMinuteEl.textContent = trialsPerMinute.toFixed(1);
    if (targetsPerMinuteEl) targetsPerMinuteEl.textContent = targetsPerMinute.toFixed(1);
    
    console.log(`⏱️ Timing preview updated: ${trialDuration.toFixed(2)}s per trial`);
}

function setupTimingPreview() {
    const stimDurationInput = document.getElementById('stimulus-duration');
    const isiDurationInput = document.getElementById('isi-duration');
    const targetProbInput = document.getElementById('target-probability');
    
    if (stimDurationInput) {
        stimDurationInput.addEventListener('input', updateTimingPreview);
        console.log('✅ Stimulus duration input listener added');
    }
    
    if (isiDurationInput) {
        isiDurationInput.addEventListener('input', updateTimingPreview);
        console.log('✅ ISI duration input listener added');
    }
    
    if (targetProbInput) {
        targetProbInput.addEventListener('change', updateTimingPreview);
        console.log('✅ Target probability input listener added');
    }
    
    // Initial preview update
    updateTimingPreview();
    console.log('✅ Timing preview initialized');
}

// ===== INITIALIZE ON LOAD =====
// The app will be initialized when DOM is loaded via the script in HTML 
