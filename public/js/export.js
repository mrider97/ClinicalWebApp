// ===== EXPORT MANAGER =====
// Generates CSV exports of research data for use in SPSS, R, Excel, etc.
//
// Because Firestore rules block client reads of test_sessions, these export
// functions work from an in-memory cache populated on the admin dashboard.
// For a full data dump, use the server-side script at /scripts/export-csv.js.

const ExportManager = {
    // Flat CSV: one row per test session.
    // sessions: array of Firestore document data objects.
    exportSessionsCSV(sessions, filename) {
        const headers = [
            'participantId', 'testType', 'sessionDate', 'sessionTime', 'studyGroup',
            'sessionGroupId', 'sessionNumber',
            // CCPT metrics
            'totalTrials', 'hits', 'misses', 'falseAlarms', 'correctRejections',
            'hitRate', 'falseAlarmRate', 'accuracy', 'dPrime', 'bias',
            'meanRT_ms', 'medianRT_ms', 'rtStd_ms',
            'prematureResponseRate', 'totalIsiResponses',
            // N-Back metrics
            'workingMemoryCapacity', 'nLevel', 'averageRT_ms',
            // Quality
            'dataQualityFlags', 'dataQualityScore',
            // Environment
            'screenResolution', 'keyboardPassed', 'timerDeviation_ms',
            // Post-session self-report
            'alertness', 'comfort', 'interrupted', 'technicalIssues',
            // Meta
            'userAgent', 'consentRecorded'
        ];

        const rows = sessions.map(s => {
            const ts = s.timestamp && s.timestamp.toDate ? s.timestamp.toDate() : new Date(s.timestamp);
            const r = s.results || {};
            const q = s.dataQuality || {};
            const env = s.environmentCheckResults || {};
            const ps = s.postSessionResponses || {};

            return [
                s.participantId,
                s.testType,
                ExportManager._dateStr(ts),
                ExportManager._timeStr(ts),
                s.studyGroup,
                s.sessionGroupId || '',
                s.sessionNumber || '',
                // CCPT
                r.totalTrials || r.completedTrials || '',
                r.hits || '',
                r.misses || '',
                r.falseAlarms || '',
                r.correctRejections || '',
                ExportManager._num(r.hitRate),
                ExportManager._num(r.falseAlarmRate),
                ExportManager._num(r.accuracy),
                ExportManager._num(r.dPrime),
                ExportManager._num(r.bias),
                ExportManager._num(r.meanRT),
                ExportManager._num(r.medianRT),
                ExportManager._num(r.rtStd),
                ExportManager._num(r.prematureResponseRate),
                r.totalIsiResponses !== undefined ? r.totalIsiResponses : '',
                // N-Back
                ExportManager._num(r.workingMemoryCapacity),
                r.nLevel || (s.configuration && s.configuration.nLevel) || '',
                ExportManager._num(r.averageRT),
                // Quality
                q.flags ? q.flags.join('|') : '',
                q.overallScore || '',
                // Environment
                s.screenResolution || (env.info && `${env.info.screenWidth}x${env.info.screenHeight}`) || '',
                env.keyboardPassed !== undefined ? (env.keyboardPassed ? 'yes' : 'no') : '',
                env.info && env.info.timerDeviation !== undefined ? env.info.timerDeviation : '',
                // Post-session
                ps.alertness || '',
                ps.comfort || '',
                ps.interrupted !== undefined ? (ps.interrupted ? 'yes' : 'no') : '',
                ps.technicalIssues !== undefined ? (ps.technicalIssues ? 'yes' : 'no') : '',
                // Meta
                ExportManager._csvStr(s.userAgent || ''),
                s.consentRecorded !== undefined ? (s.consentRecorded ? 'yes' : '') : ''
            ];
        });

        ExportManager._downloadCSV(headers, rows, filename || 'sessions_export.csv');

        AuditLogger.log(AuditLogger.EVENTS.DATA_EXPORTED, {
            adminId: window.CCPTApp.currentUser ? window.CCPTApp.currentUser.participantNumber : 'unknown',
            exportType: 'sessions_csv',
            recordCount: sessions.length
        });
    },

    // Participant summary CSV: one row per participant with aggregated metrics.
    exportParticipantSummaryCSV(sessions, filename) {
        const byParticipant = {};
        sessions.forEach(s => {
            const pid = s.participantId;
            if (!byParticipant[pid]) byParticipant[pid] = { pid, sessions: [], studyGroup: s.studyGroup };
            byParticipant[pid].sessions.push(s);
        });

        const headers = [
            'participantId', 'studyGroup',
            'totalSessions', 'ccptSessions', 'nbackSessions',
            'latestSessionDate',
            'ccpt_dPrime_latest', 'ccpt_accuracy_latest', 'ccpt_meanRT_ms_latest',
            'nback_dPrime_latest', 'nback_wmc_latest', 'nback_accuracy_latest',
            'flaggedSessions'
        ];

        const rows = Object.values(byParticipant).map(p => {
            const sorted = p.sessions.sort((a, b) => {
                const ta = a.timestamp && a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
                const tb = b.timestamp && b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
                return tb - ta;
            });
            const latestCCPT = sorted.find(s => s.testType === 'ccpt');
            const latestNBack = sorted.find(s => s.testType === 'nback');
            const latestTs = sorted[0] && (sorted[0].timestamp && sorted[0].timestamp.toDate ? sorted[0].timestamp.toDate() : new Date(sorted[0].timestamp));
            const flagged = p.sessions.filter(s => s.dataQuality && s.dataQuality.overallScore !== 'good').length;

            return [
                p.pid, p.studyGroup,
                p.sessions.length,
                p.sessions.filter(s => s.testType === 'ccpt').length,
                p.sessions.filter(s => s.testType === 'nback').length,
                latestTs ? ExportManager._dateStr(latestTs) : '',
                latestCCPT ? ExportManager._num(latestCCPT.results && latestCCPT.results.dPrime) : '',
                latestCCPT ? ExportManager._num(latestCCPT.results && latestCCPT.results.accuracy) : '',
                latestCCPT ? ExportManager._num(latestCCPT.results && latestCCPT.results.meanRT) : '',
                latestNBack ? ExportManager._num(latestNBack.results && latestNBack.results.dPrime) : '',
                latestNBack ? ExportManager._num(latestNBack.results && latestNBack.results.workingMemoryCapacity) : '',
                latestNBack ? ExportManager._num(latestNBack.results && latestNBack.results.accuracy) : '',
                flagged
            ];
        });

        ExportManager._downloadCSV(headers, rows, filename || 'participant_summary.csv');

        AuditLogger.log(AuditLogger.EVENTS.DATA_EXPORTED, {
            adminId: window.CCPTApp.currentUser ? window.CCPTApp.currentUser.participantNumber : 'unknown',
            exportType: 'participant_summary_csv',
            recordCount: Object.keys(byParticipant).length
        });
    },

    // --- Helpers ---
    _dateStr(d) {
        return d ? d.toISOString().slice(0, 10) : '';
    },
    _timeStr(d) {
        return d ? d.toISOString().slice(11, 19) : '';
    },
    _num(v) {
        if (v === null || v === undefined) return '';
        return typeof v === 'number' ? v : '';
    },
    _csvStr(s) {
        // Wrap strings containing commas, quotes, or newlines in double-quotes
        if (typeof s !== 'string') return s;
        if (s.includes('"') || s.includes(',') || s.includes('\n')) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    },
    _downloadCSV(headers, rows, filename) {
        const lines = [headers.join(',')];
        rows.forEach(row => {
            lines.push(row.map(cell => ExportManager._csvStr(String(cell))).join(','));
        });
        const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};

window.ExportManager = ExportManager;
