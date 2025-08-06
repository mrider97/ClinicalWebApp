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
        console.log('🧠 N-Back Test Engine initialized:', this.config);
    }

    reset() {
        this.isRunning = false;
        this.isPractice = false;
        this.currentTrial = 0;
        this.trialData = [];
        this.stimulusSequence = [];
        this.startTime = null;
        
        // Grid state
        this.gridPositions = this.generateGridPositions();
        this.stimulusHistory = []; // Track last N positions for target detection
        
        // DOM elements
        this.gridElement = null;
        this.activeTimers = new Set();
        this.responseHandler = null;
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

    setupTestEnvironment() {
        console.log('🎮 Setting up N-Back test environment...');
        
        // Create grid container
        const testArea = document.getElementById('nback-test-area');
        if (!testArea) {
            throw new Error('N-Back test area not found in DOM');
        }

        // Clear and setup grid
        testArea.innerHTML = `
            <div class="nback-grid" id="nback-grid">
                ${this.gridPositions.map(pos => 
                    `<div class="grid-cell" data-position="${pos.id}"></div>`
                ).join('')}
            </div>
            <div class="nback-instructions">
                <p>Press SPACEBAR when the current position matches the position from ${this.config.nLevel} steps back</p>
                <div class="trial-counter" id="trial-counter">Trial: 0/${this.config.totalTrials}</div>
            </div>
        `;

        this.gridElement = document.getElementById('nback-grid');
        this.setupResponseHandling();
    }

    setupResponseHandling() {
        // Remove existing listeners
        if (this.responseHandler) {
            document.removeEventListener('keydown', this.responseHandler);
        }

        // Create new response handler
        this.responseHandler = (e) => {
            if (e.code === 'Space' && this.isRunning) {
                e.preventDefault();
                this.recordResponse();
            }
        };

        document.addEventListener('keydown', this.responseHandler);
    }

    // ===== SEQUENCE GENERATION =====
    generateSequence(numTrials, targetProbability) {
        console.log(`📝 Generating N-Back sequence: ${numTrials} trials, ${(targetProbability * 100)}% targets`);
        
        const sequence = [];
        const positions = [];
        
        // Generate initial N positions randomly
        for (let i = 0; i < this.config.nLevel; i++) {
            positions.push(Math.floor(Math.random() * this.gridPositions.length));
        }

        // Generate remaining trials with target probability control
        for (let trial = 0; trial < numTrials; trial++) {
            let position;
            let isTarget = false;

            if (trial >= this.config.nLevel) {
                // Decide if this should be a target
                const shouldBeTarget = Math.random() < targetProbability;
                
                if (shouldBeTarget) {
                    // Make it a target (same as N-back position)
                    position = positions[trial - this.config.nLevel];
                    isTarget = true;
                } else {
                    // Make it a non-target (different from N-back position)
                    const nBackPosition = positions[trial - this.config.nLevel];
                    const availablePositions = this.gridPositions
                        .map(p => p.id)
                        .filter(id => id !== nBackPosition);
                    
                    position = availablePositions[Math.floor(Math.random() * availablePositions.length)];
                    isTarget = false;
                }
            } else {
                // First N trials cannot be targets
                position = Math.floor(Math.random() * this.gridPositions.length);
                isTarget = false;
            }

            positions.push(position);
            
            sequence.push({
                trialNumber: trial + 1,
                position: position,
                isTarget: isTarget,
                nBackPosition: trial >= this.config.nLevel ? positions[trial - this.config.nLevel] : null
            });
        }

        console.log(`✅ Generated sequence with ${sequence.filter(t => t.isTarget).length} targets`);
        return sequence;
    }

    // ===== TEST EXECUTION =====
    async runPractice() {
        console.log('🎯 Starting N-Back practice...');
        
        this.isPractice = true;
        this.isRunning = true;
        
        try {
            this.setupTestEnvironment();
            const sequence = this.generateSequence(this.config.practiceTrials, this.config.targetProbability);
            const results = await this.executeTrialSequence(sequence, true);
            
            this.isRunning = false;
            console.log('✅ N-Back practice completed');
            return this.analyzePracticeResults(results);
            
        } catch (error) {
            this.isRunning = false;
            console.error('❌ N-Back practice failed:', error);
            throw error;
        }
    }

    async runMainTest() {
        console.log('🧪 Starting N-Back main test...');
        
        this.isPractice = false;
        this.isRunning = true;
        this.startTime = performance.now();
        
        try {
            this.setupTestEnvironment();
            const sequence = this.generateSequence(this.config.totalTrials, this.config.targetProbability);
            const results = await this.executeTrialSequence(sequence, false);
            
            this.isRunning = false;
            console.log('✅ N-Back main test completed');
            return this.analyzeMainResults(results);
            
        } catch (error) {
            this.isRunning = false;
            console.error('❌ N-Back main test failed:', error);
            throw error;
        }
    }

    async executeTrialSequence(sequence, isPractice) {
        console.log(`▶️ Executing ${sequence.length} N-Back trials...`);
        
        const trialData = [];
        this.stimulusSequence = sequence;
        
        for (let i = 0; i < sequence.length && this.isRunning; i++) {
            this.currentTrial = i + 1;
            
            try {
                const trial = sequence[i];
                const result = await this.executeSingleTrial(trial, isPractice);
                trialData.push(result);
                
                // Update trial counter
                this.updateTrialCounter();
                
            } catch (error) {
                console.error(`❌ Trial ${i + 1} failed:`, error);
                // Continue with next trial
            }
        }
        
        return trialData;
    }

    async executeSingleTrial(trial, isPractice) {
        console.log(`🎯 N-Back Trial ${trial.trialNumber}: Position ${trial.position} (target: ${trial.isTarget})`);
        
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
        const cells = this.gridElement.querySelectorAll('.grid-cell');
        cells[position].classList.add('active');
    }

    clearGrid() {
        const cells = this.gridElement.querySelectorAll('.grid-cell');
        cells.forEach(cell => cell.classList.remove('active'));
    }

    updateTrialCounter() {
        const counter = document.getElementById('trial-counter');
        if (counter) {
            const total = this.isPractice ? this.config.practiceTrials : this.config.totalTrials;
            counter.textContent = `Trial: ${this.currentTrial}/${total}`;
        }
    }

    // ===== RESPONSE HANDLING =====
    recordResponse() {
        if (!this.isRunning) return;
        
        const timestamp = performance.now();
        const response = {
            timestamp: timestamp,
            relativeTime: this.startTime ? timestamp - this.startTime : 0,
            trial: this.currentTrial
        };
        
        console.log('👆 N-Back response recorded:', response);
        
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
        const stimulusResponses = responses.filter(r => r.phase === 'stimulus');
        const responseMade = stimulusResponses.length > 0;
        
        let responseTime = null;
        let correct = false;
        let responseType = '';
        
        if (responseMade) {
            responseTime = stimulusResponses[0].timestamp - (stimulusResponses[0].timestamp - this.config.stimulusDuration);
            
            if (isTarget) {
                correct = true;
                responseType = 'hit';
            } else {
                correct = false;
                responseType = 'false_alarm';
            }
        } else {
            if (isTarget) {
                correct = false;
                responseType = 'miss';
            } else {
                correct = true;
                responseType = 'correct_rejection';
            }
        }
        
        return {
            responseMade,
            responseTime,
            responsePhase: responseMade ? stimulusResponses[0].phase : null,
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
        console.log('🧹 Cleaning up N-Back test...');
        
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

    // ===== PUBLIC INTERFACE =====
    isAnySessionRunning() {
        return this.isRunning;
    }

    getTrialData() {
        return this.trialData;
    }

    forceStop() {
        console.log('🛑 Force stopping N-Back test...');
        this.cleanup();
    }
}