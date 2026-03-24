// ===== DATA QUALITY ANALYZER =====
// Analyzes test results for data quality issues and returns a structured
// assessment stored alongside session data in Firestore.
//
// Usage:
//   const quality = QualityAnalyzer.analyze('ccpt', results, config);
//   // { flags: string[], overallScore: 'good'|'questionable'|'invalid' }

const QualityAnalyzer = {
    analyze(testType, results, config) {
        if (testType === 'ccpt') return QualityAnalyzer._analyzeCCPT(results, config);
        if (testType === 'nback') return QualityAnalyzer._analyzeNBack(results, config);
        return { flags: [], overallScore: 'good' };
    },

    _analyzeCCPT(r, config) {
        const flags = [];

        // RT_TOO_FAST: >5% of hits have RT < 100ms (likely key bounce or random pressing)
        if (r.trialData && r.hits > 0) {
            const fastHits = r.trialData.filter(t =>
                t.responseType === 'hit' && t.responseTime !== null && t.responseTime < 100
            ).length;
            if (fastHits / r.hits > 0.05) flags.push('RT_TOO_FAST');
        }

        // RT_TOO_SLOW: mean RT > 900ms
        if (r.meanRT !== null && r.meanRT > 900) flags.push('RT_TOO_SLOW');

        // RT_HIGH_VARIANCE: RT standard deviation > 300ms
        if (r.rtStd !== null && r.rtStd > 300) flags.push('RT_HIGH_VARIANCE');

        // NEAR_CHANCE_ACCURACY: d-prime < 0.5
        if (typeof r.dPrime === 'number' && r.dPrime < 0.5) flags.push('NEAR_CHANCE_ACCURACY');

        // ALL_RESPONSES: very high hit rate AND very high false alarm rate
        if (r.hitRate > 0.95 && r.falseAlarmRate > 0.8) flags.push('ALL_RESPONSES');

        // NO_RESPONSES: very low hit rate AND very low false alarm rate
        if (r.hitRate < 0.1 && r.falseAlarmRate < 0.05) flags.push('NO_RESPONSES');

        // HIGH_ISI_RESPONSES: premature response rate > 30%
        if (typeof r.prematureResponseRate === 'number' && r.prematureResponseRate > 0.3) {
            flags.push('HIGH_ISI_RESPONSES');
        }

        // LOW_TRIAL_COUNT: fewer than 80 trials completed (test ended early)
        if (r.completedTrials !== undefined && r.completedTrials < 80) flags.push('LOW_TRIAL_COUNT');

        return {
            flags,
            overallScore: QualityAnalyzer._score(flags),
            analyzedAt: new Date().toISOString()
        };
    },

    _analyzeNBack(r, config) {
        const flags = [];

        // BELOW_CHANCE_NBACK: d-prime < 0 (performing worse than chance)
        if (typeof r.dPrime === 'number' && r.dPrime < 0) flags.push('BELOW_CHANCE_NBACK');

        // RT_TOO_FAST_NBACK: >5% of responses < 150ms
        if (r.trialData && r.trialData.length > 0) {
            const responses = r.trialData.filter(t => t.responded && t.responseTime !== null && t.responseTime < 150);
            if (responses.length / r.trialData.length > 0.05) flags.push('RT_TOO_FAST_NBACK');
        }

        // LOW_TRIAL_COUNT_NBACK
        if (r.totalTrials !== undefined && r.totalTrials < 30) flags.push('LOW_TRIAL_COUNT_NBACK');

        // HIGH_FA_NBACK: false alarm rate > 60%
        if (typeof r.falseAlarmRate === 'number' && r.falseAlarmRate > 0.6) flags.push('HIGH_FA_NBACK');

        // ZERO_HITS_NBACK: participant never responded to a target
        if (typeof r.hitRate === 'number' && r.hitRate === 0) flags.push('ZERO_HITS_NBACK');

        return {
            flags,
            overallScore: QualityAnalyzer._score(flags),
            analyzedAt: new Date().toISOString()
        };
    },

    // Map flag count and severity to an overall score
    _score(flags) {
        const invalidFlags = ['ALL_RESPONSES', 'NO_RESPONSES', 'ZERO_HITS_NBACK', 'BELOW_CHANCE_NBACK'];
        if (flags.some(f => invalidFlags.includes(f))) return 'invalid';
        if (flags.length >= 2) return 'questionable';
        if (flags.length === 1) return 'questionable';
        return 'good';
    }
};

window.QualityAnalyzer = QualityAnalyzer;
