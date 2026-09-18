// Supabase Edge Function: verify-license
//
// Receives a license key, checks it against the `licenses` table (using the
// service_role key, which bypasses RLS), and — only if it is active and not
// expired — returns a payload signed with an Ed25519 private key that never
// leaves this function's environment. The desktop app verifies the
// signature locally with the matching public key, so it can trust the
// payload (owner name + expiry) without holding any secret itself, and
// without a client being able to forge a valid signature by editing local
// app code.
//
// Required secrets (set via `supabase secrets set`):
//   LICENSE_SIGNING_KEY   - 32-byte Ed25519 private key, hex-encoded
// Automatically available in every Edge Function:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "npm:@supabase/supabase-js@2";
import * as ed from "npm:@noble/ed25519@3";
import { sha512 } from "npm:@noble/hashes@2/sha2.js";

ed.hashes.sha512 = sha512;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SIGNING_KEY_HEX = Deno.env.get("LICENSE_SIGNING_KEY")!;

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function hexToBytes(hex: string): Uint8Array {
    const clean = hex.trim();
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
    }
    return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// UTF-8 safe base64 encode (owner_name may contain Arabic text).
function utf8ToBase64(str: string): string {
    return btoa(unescape(encodeURIComponent(str)));
}

function jsonResponse(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
    });
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: CORS_HEADERS });
    }
    if (req.method !== "POST") {
        return jsonResponse({ error: "method_not_allowed" }, 405);
    }

    let body: { key?: string };
    try {
        body = await req.json();
    } catch {
        return jsonResponse({ error: "bad_request" }, 400);
    }

    const key = (body.key || "").trim();
    if (!key) {
        return jsonResponse({ error: "missing_key" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: license, error } = await supabase
        .from("licenses")
        .select("key, owner_name, expires_at, status, activated_at, verify_count")
        .eq("key", key)
        .maybeSingle();

    if (error || !license) {
        return jsonResponse({ error: "invalid_key" }, 404);
    }
    if (license.status !== "active") {
        return jsonResponse({ error: "revoked" }, 403);
    }
    if (new Date(license.expires_at).getTime() < Date.now()) {
        return jsonResponse({ error: "expired" }, 403);
    }

    const nowIso = new Date().toISOString();
    const payloadObj = {
        key: license.key,
        owner_name: license.owner_name,
        expires_at: license.expires_at,
        issued_at: nowIso,
    };
    const payloadB64 = utf8ToBase64(JSON.stringify(payloadObj));

    const privateKey = hexToBytes(SIGNING_KEY_HEX);
    const signatureBytes = await ed.signAsync(new TextEncoder().encode(payloadB64), privateKey);
    const signatureHex = bytesToHex(signatureBytes);

    // Bookkeeping for the seller's own visibility (e.g. a key verified from
    // many activations in a short time is worth a manual look). Awaited
    // (rather than fired-and-forgotten) because the edge runtime can freeze
    // the isolate right after the response is returned, which would drop an
    // un-awaited update before it reaches the database.
    try {
        await supabase
            .from("licenses")
            .update({
                last_verified_at: nowIso,
                activated_at: license.activated_at ?? nowIso,
                verify_count: (license.verify_count ?? 0) + 1,
            })
            .eq("key", key);
    } catch {
        // Non-fatal: the signed payload below is still valid either way.
    }

    return jsonResponse({ payload: payloadB64, signature: signatureHex }, 200);
});
