// Cross-device data sync (this desktop app <-> the standalone mobile app)
// via a shared Supabase Edge Function (supabase/functions/sync-data). All
// the merge logic (field-level last-write-wins, delete tombstones) lives in
// that one Edge Function - see its own header comment - so this module's
// job is purely mechanical: build the local payload from data.json, hand it
// to the function, and write back whatever comes back.
//
// Scope is intentionally narrow, per the teacher's own choice: classes/
// students/grades, subjects/grading categories, and periods. WhatsApp
// settings, portfolio, counselors, and weekly-report scheduling stay
// desktop-only and are never sent or touched by a sync.
//
// The pairing code itself is the only thing standing between two devices'
// data reaching each other - same trust model as a license key (see
// licensing.js): a high-entropy value copied once from one device to the
// other, never guessable or listed anywhere.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SYNC_URL = process.env.SYNC_DATA_URL || 'https://gafqxxdjcozkgmkzpjah.supabase.co/functions/v1/sync-data';
const SYNC_CONFIG_FILE = path.join(__dirname, 'sync-config.json');
const DATA_FILE = path.join(__dirname, 'data.json');

function atomicWrite(filePath, data) {
    const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tempPath, data, 'utf8');
    fs.renameSync(tempPath, filePath);
}

function loadConfig() {
    try {
        if (!fs.existsSync(SYNC_CONFIG_FILE)) return { code: null, lastSyncedAt: null };
        return JSON.parse(fs.readFileSync(SYNC_CONFIG_FILE, 'utf8'));
    } catch (e) {
        return { code: null, lastSyncedAt: null };
    }
}

function saveConfig(config) {
    atomicWrite(SYNC_CONFIG_FILE, JSON.stringify(config, null, 2));
}

// 12 URL-safe characters from 9 random bytes - short enough to read back if
// the teacher has to type it instead of copy/pasting, long enough it isn't
// realistically guessable.
function generateCode() {
    return crypto.randomBytes(9).toString('base64url');
}

function status() {
    const config = loadConfig();
    return { code: config.code || null, lastSyncedAt: config.lastSyncedAt || null };
}

// Pairs with a code copied from the other device.
function setCode(code) {
    const trimmed = (code || '').trim();
    if (!trimmed) throw new Error('missing_code');
    const config = loadConfig();
    config.code = trimmed;
    saveConfig(config);
    return status();
}

// Generates a fresh code on this device, to be copied into the other one.
// Overwrites any existing pairing.
function generateNewCode() {
    const config = loadConfig();
    config.code = generateCode();
    saveConfig(config);
    return status();
}

function readData() {
    if (!fs.existsSync(DATA_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
        return {};
    }
}

function num(v) {
    return typeof v === 'number' && isFinite(v) ? v : -1;
}

function buildLocalPayload(data) {
    const classes = (data.classes || []).map(c => ({
        id: c.id,
        name: c.name,
        students: c.students || [],
        rosterUpdatedAt: num(c.rosterUpdatedAt),
        attendance: c.attendance || {},
        attendanceUpdatedAt: num(c.attendanceUpdatedAt),
        groups: c.groups || [],
        groupsUpdatedAt: num(c.groupsUpdatedAt)
    }));
    const subjects = (data.subjects || []).map(s => ({
        id: s.id,
        name: s.name,
        gradingCategories: s.gradingCategories || [],
        updatedAt: num(s.updatedAt)
    }));
    return {
        classes,
        deletedClassIds: data.deletedClassIds || {},
        subjects,
        deletedSubjectIds: data.deletedSubjectIds || {},
        meta: {
            updatedAt: num(data.metaUpdatedAt),
            periods: data.periods || [],
            activePeriodId: data.activePeriodId || null,
            defaultGradingCategories: data.defaultGradingCategories || []
        }
    };
}

// Applies the Edge Function's merged result back onto a full data.json
// object, touching ONLY the fields this sync feature owns - every other
// field (whatsappNumber, portfolioSettings, counselors, lastReportDate,
// weeklyReportSchedule, gradingDistribution) is left completely untouched.
function applyMerged(data, merged) {
    data.classes = merged.classes;
    data.deletedClassIds = merged.deletedClassIds;
    data.subjects = merged.subjects;
    data.deletedSubjectIds = merged.deletedSubjectIds;
    data.periods = merged.meta.periods;
    data.activePeriodId = merged.meta.activePeriodId;
    data.defaultGradingCategories = merged.meta.defaultGradingCategories;
    data.metaUpdatedAt = merged.meta.updatedAt;

    // A class/subject the active tab was pointing at may no longer exist
    // (deleted on the other device) - same fallback loadData() already
    // applies on a normal page load for a stale activeClassId.
    if (data.activeClassId && !(data.classes || []).some(c => c.id === data.activeClassId)) {
        data.activeClassId = data.classes.length > 0 ? data.classes[0].id : null;
    }
    if (data.activeSubjectId && !(data.subjects || []).some(s => s.id === data.activeSubjectId)) {
        data.activeSubjectId = data.subjects.length > 0 ? data.subjects[0].id : null;
    }
    return data;
}

// Runs one full sync round trip: read data.json, send it to the Edge
// Function, write the merged result straight back to data.json. Throws an
// Error whose message is 'no_code' / 'network' / 'bad_response' on failure.
async function runSync() {
    const config = loadConfig();
    if (!config.code) throw new Error('no_code');

    const data = readData();
    const local = buildLocalPayload(data);

    let res;
    try {
        res = await fetch(SYNC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: config.code, local })
        });
    } catch (e) {
        throw new Error('network');
    }
    if (!res.ok) throw new Error('bad_response');
    const body = await res.json();
    if (!body || !body.merged) throw new Error('bad_response');

    const updated = applyMerged(data, body.merged);
    atomicWrite(DATA_FILE, JSON.stringify(updated));

    config.lastSyncedAt = new Date().toISOString();
    saveConfig(config);

    return {
        lastSyncedAt: config.lastSyncedAt,
        classCount: updated.classes.length,
        subjectCount: updated.subjects.length
    };
}

module.exports = { status, setCode, generateNewCode, runSync };
