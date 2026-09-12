// Paid-activation licensing module.
//
// Design: the app never decides "am I licensed?" from a value it can edit
// itself. Instead, a Supabase Edge Function (supabase/functions/verify-license)
// is the only party that can produce a validly *signed* payload (owner name +
// subscription expiry + issue time), using an Ed25519 private key that never
// leaves that function. This module only ever holds the matching PUBLIC key,
// so it can verify a payload's signature but can never forge one - editing
// this file to always report "valid" doesn't help, because the feature this
// gates (PDF export) checks the verified, signed expiry/issue time, not a
// local flag.
//
// Offline behaviour: once activated, the signed payload is cached in
// license.json and keeps working for GRACE_PERIOD_DAYS after it was last
// issued, so the app stays fully usable without a constant connection. Every
// time the app *does* have internet, it silently re-verifies and refreshes
// that cached payload in the background.

const fs = require('fs');
const path = require('path');

// Guarded like `puppeteer` above in server.js: an install that was updated
// via the self-update button (which only copies files, never runs `npm
// install`) from before this dependency existed won't have it in
// node_modules. Rather than crashing the whole server on startup, licensing
// just reports itself unavailable and blocks paid exports until a fresh
// reinstall brings the dependency in.
let ed = null;
try {
    ed = require('@noble/ed25519');
} catch (e) {
    console.error('[Licensing] @noble/ed25519 not available - licensing disabled until reinstalled:', e.message);
}

// Public key only - safe to embed, it can verify signatures but never
// create them. Replace with the key printed when the signing keypair for
// your Supabase project was generated (see supabase/README.md).
const LICENSE_PUBLIC_KEY_HEX = process.env.LICENSE_PUBLIC_KEY_HEX
    || '0bff72a0de2adbfb6a290b4d6b6651cdf5a9c7cbbd23f8444ae480a3a838e9e4';

// The verify-license Edge Function's URL, e.g.
// https://xxxxx.supabase.co/functions/v1/verify-license
const VERIFY_URL = process.env.LICENSE_VERIFY_URL || '';

const LICENSE_FILE = path.join(__dirname, 'license.json');
const GRACE_PERIOD_DAYS = 14;
const REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000; // re-check every 12h while running

let cached = null; // { key, payload_b64, signature_hex, payload: {key, owner_name, expires_at, issued_at} }

function atomicWrite(filePath, data) {
    const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tempPath, data, 'utf8');
    fs.renameSync(tempPath, filePath);
}

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    return bytes;
}

async function verifySignedRecord(record) {
    if (!record || !record.payload_b64 || !record.signature_hex) return null;
    try {
        const sigBytes = hexToBytes(record.signature_hex);
        const msgBytes = new TextEncoder().encode(record.payload_b64);
        const pubBytes = hexToBytes(LICENSE_PUBLIC_KEY_HEX);
        const ok = await ed.verifyAsync(sigBytes, msgBytes, pubBytes);
        if (!ok) return null;
        const payload = JSON.parse(Buffer.from(record.payload_b64, 'base64').toString('utf8'));
        return payload;
    } catch (e) {
        return null;
    }
}

function loadFromDisk() {
    try {
        if (!fs.existsSync(LICENSE_FILE)) return null;
        const record = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'));
        return record;
    } catch (e) {
        return null;
    }
}

async function refreshCacheFromDisk() {
    const record = loadFromDisk();
    if (!record) { cached = null; return; }
    const payload = await verifySignedRecord(record);
    if (!payload) { cached = null; return; }
    cached = { ...record, payload };
}

// Calls the Edge Function for the given key. Returns the parsed+verified
// payload on success, or throws an Error whose message is one of:
// 'network', 'invalid_key', 'revoked', 'expired', 'bad_response'.
async function verifyWithServer(key) {
    if (!VERIFY_URL) throw new Error('not_configured');
    let res;
    try {
        res = await fetch(VERIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key })
        });
    } catch (e) {
        throw new Error('network');
    }
    if (!res.ok) {
        let reason = 'bad_response';
        try { reason = (await res.json()).error || reason; } catch (e) {}
        throw new Error(reason);
    }
    const body = await res.json();
    const payload = await verifySignedRecord({ payload_b64: body.payload, signature_hex: body.signature });
    if (!payload) throw new Error('bad_response');

    const record = { key, payload_b64: body.payload, signature_hex: body.signature };
    atomicWrite(LICENSE_FILE, JSON.stringify(record, null, 2));
    cached = { ...record, payload };
    return payload;
}

// Activates (or re-activates) a key entered by the user. Throws on failure
// with a message from the set above.
async function activate(key) {
    if (!ed) throw new Error('module_unavailable');
    const trimmed = (key || '').trim();
    if (!trimmed) throw new Error('missing_key');
    return verifyWithServer(trimmed);
}

// Silent background refresh - never throws, just leaves the existing cached
// (still within its own grace period) payload in place on any failure.
async function refreshInBackground() {
    if (!cached || !cached.key) return;
    try {
        await verifyWithServer(cached.key);
    } catch (e) {
        // offline, or server rejected it (e.g. now expired/revoked) - the
        // cached payload's own expiry/grace-period checks below still apply.
    }
}

function currentStatus() {
    if (!cached || !cached.payload) {
        return { activated: false, valid: false, ownerName: null, expiresAt: null };
    }
    const { owner_name, expires_at, issued_at } = cached.payload;
    const now = Date.now();
    const subscriptionValid = new Date(expires_at).getTime() > now;
    const graceDeadline = new Date(issued_at).getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
    const withinGrace = now <= graceDeadline;
    return {
        activated: true,
        valid: subscriptionValid && withinGrace,
        ownerName: owner_name,
        expiresAt: expires_at,
        subscriptionValid,
        withinGrace,
        graceDeadline: new Date(graceDeadline).toISOString()
    };
}

function isPdfAllowed() {
    return currentStatus().valid === true;
}

async function init() {
    await refreshCacheFromDisk();
    // Best-effort refresh at startup, then periodically while the process runs.
    refreshInBackground();
    setInterval(refreshInBackground, REFRESH_INTERVAL_MS);
}

module.exports = { init, activate, currentStatus, isPdfAllowed, refreshInBackground };
