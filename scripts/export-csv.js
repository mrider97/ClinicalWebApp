#!/usr/bin/env node
// ===== SERVER-SIDE CSV EXPORT =====
// Exports all test sessions from Firestore to a CSV file using Firebase Admin SDK.
// Run this locally with service account credentials — not in the browser.
//
// Prerequisites:
//   1. Install: npm install firebase-admin
//   2. Download service account key from Firebase console:
//      Project Settings > Service Accounts > Generate new private key
//   3. Run: node scripts/export-csv.js <path-to-service-account.json> [output.csv]
//
// The output CSV has the same column layout as the client-side ExportManager.

const fs = require('fs');
const path = require('path');

const serviceAccountPath = process.argv[2];
const outputFile = process.argv[3] || `sessions_export_${new Date().toISOString().slice(0, 10)}.csv`;

if (!serviceAccountPath) {
    console.error('Usage: node scripts/export-csv.js <service-account.json> [output.csv]');
    process.exit(1);
}

const admin = require('firebase-admin');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const HEADERS = [
    'participantId', 'testType', 'sessionDate', 'sessionTime', 'studyGroup',
    'sessionGroupId', 'sessionNumber',
    'totalTrials', 'hits', 'misses', 'falseAlarms', 'correctRejections',
    'hitRate', 'falseAlarmRate', 'accuracy', 'dPrime', 'bias',
    'meanRT_ms', 'medianRT_ms', 'rtStd_ms',
    'prematureResponseRate', 'totalIsiResponses',
    'workingMemoryCapacity', 'nLevel', 'averageRT_ms',
    'dataQualityFlags', 'dataQualityScore',
    'screenResolution', 'keyboardPassed', 'timerDeviation_ms',
    'alertness', 'comfort', 'interrupted', 'technicalIssues',
    'userAgent'
];

function csvStr(v) {
    const s = String(v === null || v === undefined ? '' : v);
    if (s.includes('"') || s.includes(',') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
    return s;
}

function num(v) { return (v !== null && v !== undefined && typeof v === 'number') ? v : ''; }
function dateStr(d) { return d ? d.toDate ? d.toDate().toISOString().slice(0, 10) : new Date(d).toISOString().slice(0, 10) : ''; }
function timeStr(d) { return d ? d.toDate ? d.toDate().toISOString().slice(11, 19) : new Date(d).toISOString().slice(11, 19) : ''; }

async function main() {
    console.log('Fetching test_sessions from Firestore...');
    const snapshot = await db.collection('test_sessions').orderBy('timestamp', 'desc').get();

    console.log(`Found ${snapshot.size} sessions.`);

    const lines = [HEADERS.join(',')];

    snapshot.forEach(doc => {
        const s = doc.data();
        const r = s.results || {};
        const q = s.dataQuality || {};
        const env = s.environmentCheckResults || {};
        const ps = s.postSessionResponses || {};

        const row = [
            s.participantId,
            s.testType,
            dateStr(s.timestamp),
            timeStr(s.timestamp),
            s.studyGroup,
            s.sessionGroupId || '',
            s.sessionNumber || '',
            r.totalTrials || r.completedTrials || '',
            r.hits || '', r.misses || '', r.falseAlarms || '', r.correctRejections || '',
            num(r.hitRate), num(r.falseAlarmRate), num(r.accuracy), num(r.dPrime), num(r.bias),
            num(r.meanRT), num(r.medianRT), num(r.rtStd),
            num(r.prematureResponseRate), r.totalIsiResponses !== undefined ? r.totalIsiResponses : '',
            num(r.workingMemoryCapacity),
            r.nLevel || (s.configuration && s.configuration.nLevel) || '',
            num(r.averageRT),
            q.flags ? q.flags.join('|') : '', q.overallScore || '',
            s.screenResolution || '',
            env.keyboardPassed !== undefined ? (env.keyboardPassed ? 'yes' : 'no') : '',
            env.info && env.info.timerDeviation !== undefined ? env.info.timerDeviation : '',
            ps.alertness || '', ps.comfort || '',
            ps.interrupted !== undefined ? (ps.interrupted ? 'yes' : 'no') : '',
            ps.technicalIssues !== undefined ? (ps.technicalIssues ? 'yes' : 'no') : '',
            csvStr(s.userAgent || '')
        ];

        lines.push(row.map(csvStr).join(','));
    });

    fs.writeFileSync(outputFile, lines.join('\r\n'), 'utf8');
    console.log(`Exported to: ${path.resolve(outputFile)}`);
    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
