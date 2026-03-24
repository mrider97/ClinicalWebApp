// ===== N-BACK TEST ENGINE =====
// Add this as public/js/nback-test.js

class NBackTestEngine {
    constructor(config) {
        this.config = {
            participantId: config.participantId,
            nLevel: config.nLevel || 2, // 2-back by default
            gridSize: config.gridSize || 3, // 3x3 grid
            stimulusDuration: config.stimulusDuration || 500, // ms
            isiDuration: config.isiDuration || 2500, // ms
            totalTrials: config.totalTrials || 20,
            practiceTrials: config.practiceTrials || 10,
            targetProbability: config.targetProbability || 0.3, // 30% targets
            ...config
        };
        
        this.reset();
        AppLogger.debug('🧠 N-Back Test Engine initialized:', this.config);
    }

    reset() {
    this.isRunning = false;
    this.isPractice = false;
    this.currentTrial = 0;  // Start at 0
    this.trialData = [];
    this.stimulusSequence = [];
    this.startTime = null;
    
    // Grid state
    this.gridPositions = this.generateGridPositions();
    this.stimulusHistory = [];
    
    // DOM elements - clear references
    this.gridElement = null;
    this.counterElement = null;
    this.testArea = null;
    this.activeTimers = new Set();
    this.responseHandler = null;
    
    AppLogger.debug('🔄 N-Back engine reset complete');
}

    // ===== GRID SETUP =====
    generateGridPositions() {
        const positions = [];
        for (let i = 0; i < this.config.gridSize * this.config.gridSize; i++) {
            positions.push({
                id: i,
                row: Math.floor(i / this.config.gridSize),
                col: i % this.config.gridSize
            });
        }
        return positions;
    }

    // Replace the setupTestEnvironment() method in public/js/nback-test.js

setupTestEnvironment() {
    AppLogger.debug('🎮 Setting up N-Back test environment...');
    AppLogger.debug('Current screen:', window.CCPTApp.currentScreen);
    AppLogger.debug('isPractice:', this.isPractice);
    
    // Check which screen we're on and get the appropriate element
    const currentScreen = window.CCPTApp.currentScreen;
    let testArea;
    
    if (currentScreen === 'nback-practice') {
        testArea = document.getElementById('nback-practice-test-area');
        AppLogger.debug('Looking for practice test area...');
    } else if (currentScreen === 'nback-test') {
        testArea = document.getElementById('nback-main-test-area');
        AppLogger.debug('Looking for main test area...');
    } else {
        console.error('❌ Unknown screen:', currentScreen);
    }
    
    AppLogger.debug('🔍 Test area element:', testArea ? '✅ Found' : '❌ Not found');
    
    if (!testArea) {
        console.error('❌ N-Back test area not found in DOM');
        throw new Error('N-Back test area not found.');
    }

    // CRITICAL: Force test area to be visible with VERY high z-index
    testArea.style.display = 'flex';
    testArea.style.flexDirection = 'column';
    testArea.style.alignItems = 'center';
    testArea.style.justifyContent = 'center';
    testArea.style.visibility = 'visible';
    testArea.style.opacity = '1';
    testArea.style.position = 'relative';
    testArea.style.zIndex = '5000';
    testArea.style.backgroundColor = '#f8f9fa';
    testArea.style.minHeight = '600px';
    AppLogger.debug('✅ Test area forced visible with z-index 5000');

    // Clear and setup grid with MAXIMUM visibility
    const totalTrials = this.isPractice ? this.config.practiceTrials : this.config.totalTrials;
    
    testArea.innerHTML = `
        <div class="nback-grid" id="nback-grid" style="
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 12px !important;
            width: 320px !important;
            height: 320px !important;
            margin: 40px auto !important;
            padding: 25px !important;
            background: white !important;
            border: 4px solid #333 !important;
            border-radius: 12px !important;
            box-shadow: 0 8px 24px rgba(0,0,0,0.2) !important;
            visibility: visible !important;
            opacity: 1 !important;
            position: relative !important;
            z-index: 5001 !important;
        ">
            ${this.gridPositions.map(pos => 
                `<div class="grid-cell" data-position="${pos.id}" style="
                    background: #e9ecef !important;
                    border: 3px solid #adb5bd !important;
                    border-radius: 10px !important;
                    min-width: 90px !important;
                    min-height: 90px !important;
                    width: 90px !important;
                    height: 90px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    transition: none !important;
                    cursor: default !important;
                    font-size: 24px !important;
                    font-weight: bold !important;
                    color: transparent !important;
                ">${pos.id + 1}</div>`
            ).join('')}
        </div>
        <div class="nback-instructions" style="text-align: center; margin-top: 30px; visibility: visible; position: relative; z-index: 5001;">
            <p style="font-size: 18px; color: #333; margin-bottom: 20px; font-weight: 600;">
                Press SPACEBAR when position matches ${this.config.nLevel}-back
            </p>
            <div class="trial-counter" id="trial-counter" style="
                font-size: 24px !important;
                font-weight: 800 !important;
                color: #667eea !important;
                padding: 15px 30px !important;
                background: white !important;
                border-radius: 12px !important;
                display: inline-block !important;
                border: 3px solid #667eea !important;
                visibility: visible !important;
                box-shadow: 0 4px 12px rgba(102,126,234,0.2) !important;
            ">Trial: 0/${totalTrials}</div>
        </div>
    `;

    // **CRITICAL FIX: Query within testArea, not globally!**
    this.gridElement = testArea.querySelector('.nback-grid'); // Changed from getElementById
    this.counterElement = testArea.querySelector('.trial-counter'); // Store counter too
    this.testArea = testArea; // Store test area reference
    
    AppLogger.debug('Grid element stored:', this.gridElement ? '✅' : '❌');
    
    if (this.gridElement) {
        const cells = this.gridElement.querySelectorAll('.grid-cell');
        AppLogger.debug(`✅ Found ${cells.length} grid cells in correct test area`);
        AppLogger.debug('Grid z-index:', getComputedStyle(this.gridElement).zIndex);
    }
    
    this.setupResponseHandling();
    AppLogger.debug('✅ N-Back test environment setup complete');

    
    // Debug: Log all elements with high z-index
    setTimeout(() => {
        const allElements = document.querySelectorAll('*');
        const highZIndex = [];
        allElements.forEach(el => {
            const zIndex = parseInt(getComputedStyle(el).zIndex);
            if (zIndex > 1000) {
                highZIndex.push({ element: el.tagName + '.' + el.className, zIndex });
            }
        });
        AppLogger.debug('🔍 Elements with z-index > 1000:', highZIndex);
    }, 100);
}

setupResponseHandling() {
    AppLogger.debug('🎮 Setting up response handling...');
    
    // Remove existing listeners
    if (this.responseHandler) {
        document.removeEventListener('keydown', this.responseHandler);
        AppLogger.debug('🧹 Removed old response handler');
    }

    // Create new response handler
    this.responseHandler = (e) => {
        if (e.code === 'Space' && this.isRunning) {
            e.preventDefault();
            this.recordResponse();
        }
    };

    document.addEventListener('keydown', this.responseHandler);
    AppLogger.debug('✅ Response handler attached');
}

    // ===== SEQUENCE GENERATION =====

// ===== FIXED SEQUENCE GENERATION =====
// Replace the generateSequence method in your nback-test.js file

generateSequence(numTrials, targetProbability) {
    AppLogger.debug(`📝 Generating N-Back sequence: ${numTrials} trials, ${(targetProbability * 100)}% targets`);
    
    const sequence = [];
    const positions = []; // This will store position indices (0-8 for 3x3 grid)
    
    // DO NOT pre-populate positions array! Each trial's position goes in as we generate it

    // Generate remaining trials with target probability control
    for (let trial = 0; trial < numTrials; trial++) {
        let position;
        let isTarget = false;

        if (trial >= this.config.nLevel) {
            // This trial CAN be a target (we have N-back history)
            const nBackPosition = positions[trial - this.config.nLevel];
            const shouldBeTarget = Math.random() < targetProbability;
            
            if (shouldBeTarget) {
                // Make it a target (SAME as N-back position)
                position = nBackPosition;
                isTarget = true;
                AppLogger.debug(`🎯 Trial ${trial + 1}: TARGET at position ${position} (matches trial ${trial + 1 - this.config.nLevel} which was also position ${nBackPosition})`);
            } else {
                // Make it a non-target (DIFFERENT from N-back position)
                // Get all positions except the N-back position
                const availablePositions = [];
                for (let i = 0; i < this.gridPositions.length; i++) {
                    if (i !== nBackPosition) {
                        availablePositions.push(i);
                    }
                }
                
                // Randomly select from available positions
                position = availablePositions[Math.floor(Math.random() * availablePositions.length)];
                isTarget = false;
                AppLogger.debug(`➖ Trial ${trial + 1}: non-target at position ${position} (n-back trial ${trial + 1 - this.config.nLevel} was at position ${nBackPosition})`);
            }
        } else {
            // First N trials CANNOT be targets (no history yet)
            position = Math.floor(Math.random() * this.gridPositions.length);
            isTarget = false;
            AppLogger.debug(`➖ Trial ${trial + 1}: non-target at position ${position} (initial trial - no history)`);
        }

        // Store this position in history
        positions.push(position);
        
        // Add to sequence
        sequence.push({
            trialNumber: trial + 1,
            position: position,
            isTarget: isTarget,
            nBackPosition: trial >= this.config.nLevel ? positions[trial - this.config.nLevel] : null
        });
    }

    const targetCount = sequence.filter(t => t.isTarget).length;
    const actualTargetRate = (targetCount / numTrials * 100).toFixed(1);
    AppLogger.debug(`✅ Generated sequence: ${targetCount} targets (${actualTargetRate}% of ${numTrials} trials)`);
    
    return sequence;
}

    // ===== TEST EXECUTION =====
    async runPractice() {
        AppLogger.debug('🎯 Starting N-Back practice...');
        
        this.isPractice = true;
        this.isRunning = true;
        
        try {
            this.setupTestEnvironment();
            const sequence = this.generateSequence(this.config.practiceTrials, this.config.targetProbability);
            const results = await this.executeTrialSequence(sequence, true);
            
            this.isRunning = false;
            AppLogger.debug('✅ N-Back practice completed');
            return this.analyzePracticeResults(results);
            
        } catch (error) {
            this.isRunning = false;
            console.error('❌ N-Back practice failed:', error);
            throw error;
        }
    }

    async runMainTest() {
    AppLogger.debug('🧪 Starting N-Back main test...');
    
    this.isPractice = false;
    this.isRunning = true;
    this.startTime = performance.now();
    
    try {
        this.setupTestEnvironment();

        // Add countdown before starting
        await this.showCountdown();

        // **NEW: Critical delay and forced DOM refresh after countdown**
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // **NEW: Force browser to repaint by querying grid dimensions**
        const grid = document.getElementById('nback-grid');
        const counter = document.getElementById('trial-counter');
        if (grid) {
            void grid.offsetHeight; // Force reflow
            AppLogger.debug('✅ Grid repaint forced');
        }
        if (counter) {
            void counter.offsetHeight; // Force reflow
            AppLogger.debug('✅ Counter repaint forced');
        }

        const sequence = this.generateSequence(this.config.totalTrials, this.config.targetProbability);
        const results = await this.executeTrialSequence(sequence, false);
        
        this.isRunning = false;
        AppLogger.debug('✅ N-Back main test completed');
        return this.analyzeMainResults(results);
        
    } catch (error) {
        this.isRunning = false;
        console.error('❌ N-Back main test failed:', error);
        throw error;
    }
}

    async executeTrialSequence(sequence, isPractice) {
    AppLogger.debug(`▶️ Executing ${sequence.length} trials (isPractice: ${isPractice})...`);
    
    const trialData = [];
    this.stimulusSequence = sequence;
    
    // Initialize trial counter
    this.currentTrial = 0;
    this.updateTrialCounter();
    
    for (let i = 0; i < sequence.length && this.isRunning; i++) {
        // Update trial number BEFORE executing
        this.currentTrial = i + 1;
        this.updateTrialCounter();
        
        try {
            const trial = sequence[i];
            AppLogger.debug(`\n=== Starting Trial ${this.currentTrial}/${sequence.length} ===`);
            const result = await this.executeSingleTrial(trial, isPractice);
            trialData.push(result);
            
            AppLogger.debug(`=== Completed Trial ${this.currentTrial}/${sequence.length} ===\n`);
            
        } catch (error) {
            console.error(`❌ Trial ${this.currentTrial} failed:`, error);
            // Continue with next trial
        }
    }
    
    AppLogger.debug(`✅ Trial sequence completed: ${trialData.length} trials executed`);
    return trialData;
}

    async executeSingleTrial(trial, isPractice) {
        AppLogger.debug(`🎯 N-Back Trial ${trial.trialNumber}: Position ${trial.position} (target: ${trial.isTarget})`);
        
        const trialStartTime = performance.now();
        const responses = [];
        
        // Clear grid
        this.clearGrid();
        
        // ISI phase
        await this.waitWithResponseMonitoring(this.config.isiDuration, responses, 'isi');
        
        // Stimulus phase
        const stimulusStartTime = performance.now();
        this.showStimulus(trial.position);
        
        await this.waitWithResponseMonitoring(this.config.stimulusDuration, responses, 'stimulus');
        
        this.clearGrid();
        
        // Analyze responses
        const analysis = this.analyzeTrialResponses(responses, trial.isTarget);
        
        return {
            trialNumber: trial.trialNumber,
            position: trial.position,
            isTarget: trial.isTarget,
            nBackPosition: trial.nBackPosition,
            nLevel: this.config.nLevel,
            
            // Response data
            responseMade: analysis.responseMade,
            responseTime: analysis.responseTime,
            responsePhase: analysis.responsePhase,
            
            // Analysis
            correct: analysis.correct,
            responseType: analysis.responseType,
            
            // Timing
            trialDuration: performance.now() - trialStartTime,
            allResponses: responses
        };
    }

// ===== STIMULUS DISPLAY =====
    showStimulus(position) {
    // Query grid from the stored reference (set in setupTestEnvironment)
    if (!this.gridElement) {
        console.error('❌ Grid element reference not stored!');
        return;
    }
    
    const cells = this.gridElement.querySelectorAll('.grid-cell');
    if (!cells || cells.length === 0) {
        console.error('❌ No grid cells found!');
        return;
    }
    
    if (!cells[position]) {
        console.error(`❌ Cell at position ${position} not found!`);
        return;
    }
    
    AppLogger.debug(`💡 Lighting up cell ${position}`);
    
    // Remove active class from all cells first
    cells.forEach(cell => {
        cell.classList.remove('active');
        cell.style.background = '#f8f9fa';
        cell.style.borderColor = '#dee2e6';
        cell.style.transform = 'scale(1)';
        cell.style.boxShadow = 'none';
    });
    
    // Add active class and force MAXIMUM visibility with inline styles
    const targetCell = cells[position];
    targetCell.classList.add('active');
    
    targetCell.style.background = '#667eea';
    targetCell.style.borderColor = '#5a6fd8';
    targetCell.style.transform = 'none';
    targetCell.style.boxShadow = '0 0 40px rgba(102, 126, 234, 0.9)';
    targetCell.style.zIndex = '100';
    targetCell.style.position = 'relative';
    targetCell.style.transition = 'none';
    
    void targetCell.offsetWidth;
    
    AppLogger.debug(`✅ Cell ${position} activated`);
}

clearGrid() {
    if (!this.gridElement) return;
    
    const cells = this.gridElement.querySelectorAll('.grid-cell');
    cells.forEach(cell => {
        cell.classList.remove('active');
        // Force reset all styles to default
        cell.style.background = '#f8f9fa';
        cell.style.borderColor = '#dee2e6';
        cell.style.transform = 'none';
        cell.style.boxShadow = 'none';
    });
}

updateTrialCounter() {
    if (!this.counterElement) {
        console.error('❌ Trial counter element not found!');
        return;
    }
    
    // Determine the total based on current test mode
    const total = this.isPractice ? this.config.practiceTrials : this.config.totalTrials;
    
    // Update the counter text
    const counterText = `Trial: ${this.currentTrial}/${total}`;
    this.counterElement.textContent = counterText;
    
    AppLogger.debug(`📢 Counter updated: ${counterText} (isPractice: ${this.isPractice})`);
}

    // ===== RESPONSE HANDLING =====
    // (your next section continues here)
    // ===== RESPONSE HANDLING =====
    recordResponse() {
        if (!this.isRunning) return;
        
        const timestamp = performance.now();
        const response = {
            timestamp: timestamp,
            relativeTime: this.startTime ? timestamp - this.startTime : 0,
            trial: this.currentTrial
        };
        
        AppLogger.debug('👆 N-Back response recorded:', response);
        
        // Store response for current trial analysis
        if (!this.currentTrialResponses) {
            this.currentTrialResponses = [];
        }
        this.currentTrialResponses.push(response);
    }

    async waitWithResponseMonitoring(duration, responseArray, phase) {
        this.currentTrialResponses = [];
        
        await new Promise(resolve => {
            const timer = setTimeout(() => {
                // Add responses from this phase
                const phaseResponses = this.currentTrialResponses.map(r => ({
                    ...r,
                    phase: phase
                }));
                responseArray.push(...phaseResponses);
                resolve();
            }, duration);
            
            this.activeTimers.add(timer);
        });
    }

    // ===== RESPONSE ANALYSIS =====
    analyzeTrialResponses(responses, isTarget) {
    // Filter responses by phase
    const stimulusResponses = responses.filter(r => r.phase === 'stimulus');
    const isiResponses = responses.filter(r => r.phase === 'isi');
    
    const responseMade = stimulusResponses.length > 0;
    
    let responseTime = null;
    let correct = false;
    let responseType = '';
    let responsePhase = null;
    
    if (responseMade) {
        // Calculate response time correctly - it's the relativeTime of the response within the stimulus phase
        responseTime = stimulusResponses[0].relativeTime;
        responsePhase = 'stimulus';
        
        // Determine if response was correct
        if (isTarget) {
            correct = true;  // Pressed spacebar on a target trial
            responseType = 'hit';
        } else {
            correct = false;  // Pressed spacebar on a non-target trial
            responseType = 'false_alarm';
        }
    } else {
        // No response made
        responsePhase = null;
        
        if (isTarget) {
            correct = false;  // Should have pressed but didn't
            responseType = 'miss';
        } else {
            correct = true;  // Correctly withheld response on non-target
            responseType = 'correct_rejection';
        }
    }
    
    // Log for debugging
    AppLogger.debug(`📊 Trial Analysis: ${responseType} | Target: ${isTarget} | Response: ${responseMade} | Correct: ${correct}`);
    
    return {
        responseMade,
        responseTime,
        responsePhase,
        correct,
        responseType
    };
}

    // ===== RESULTS ANALYSIS =====
    analyzePracticeResults(trialData) {
        const analysis = this.calculatePerformanceMetrics(trialData);
        
        return {
            type: 'nback_practice',
            participantId: this.config.participantId,
            nLevel: this.config.nLevel,
            completed: true,
            trialData: trialData,
            ...analysis
        };
    }

    analyzeMainResults(trialData) {
        const analysis = this.calculatePerformanceMetrics(trialData);
        
        return {
            type: 'nback_main',
            participantId: this.config.participantId,
            nLevel: this.config.nLevel,
            testDuration: (performance.now() - this.startTime) / 1000,
            completed: true,
            trialData: trialData,
            configuration: this.config,
            ...analysis
        };
    }

    calculatePerformanceMetrics(trialData) {
        const targets = trialData.filter(t => t.isTarget);
        const nonTargets = trialData.filter(t => !t.isTarget);
        
        // Basic metrics
        const hits = targets.filter(t => t.responseMade).length;
        const misses = targets.filter(t => !t.responseMade).length;
        const falseAlarms = nonTargets.filter(t => t.responseMade).length;
        const correctRejections = nonTargets.filter(t => !t.responseMade).length;
        
        // Calculate performance measures
        const hitRate = targets.length > 0 ? hits / targets.length : 0;
        const falseAlarmRate = nonTargets.length > 0 ? falseAlarms / nonTargets.length : 0;
        const accuracy = (hits + correctRejections) / trialData.length;
        
        // Calculate d-prime (sensitivity measure)
        const dPrime = this.calculateDPrime(hitRate, falseAlarmRate);
        
        // Response times
        const responseTimes = trialData
            .filter(t => t.responseMade && t.responseTime)
            .map(t => t.responseTime);
        
        const averageRT = responseTimes.length > 0 
            ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
            : null;

        return {
            // Trial counts
            totalTrials: trialData.length,
            targetTrials: targets.length,
            nonTargetTrials: nonTargets.length,
            
            // Response counts
            hits,
            misses,
            falseAlarms,
            correctRejections,
            
            // Performance metrics
            hitRate,
            falseAlarmRate,
            accuracy,
            dPrime,
            
            // Response timing
            averageRT,
            responseTimes,
            
            // Additional metrics for working memory assessment
            workingMemoryCapacity: this.calculateWorkingMemoryCapacity(hitRate, falseAlarmRate, this.config.nLevel)
        };
    }

    calculateDPrime(hitRate, falseAlarmRate) {
        // Adjust for extreme values
        const adjustedHitRate = Math.max(0.001, Math.min(0.999, hitRate));
        const adjustedFalseAlarmRate = Math.max(0.001, Math.min(0.999, falseAlarmRate));
        
        // Calculate z-scores
        const zHit = this.inverseNormalCDF(adjustedHitRate);
        const zFA = this.inverseNormalCDF(adjustedFalseAlarmRate);
        
        return zHit - zFA;
    }

    calculateWorkingMemoryCapacity(hitRate, falseAlarmRate, nLevel) {
        // Simplified working memory capacity estimate based on Cowan's formula
        // K = n * (hit rate + correct rejection rate - 1)
        const correctRejectionRate = 1 - falseAlarmRate;
        const capacity = nLevel * (hitRate + correctRejectionRate - 1);
        return Math.max(0, capacity); // Cannot be negative
    }

    // Approximation of inverse normal CDF for d-prime calculation
    inverseNormalCDF(p) {
        // Beasley-Springer-Moro algorithm approximation
        const a = [0, -3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
        const b = [0, -5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
        const c = [0, -7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
        const d = [0, 7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];

        const pLow = 0.02425;
        const pHigh = 1 - pLow;
        
        if (p < pLow) {
            const q = Math.sqrt(-2 * Math.log(p));
            return (((((c[1] * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) * q + c[6]) / 
                   ((((d[1] * q + d[2]) * q + d[3]) * q + d[4]) * q + 1);
        } else if (p <= pHigh) {
            const q = p - 0.5;
            const r = q * q;
            return (((((a[1] * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * r + a[6]) * q /
                   (((((b[1] * r + b[2]) * r + b[3]) * r + b[4]) * r + b[5]) * r + 1);
        } else {
            const q = Math.sqrt(-2 * Math.log(1 - p));
            return -(((((c[1] * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) * q + c[6]) / 
                    ((((d[1] * q + d[2]) * q + d[3]) * q + d[4]) * q + 1);
        }
    }

    // ===== CLEANUP =====
    cleanup() {
        AppLogger.debug('🧹 Cleaning up N-Back test...');
        
        this.isRunning = false;
        
        // Clear timers
        this.activeTimers.forEach(timer => clearTimeout(timer));
        this.activeTimers.clear();
        
        // Remove event listeners
        if (this.responseHandler) {
            document.removeEventListener('keydown', this.responseHandler);
            this.responseHandler = null;
        }
    }

    // Add this entire section to nback-test.js after cleanup() method

async showCountdown() {
    AppLogger.debug('⏰ Starting N-Back countdown...');
    
    // First, remove ANY existing overlays
    document.querySelectorAll('.nback-overlay, [id*="countdown"]').forEach(el => {
        AppLogger.debug('🧹 Removing existing overlay:', el.id || el.className);
        el.remove();
    });
    
    // Create temporary countdown overlay
    const overlay = document.createElement('div');
    overlay.className = 'nback-overlay';
    overlay.id = 'nback-countdown-overlay-' + Date.now();
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    `;
    overlay.innerHTML = `
        <div class="test-info" style="text-align: center; color: white;">
            <h3 id="nback-countdown-text" style="font-size: 2rem; margin-bottom: 20px;">Test starting in 3...</h3>
            <div class="test-reminder" style="font-size: 1.2rem; opacity: 0.8;">Remember: Press SPACEBAR when position matches ${this.config.nLevel}-back</div>
        </div>
    `;
    document.body.appendChild(overlay);
    AppLogger.debug('✅ Countdown overlay created:', overlay.id);
    
    const countdownText = document.getElementById('nback-countdown-text');
    
    for (let i = 3; i > 0; i--) {
        if (countdownText) countdownText.textContent = `Test starting in ${i}...`;
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (countdownText) {
        countdownText.textContent = 'GO!';
        countdownText.style.color = '#28a745';
    }
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // CRITICAL: Multiple removal attempts with verification
    AppLogger.debug('🧹 Removing countdown overlay...');
    
    // Method 1: Direct removal
    if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
        AppLogger.debug('✅ Overlay removed via parentNode');
    }
    
    // Method 2: Remove by ID
    const overlayById = document.getElementById(overlay.id);
    if (overlayById) {
        overlayById.remove();
        AppLogger.debug('✅ Overlay removed by ID');
    }
    
    // Method 3: Remove all overlays as backup
    document.querySelectorAll('.nback-overlay').forEach(el => {
        el.remove();
        AppLogger.debug('✅ Removed overlay via class selector:', el.id);
    });
    
    // Verification
    const remainingOverlays = document.querySelectorAll('.nback-overlay, [id*="countdown"]');
    if (remainingOverlays.length > 0) {
        console.error('❌ WARNING: Overlays still present:', remainingOverlays);
        remainingOverlays.forEach(el => el.remove());
    } else {
        AppLogger.debug('✅ All overlays confirmed removed');
    }
    
    // **NEW: Force DOM to update and ensure grid is visible**
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // **NEW: Re-verify grid visibility**
    const grid = document.getElementById('nback-grid');
    if (grid) {
        grid.style.visibility = 'visible';
        grid.style.opacity = '1';
        grid.style.display = 'grid';
        // Force reflow
        void grid.offsetHeight;
        AppLogger.debug('✅ Grid visibility forced');
    }
    
    const trialCounter = document.getElementById('trial-counter');
    if (trialCounter) {
        trialCounter.style.visibility = 'visible';
        trialCounter.style.opacity = '1';
        AppLogger.debug('✅ Trial counter visibility forced');
    }
    
    AppLogger.debug('✅ N-Back countdown complete and grid verified');
}}