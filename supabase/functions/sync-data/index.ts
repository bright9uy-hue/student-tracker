// Supabase Edge Function: sync-data
//
// Two-way sync between the desktop app and the standalone mobile app for
// core academic data (classes/students/grades/subjects/grading
// categories/periods). Both apps stay local-storage-first — this function
// is only reached when the teacher pairs the two apps with a shared code
// and presses/auto-triggers sync.
//
// The merge logic lives HERE ONLY (not duplicated in the desktop's JS and
// the mobile app's Dart) so there is exactly one implementation to keep
// correct. Each client sends its local payload; this function merges it
// against whatever is already stored for that pairing code, persists the
// merged result, and returns it — both sides then overwrite their local
// copy with the response, so after a successful round trip both are
// byte-for-byte identical.
//
// Merge granularity is per-entity, not a single whole-roster timestamp:
// a class's roster (name+students, which covers grades), its attendance,
// and its student groups each carry their own `updatedAt`, so an
// attendance mark on one device can never silently clobber a grade edit
// made on the other device after the last sync. Subjects (name+grading
// categories) and "meta" (periods/activePeriodId/defaultGradingCategories)
// are each a single last-write-wins unit — coarser, but edited rarely
// enough that the finer split isn't worth the extra complexity there.
//
// Deletions need explicit tombstones: without them, a class deleted on
// one device would simply be a class the *other* device's payload doesn't
// mention, and a naive union-merge would silently resurrect it on every
// sync. `deletedClassIds`/`deletedSubjectIds` map id -> deletedAt; a
// tombstone wins unless some field on that same id was edited *after* the
// deletion (an edit-after-delete resurrects the record and drops the
// tombstone — the teacher clearly meant to keep it after all).
//
// No auth beyond the pairing code itself: the code is a high-entropy
// value the teacher copies from one device to the other, never guessable
// or listed anywhere, the same trust model as the license verification
// function's key. Row Level Security on sync_snapshots has zero policies
// (see migration 0003) — only this function, using the service_role key,
// can read or write the table at all.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
    });
}

// deletedAt/updatedAt values are client-supplied millis-since-epoch. Any
// non-finite-number value (missing field, wrong type from a malformed
// payload) is treated as "never" so it can never incorrectly win a merge.
function num(v: unknown): number {
    return typeof v === "number" && isFinite(v) ? v : -1;
}

type IdMap = Record<string, number>;

interface SyncPayload {
    classes: Record<string, unknown>[];
    deletedClassIds: IdMap;
    subjects: Record<string, unknown>[];
    deletedSubjectIds: IdMap;
    meta: Record<string, unknown> & { updatedAt?: number };
}

function emptyPayload(): SyncPayload {
    return { classes: [], deletedClassIds: {}, subjects: [], deletedSubjectIds: {}, meta: { updatedAt: 0 } };
}

function asPayload(v: unknown): SyncPayload {
    if (!v || typeof v !== "object") return emptyPayload();
    const p = v as Partial<SyncPayload>;
    return {
        classes: Array.isArray(p.classes) ? (p.classes as Record<string, unknown>[]) : [],
        deletedClassIds: (p.deletedClassIds && typeof p.deletedClassIds === "object") ? (p.deletedClassIds as IdMap) : {},
        subjects: Array.isArray(p.subjects) ? (p.subjects as Record<string, unknown>[]) : [],
        deletedSubjectIds: (p.deletedSubjectIds && typeof p.deletedSubjectIds === "object") ? (p.deletedSubjectIds as IdMap) : {},
        meta: (p.meta && typeof p.meta === "object") ? p.meta : { updatedAt: 0 },
    };
}

function mergeDeletedMaps(a: IdMap, b: IdMap): IdMap {
    const out: IdMap = { ...a };
    for (const [id, ts] of Object.entries(b)) {
        out[id] = Math.max(out[id] ?? -1, num(ts));
    }
    return out;
}

// Merges two versions of the same class id, field-group by field-group —
// each group (roster, attendance, groups) independently keeps whichever
// side's copy is newer. `e`/`i` are only ever both defined when called
// (see mergeCollection): a one-sided id never reaches here.
function mergeClass(e: Record<string, unknown>, i: Record<string, unknown>): Record<string, unknown> {
    const pickGroup = (updatedAtKey: string, fields: string[], fieldDefaults: Record<string, unknown>) => {
        const eAt = num(e[updatedAtKey]);
        const iAt = num(i[updatedAtKey]);
        const winner = iAt > eAt ? i : e;
        const out: Record<string, unknown> = { [updatedAtKey]: Math.max(eAt, iAt) };
        for (const f of fields) out[f] = winner[f] ?? fieldDefaults[f];
        return out;
    };
    return {
        id: e.id ?? i.id,
        ...pickGroup("rosterUpdatedAt", ["name", "students"], { name: "", students: [] }),
        ...pickGroup("attendanceUpdatedAt", ["attendance"], { attendance: {} }),
        ...pickGroup("groupsUpdatedAt", ["groups"], { groups: [] }),
    };
}

function classLatestUpdatedAt(c: Record<string, unknown>): number {
    return Math.max(num(c.rosterUpdatedAt), num(c.attendanceUpdatedAt), num(c.groupsUpdatedAt));
}

function mergeSubject(e: Record<string, unknown>, i: Record<string, unknown>): Record<string, unknown> {
    return num(i.updatedAt) > num(e.updatedAt) ? i : e;
}

function subjectLatestUpdatedAt(s: Record<string, unknown>): number {
    return num(s.updatedAt);
}

// Generic per-id union-merge with tombstone handling, shared by classes
// and subjects. `mergeOne` is only called when a record exists on both
// sides; a one-sided record passes through untouched.
function mergeCollection(
    existingList: Record<string, unknown>[],
    incomingList: Record<string, unknown>[],
    existingDeleted: IdMap,
    incomingDeleted: IdMap,
    mergeOne: (e: Record<string, unknown>, i: Record<string, unknown>) => Record<string, unknown>,
    latestUpdatedAt: (record: Record<string, unknown>) => number,
): { list: Record<string, unknown>[]; deleted: IdMap } {
    const eById = new Map(existingList.filter((r) => typeof r?.id === "string").map((r) => [r.id as string, r]));
    const iById = new Map(incomingList.filter((r) => typeof r?.id === "string").map((r) => [r.id as string, r]));
    const deleted = mergeDeletedMaps(existingDeleted, incomingDeleted);

    const allIds = new Set<string>([...eById.keys(), ...iById.keys(), ...Object.keys(deleted)]);
    const list: Record<string, unknown>[] = [];

    for (const id of allIds) {
        const e = eById.get(id);
        const i = iById.get(id);
        const merged = e && i ? mergeOne(e, i) : (e ?? i);
        if (!merged) continue; // id only ever appeared in a tombstone map — nothing to keep

        const delAt = deleted[id];
        if (delAt !== undefined && delAt >= latestUpdatedAt(merged)) {
            // The deletion is at least as new as every field on the record
            // from both sides — stays deleted, don't add it back.
            continue;
        }
        list.push(merged);
        if (delAt !== undefined) delete deleted[id]; // edited after deletion: resurrected, drop the tombstone
    }

    return { list, deleted };
}

function mergeMeta(
    e: Record<string, unknown> & { updatedAt?: number },
    i: Record<string, unknown> & { updatedAt?: number },
): Record<string, unknown> {
    return num(i.updatedAt) > num(e.updatedAt) ? i : e;
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: CORS_HEADERS });
    }
    if (req.method !== "POST") {
        return jsonResponse({ error: "method_not_allowed" }, 405);
    }

    let body: { code?: string; local?: unknown };
    try {
        body = await req.json();
    } catch {
        return jsonResponse({ error: "bad_request" }, 400);
    }

    const code = (body.code || "").trim();
    if (!code) {
        return jsonResponse({ error: "missing_code" }, 400);
    }
    const local = asPayload(body.local);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: row, error: readError } = await supabase
        .from("sync_snapshots")
        .select("data")
        .eq("sync_code", code)
        .maybeSingle();

    if (readError) {
        return jsonResponse({ error: "read_failed" }, 500);
    }

    const existing = asPayload(row?.data);

    const classesMerge = mergeCollection(
        existing.classes,
        local.classes,
        existing.deletedClassIds,
        local.deletedClassIds,
        mergeClass,
        classLatestUpdatedAt,
    );
    const subjectsMerge = mergeCollection(
        existing.subjects,
        local.subjects,
        existing.deletedSubjectIds,
        local.deletedSubjectIds,
        mergeSubject,
        subjectLatestUpdatedAt,
    );

    const merged: SyncPayload = {
        classes: classesMerge.list,
        deletedClassIds: classesMerge.deleted,
        subjects: subjectsMerge.list,
        deletedSubjectIds: subjectsMerge.deleted,
        meta: mergeMeta(existing.meta, local.meta),
    };

    const { error: writeError } = await supabase
        .from("sync_snapshots")
        .upsert({ sync_code: code, data: merged, updated_at: new Date().toISOString() });

    if (writeError) {
        return jsonResponse({ error: "write_failed" }, 500);
    }

    return jsonResponse({ merged }, 200);
});
