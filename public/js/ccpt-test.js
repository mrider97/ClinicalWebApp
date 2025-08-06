// ===== CCPT TEST ENGINE - CLEAN REWRITE =====
// High-fidelity, error-resistant implementation
// Replace entire ccpt-test.js with this code

class CCPTTestEngine {
    constructor(config) {
        this.config = config;
        this.reset();
        
        console.log('🧪 CCPT Test Engine initialized with config:', config);
        this.validateConfig();
    }
    
    // ===== INITIALIZATION & VALIDATION =====
    reset() {
        // State management
        this.isMainTestRunning = false;
        this.isPracticeRunning = false;
        this.currentTrial = 0;
        this.startTime = null;
        
        // Data storage
        this.trialData = [];
        this.stimulusSequence = [];
        
        // DOM elements
        this.stimulusElement = null;
        this.fixationElement = null;
        this.testOverlay = null;
        
        // Timing management
        this.activeTimers = new Set();
        this.activeEventListeners = new Set();
        
        // Response tracking
        this.responseHandler = null;
    }
    
    validateConfig() {
        const required = ['participantId', 'duration', 'stimulusDuration', 'isiDuration', 'target', 'nonTargets'];
        const missing = required.filter(key => this.config[key] === undefined || this.config[key] === null);
        
        if (missing.length > 0) {
            throw new Error(`Missing required config: ${missing.join(', ')}`);
        }
        
        // Validate ranges
        if (this.config.stimulusDuration < 50 || this.config.stimulusDuration > 5000) {
            throw new Error('Stimulus duration must be 50-5000ms');
        }
        
        if (this.config.isiDuration < 500 || this.config.isiDuration > 10000) {
            throw new Error('ISI duration must be 500-10000ms');
        }
        
        console.log('✅ Configuration validated successfully');
    }
    
    // ===== PUBLIC INTERFACE =====
    async runPractice() {
        console.log('🎯 Starting practice session...');
        
        try {
            this.isPracticeRunning = true;
            this.setupTestEnvironment();
            
            const sequence = this.generateSequence(15, 0.4); // 15 trials, 40% targets
            const trialData = await this.executeTrialSequence(sequence, true);
            const results = this.analyzePracticeResults(trialData);
            
            console.log('✅ Practice completed:', results);
            return results;
            
        } catch (error) {
            console.error('❌ Practice session failed:', error);
            throw error;
        } finally {
            this.isPracticeRunning = false;
            this.cleanupTestEnvironment();
        }
    }
    
    async runMainTest() {
        console.log('🚀 Starting main test...');
        
        try {
            this.isMainTestRunning = true;
            this.startTime = performance.now();
            this.setupTestEnvironment();
            
            // Calculate trials from duration
            const trialDuration = (this.config.stimulusDuration + this.config.isiDuration) / 1000;
            const totalTrials = Math.floor(this.config.duration / trialDuration);
            
            const sequence = this.generateSequence(totalTrials, this.config.targetProbability);
            
            // Show countdown before starting
            await this.showCountdown();
            
            const trialData = await this.executeTrialSequence(sequence, false);
            const results = this.analyzeMainResults(trialData);
            
            console.log('✅ Main test completed:', results);
            return results;
            
        } catch (error) {
            console.error('❌ Main test failed:', error);
            throw error;
        } finally {
            this.isMainTestRunning = false;
            this.cleanupTestEnvironment();
        }
    }
    
    stop() {
        console.log('⏹️ Stopping test engine...');
        
        this.isMainTestRunning = false;
        this.isPracticeRunning = false;
        
        this.cleanupTestEnvironment();
        console.log('✅ Test engine fully stopped');
    }
    
    // ===== STATUS METHODS =====
    isTestRunning() {
        return this.isMainTestRunning;
    }
    
    isAnySessionRunning() {
        return this.isMainTestRunning || this.isPracticeRunning;
    }
    
    getTrialData() {
        return [...this.trialData]; // Return copy to prevent external modification
    }
    
    getConfig() {
        return { ...this.config }; // Return copy to prevent external modification
    }
    
    // ===== ENVIRONMENT MANAGEMENT =====
    setupTestEnvironment() {
        // Get DOM elements
        this.stimulusElement = document.getElementById('stimulus');
        this.fixationElement = document.getElementById('fixation');
        this.testOverlay = document.getElementById('test-overlay');
        
        if (!this.stimulusElement || !this.fixationElement) {
            throw new Error('Required DOM elements not found');
        }
        
        // Set up global response handler
        this.setupGlobalResponseHandler();
        
        // Prevent context menu
        const preventContext = (e) => {
            e.preventDefault();
            return false;
        };
        document.addEventListener('contextmenu', preventContext);
        this.activeEventListeners.add({ type: 'contextmenu', handler: preventContext });
        
        // Add test mode styling
        document.body.classList.add('test-mode');
        
        console.log('🎮 Test environment set up');
    }
    
    setupGlobalResponseHandler() {
        // Note: This is just for cleanup tracking
        // Actual response handling is done per-phase in trials
        this.responseHandler = (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                // Response handling is delegated to active trial phases
            }
        };
        
        document.addEventListener('keydown', this.responseHandler);
        this.activeEventListeners.add({ type: 'keydown', handler: this.responseHandler });
    }
    
    cleanupTestEnvironment() {
        // Clear all timers
        this.activeTimers.forEach(timer => clearTimeout(timer));
        this.activeTimers.clear();
        
        // Remove all event listeners
        this.activeEventListeners.forEach(({ type, handler }) => {
            document.removeEventListener(type, handler);
        });
        this.activeEventListeners.clear();
        
        // Reset DOM elements
        if (this.stimulusElement) {
            this.stimulusElement.classList.remove('show', 'target');
            this.stimulusElement.style.color = '';
            this.stimulusElement.style.fontSize = '';
        }
        
        if (this.fixationElement) {
            this.fixationElement.classList.remove('show');
        }
        
        if (this.testOverlay) {
            this.testOverlay.classList.add('hidden');
        }
        
        // Remove test mode styling
        document.body.classList.remove('test-mode');
        
        console.log('🧹 Test environment cleaned up');
    }
    
    // ===== SEQUENCE GENERATION =====
    generateSequence(numTrials, targetProbability) {
        console.log(`📝 Generating sequence: ${numTrials} trials, ${(targetProbability * 100).toFixed(1)}% targets`);
        
        const numTargets = Math.round(numTrials * targetProbability);
        const numNonTargets = numTrials - numTargets;
        const sequence = [];
        
        // Create target trials
        for (let i = 0; i < numTargets; i++) {
            sequence.push({
                stimulus: this.config.target,
                isTarget: true
            });
        }
        
        // Create non-target trials
        for (let i = 0; i < numNonTargets; i++) {
            const randomNonTarget = this.config.nonTargets[
                Math.floor(Math.random() * this.config.nonTargets.length)
            ];
            sequence.push({
                stimulus: randomNonTarget,
                isTarget: false
            });
        }
        
        // Shuffle sequence using Fisher-Yates algorithm
        for (let i = sequence.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [sequence[i], sequence[j]] = [sequence[j], sequence[i]];
        }
        
        // Add trial numbers
        sequence.forEach((trial, index) => {
            trial.trialNumber = index + 1;
        });
        
        console.log(`✅ Sequence generated: ${numTargets} targets, ${numNonTargets} non-targets`);
        return sequence;
    }
    
    // ===== TRIAL EXECUTION =====
    async executeTrialSequence(sequence, isPractice) {
        console.log(`🔄 Executing ${sequence.length} trials (practice: ${isPractice})`);
        
        const trialData = [];
        this.currentTrial = 0;
        
        for (const trial of sequence) {
            // Check if we should continue
            if (!this.shouldContinueExecution(isPractice)) {
                console.log('⏹️ Trial execution stopped');
                break;
            }
            
            this.currentTrial++;
            
            // Progress logging for main test
            if (!isPractice && this.currentTrial % 10 === 0) {
                console.log(`📊 Progress: ${this.currentTrial}/${sequence.length} trials`);
            }
            
            try {
                const result = await this.executeSingleTrial(trial, isPractice);
                trialData.push(result);
                
                // Brief pause between practice trials
                if (isPractice) {
                    await this.sleep(200);
                }
                
            } catch (error) {
                console.error(`❌ Trial ${this.currentTrial} failed:`, error);
                // Continue with next trial rather than failing entire session
            }
        }
        
        console.log(`✅ Trial sequence completed: ${trialData.length} trials executed`);
        return trialData;
    }
    
    shouldContinueExecution(isPractice) {
        if (isPractice) {
            return this.isPracticeRunning;
        } else {
            return this.isMainTestRunning;
        }
    }
    
    async executeSingleTrial(trial, isPractice) {
        console.log(`🎯 Trial ${trial.trialNumber}: ${trial.stimulus} (target: ${trial.isTarget})`);
        
        const trialStartTime = performance.now();
        const responses = [];
        
        // Show fixation cross
        this.showFixation();
        
        // === ISI PHASE ===
        const isiStartTime = performance.now();
        console.log(`⏱️ ISI phase starting (${this.config.isiDuration}ms)`);
        
        const isiResponses = await this.monitorPhaseResponses(
            this.config.isiDuration,
            'isi',
            isiStartTime
        );
        responses.push(...isiResponses);
        
        // === STIMULUS PHASE ===
        const stimulusStartTime = performance.now();
        this.showStimulus(trial.stimulus, trial.isTarget);
        console.log(`📺 Stimulus displayed: ${trial.stimulus}`);
        
        const stimulusResponses = await this.monitorPhaseResponses(
            this.config.stimulusDuration,
            'stimulus',
            stimulusStartTime
        );
        responses.push(...stimulusResponses);
        
        this.hideStimulus();
        this.hideFixation();
        
        // === ANALYZE TRIAL ===
        const analysis = this.analyzeTrialResponses(responses, trial.isTarget);
        
        const trialData = {
            // Basic trial info
            trialNumber: trial.trialNumber,
            stimulus: trial.stimulus,
            isTarget: trial.isTarget,
            
            // Response data
            responseMade: analysis.primaryResponse !== null,
            responseTime: analysis.responseTime,
            responseType: analysis.responseType,
            
            // Enhanced response tracking
            allResponses: responses,
            isiResponses: isiResponses.length,
            stimulusResponses: stimulusResponses.length,
            totalResponses: responses.length,
            
            // Timing data
            trialStartTime: Math.round(trialStartTime - (this.startTime || trialStartTime)),
            isiDuration: this.config.isiDuration,
            stimulusDuration: this.config.stimulusDuration
        };
        
        console.log(`✅ Trial ${trial.trialNumber}: ${analysis.responseType} (RT: ${analysis.responseTime || 'N/A'}ms)`);
        
        // Show practice feedback
        if (isPractice) {
            await this.showPracticeFeedback(analysis);
        }
        
        return trialData;
    }
    
    // ===== RESPONSE MONITORING =====
    async monitorPhaseResponses(duration, phaseName, phaseStartTime) {
        return new Promise((resolve) => {
            const responses = [];
            
            const phaseHandler = (e) => {
                if (e.code === 'Space') {
                    e.preventDefault();
                    
                    const responseTime = performance.now();
                    const relativeTime = Math.round(responseTime - phaseStartTime);
                    
                    responses.push({
                        phase: phaseName,
                        relativeTime: relativeTime,
                        absoluteTime: Math.round(responseTime)
                    });
                    
                    console.log(`📝 Response in ${phaseName}: ${relativeTime}ms`);
                }
            };
            
            // Add phase-specific listener
            document.addEventListener('keydown', phaseHandler);
            
            // Set timer to end phase
            const timer = setTimeout(() => {
                document.removeEventListener('keydown', phaseHandler);
                console.log(`⏱️ ${phaseName} phase complete: ${responses.length} responses`);
                resolve(responses);
            }, duration);
            
            this.activeTimers.add(timer);
        });
    }
    
    analyzeTrialResponses(allResponses, isTarget) {
        const isiResponses = allResponses.filter(r => r.phase === 'isi');
        const stimulusResponses = allResponses.filter(r => r.phase === 'stimulus');
        
        let responseType, primaryResponse = null, responseTime = null;
        
        // Determine response type based on stimulus phase responses
        if (stimulusResponses.length > 0) {
            primaryResponse = stimulusResponses[0];
            responseTime = primaryResponse.relativeTime;
            responseType = isTarget ? 'hit' : 'false_alarm';
        } else {
            responseType = isTarget ? 'miss' : 'correct_rejection';
        }
        
        const hasPrematureResponse = isiResponses.length > 0;
        
        console.log(`📊 Analysis: ${responseType}, ISI: ${isiResponses.length}, Stimulus: ${stimulusResponses.length}`);
        
        return {
            responseType,
            primaryResponse,
            responseTime,
            hasPrematureResponse,
            isiResponseCount: isiResponses.length,
            stimulusResponseCount: stimulusResponses.length
        };
    }
    
    // ===== STIMULUS DISPLAY =====
    showFixation() {
        if (this.fixationElement) {
            this.fixationElement.classList.add('show');
        }
    }
    
    hideFixation() {
        if (this.fixationElement) {
            this.fixationElement.classList.remove('show');
        }
    }
    
    showStimulus(stimulus, isTarget) {
        if (this.stimulusElement) {
            this.stimulusElement.textContent = stimulus;
            this.stimulusElement.classList.add('show');
            
            if (isTarget) {
                this.stimulusElement.classList.add('target');
            } else {
                this.stimulusElement.classList.remove('target');
            }
        }
        this.hideFixation();
    }
    
    hideStimulus() {
        if (this.stimulusElement) {
            this.stimulusElement.classList.remove('show', 'target');
        }
    }
    
    // ===== COUNTDOWN =====
    async showCountdown() {
        console.log('⏰ Starting countdown...');
        
        if (this.testOverlay) {
            this.testOverlay.classList.remove('hidden');
        }
        
        for (let i = 3; i > 0; i--) {
            this.updateOverlayText(`Test starting in ${i}...`);
            await this.sleep(1000);
        }
        
        this.updateOverlayText('GO!', '#28a745');
        await this.sleep(500);
        
        if (this.testOverlay) {
            this.testOverlay.classList.add('hidden');
        }
    }
    
    updateOverlayText(text, color = '#fff') {
        const progressDiv = document.getElementById('test-progress');
        if (progressDiv) {
            progressDiv.textContent = text;
            progressDiv.style.color = color;
        }
    }
    
    // ===== PRACTICE FEEDBACK =====
    async showPracticeFeedback(analysis) {
        let feedbackText, feedbackColor;
        
        if (analysis.hasPrematureResponse) {
            feedbackText = '⚠️ Too early!';
            feedbackColor = '#ff6b35';
        } else {
            switch (analysis.responseType) {
                case 'hit':
                    feedbackText = '✓ Correct!';
                    feedbackColor = '#28a745';
                    break;
                case 'miss':
                    feedbackText = 'Missed target';
                    feedbackColor = '#ffc107';
                    break;
                case 'correct_rejection':
                    feedbackText = '✓ Correct!';
                    feedbackColor = '#28a745';
                    break;
                case 'false_alarm':
                    feedbackText = 'False alarm';
                    feedbackColor = '#fd7e14';
                    break;
                default:
                    feedbackText = '?';
                    feedbackColor = '#6c757d';
            }
        }
        
        if (this.stimulusElement) {
            this.stimulusElement.textContent = feedbackText;
            this.stimulusElement.style.color = feedbackColor;
            this.stimulusElement.style.fontSize = '48px';
            this.stimulusElement.classList.add('show');
        }
        
        await this.sleep(1000);
        
        // Reset stimulus element
        if (this.stimulusElement) {
            this.stimulusElement.style.color = '';
            this.stimulusElement.style.fontSize = '';
            this.stimulusElement.classList.remove('show');
        }
    }
    
    // ===== RESULTS ANALYSIS =====
    analyzePracticeResults(trialData) {
        const hits = trialData.filter(t => t.responseType === 'hit').length;
        const misses = trialData.filter(t => t.responseType === 'miss').length;
        const falseAlarms = trialData.filter(t => t.responseType === 'false_alarm').length;
        const correctRejections = trialData.filter(t => t.responseType === 'correct_rejection').length;
        
        const totalTargets = hits + misses;
        const totalNonTargets = falseAlarms + correctRejections;
        const totalTrials = trialData.length;
        const correct = hits + correctRejections;
        
        // Response time analysis (hits only)
        const hitRTs = trialData
            .filter(t => t.responseType === 'hit' && t.responseTime > 0)
            .map(t => t.responseTime);
        
        const averageRT = hitRTs.length > 0 ?
            Math.round(hitRTs.reduce((a, b) => a + b, 0) / hitRTs.length) : null;
        
        // ISI analysis
        const totalIsiResponses = trialData.reduce((sum, trial) => sum + trial.isiResponses, 0);
        
        return {
            total: totalTrials,
            correct: correct,
            accuracy: correct / totalTrials,
            hits: hits,
            misses: misses,
            falseAlarms: falseAlarms,
            correctRejections: correctRejections,
            hitRate: totalTargets > 0 ? hits / totalTargets : 0,
            falseAlarmRate: totalNonTargets > 0 ? falseAlarms / totalNonTargets : 0,
            averageRT: averageRT,
            totalIsiResponses: totalIsiResponses,
            trialData: trialData
        };
    }
    
    analyzeMainResults(trialData) {
        // Basic response counts
        const hits = trialData.filter(t => t.responseType === 'hit').length;
        const misses = trialData.filter(t => t.responseType === 'miss').length;
        const falseAlarms = trialData.filter(t => t.responseType === 'false_alarm').length;
        const correctRejections = trialData.filter(t => t.responseType === 'correct_rejection').length;
        
        // ISI analysis
        const totalIsiResponses = trialData.reduce((sum, trial) => sum + trial.isiResponses, 0);
        const trialsWithIsiResponses = trialData.filter(t => t.isiResponses > 0).length;
        const prematureResponseRate = trialsWithIsiResponses / trialData.length;
        const avgIsiResponsesPerTrial = totalIsiResponses / trialData.length;
        
        // Basic calculations
        const totalTargets = hits + misses;
        const totalNonTargets = falseAlarms + correctRejections;
        const totalTrials = trialData.length;
        const correct = hits + correctRejections;
        
        // Calculate rates
        const hitRate = totalTargets > 0 ? hits / totalTargets : 0;
        const falseAlarmRate = totalNonTargets > 0 ? falseAlarms / totalNonTargets : 0;
        
        // Signal detection theory metrics
        const hitRateAdj = Math.max(0.01, Math.min(0.99, hitRate));
        const falseAlarmRateAdj = Math.max(0.01, Math.min(0.99, falseAlarmRate));
        
        const dPrime = this.calculateDPrime(hitRateAdj, falseAlarmRateAdj);
        const bias = this.calculateBias(hitRateAdj, falseAlarmRateAdj);
        
        // Response time analysis (hits only)
        const hitRTs = trialData
            .filter(t => t.responseType === 'hit' && t.responseTime > 0)
            .map(t => t.responseTime);
        
        let meanRT = null, medianRT = null, rtStd = null;
        
        if (hitRTs.length > 0) {
            meanRT = Math.round(hitRTs.reduce((a, b) => a + b, 0) / hitRTs.length);
            
            const sortedRTs = [...hitRTs].sort((a, b) => a - b);
            medianRT = Math.round(sortedRTs[Math.floor(sortedRTs.length / 2)]);
            
            if (hitRTs.length > 1) {
                const variance = hitRTs.reduce((acc, rt) => acc + Math.pow(rt - meanRT, 2), 0) / (hitRTs.length - 1);
                rtStd = Math.round(Math.sqrt(variance));
            }
        }
        
        // Store trial data for potential export
        this.trialData = trialData;
        
        return {
            // Basic counts
            totalTrials,
            totalTargets,
            totalNonTargets,
            hits,
            misses,
            falseAlarms,
            correctRejections,
            
            // Performance rates (rounded to 3 decimal places)
            hitRate: Math.round(hitRate * 1000) / 1000,
            falseAlarmRate: Math.round(falseAlarmRate * 1000) / 1000,
            accuracy: Math.round((correct / totalTrials) * 1000) / 1000,
            
            // Signal detection metrics
            dPrime: Math.round(dPrime * 100) / 100,
            bias: Math.round(bias * 100) / 100,
            
            // Response times
            meanRT,
            medianRT,
            rtStd,
            
            // ISI metrics
            totalIsiResponses,
            trialsWithIsiResponses,
            prematureResponseRate: Math.round(prematureResponseRate * 1000) / 1000,
            avgIsiResponsesPerTrial: Math.round(avgIsiResponsesPerTrial * 100) / 100,
            
            // Additional info
            testDuration: this.config.duration,
            completedTrials: totalTrials,
            trialData: trialData
        };
    }
    
    // ===== STATISTICAL CALCULATIONS =====
    calculateDPrime(hitRate, falseAlarmRate) {
        const zScore = (p) => {
            if (p <= 0.01) return -2.33;
            if (p >= 0.99) return 2.33;
            
            // Beasley-Springer-Moro approximation
            const c = [2.515517, 0.802853, 0.010328];
            const d = [1.432788, 0.189269, 0.001308];
            
            const t = Math.sqrt(-2 * Math.log(p <= 0.5 ? p : 1 - p));
            const z = t - ((c[2] * t + c[1]) * t + c[0]) / (((d[2] * t + d[1]) * t + d[0]) * t + 1);
            
            return p <= 0.5 ? -z : z;
        };
        
        return zScore(hitRate) - zScore(falseAlarmRate);
    }
    
    calculateBias(hitRate, falseAlarmRate) {
        const zScore = (p) => {
            if (p <= 0.01) return -2.33;
            if (p >= 0.99) return 2.33;
            
            const c = [2.515517, 0.802853, 0.010328];
            const d = [1.432788, 0.189269, 0.001308];
            
            const t = Math.sqrt(-2 * Math.log(p <= 0.5 ? p : 1 - p));
            const z = t - ((c[2] * t + c[1]) * t + c[0]) / (((d[2] * t + d[1]) * t + d[0]) * t + 1);
            
            return p <= 0.5 ? -z : z;
        };
        
        return -0.5 * (zScore(hitRate) + zScore(falseAlarmRate));
    }
    
    // ===== UTILITY FUNCTIONS =====
    sleep(ms) {
        return new Promise(resolve => {
            const timer = setTimeout(resolve, ms);
            this.activeTimers.add(timer);
        });
    }
}