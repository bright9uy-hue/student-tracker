// js/voice-commands.js — parses a spoken Arabic sentence like
// "ارصد لأحمد نقطة حمراء" into a concrete grading action (which student,
// red or green participation point). Kept as pure, DOM-free logic (no
// SpeechRecognition here — that lives in GradingTable.js, which owns the
// mic button and the recognition instance) so it's directly unit-testable
// with plain strings, same pattern as js/grading-model.js.

// Normalizes Arabic text for loose matching: strips diacritics/tatweel and
// unifies alef/yeh/teh-marbuta/hamza variants, so spoken-recognition
// spelling quirks ("أحمد" vs "احمد", "علي" vs "عليّ") still match.
window.normalizeArabic = function(text) {
    return (text || '')
        .replace(/[ً-ٰٟـ]/g, '') // diacritics + tatweel
        .replace(/[إأآا]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي')
        .trim()
        .toLowerCase();
};

// Strips a leading preposition/conjunction ("لأحمد" -> "أحمد", "وأحمد" ->
// "أحمد") and/or definite article ("الغامدي" -> "غامدي") so a name spoken
// with an attached "لـ" ("للغامدي", grammatically لـ + الغامدي with the
// alef elided) still reduces to the same bare root as the roster's own
// "الغامدي" — Arabic prepositions attach directly to the following word
// with no space, so naive whole-word matching misses this constantly.
// Applied to BOTH the transcript's words and the roster name's words, so
// both sides land on the same bare form.
window.stripArabicPrefixes = function(word) {
    if (word.length > 3 && word.startsWith('لل')) word = word.slice(2);
    else if (word.length > 2 && /^[لبكوف]/.test(word)) word = word.slice(1);
    if (word.length > 2 && word.startsWith('ال')) word = word.slice(2);
    return word;
};

const VOICE_RED_KEYWORDS = ['حمراء', 'حمرا', 'سلبية', 'سلبي', 'سيئة', 'سيء', 'مخالفة'];
const VOICE_GREEN_KEYWORDS = ['خضراء', 'خضرا', 'ايجابية', 'ايجابي', 'ممتاز', 'جيدة', 'جيد', 'مشاركة'];

window.detectVoiceSentiment = function(transcript) {
    const norm = normalizeArabic(transcript);
    if (VOICE_RED_KEYWORDS.some(k => norm.includes(normalizeArabic(k)))) return 'red';
    if (VOICE_GREEN_KEYWORDS.some(k => norm.includes(normalizeArabic(k)))) return 'green';
    return null;
};

// Finds the best-matching student by scoring how many of the student's own
// name "words" appear as whole words in the transcript — robust to extra
// words around the name ("ارصد لأحمد نقطة حمراء" still matches student
// "أحمد الغامدي" via the "أحمد" word) and to normalizeArabic's spelling
// smoothing. Requires at least one full-word match, and requires a UNIQUE
// top score — e.g. saying just "أحمد" when the roster has both "أحمد
// الغامدي" and "أحمد العتيبي" is genuinely ambiguous (both score 1), so
// this returns null rather than silently guessing one of them; the teacher
// needs to say enough of the name (e.g. the family name too) to pick one.
window.matchStudentByVoice = function(transcript, students) {
    const words = normalizeArabic(transcript).split(/\s+/).filter(Boolean).map(stripArabicPrefixes);
    let best = null;
    let bestScore = 0;
    let tieCount = 0;
    for (const student of students || []) {
        const nameWords = normalizeArabic(student.name).split(/\s+/).filter(Boolean).map(stripArabicPrefixes);
        const score = nameWords.filter(w => words.includes(w)).length;
        if (score === 0) continue;
        if (score > bestScore) {
            bestScore = score;
            best = student;
            tieCount = 1;
        } else if (score === bestScore) {
            tieCount++;
        }
    }
    return tieCount === 1 ? best : null;
};

// Optional reason extraction: "...بسبب النوم" / "...لأنه تحدث" -> "النوم" /
// "تحدث". Returns null when no such phrase is present (most spoken
// commands won't include one) — the caller falls back to a generic label.
window.extractVoiceReason = function(transcript) {
    const match = (transcript || '').match(/(?:بسبب|لأنه|لانه|علشان)\s+(.+)$/);
    return match ? match[1].trim() : null;
};

// Combines the above into one parse result. Requires BOTH a sentiment
// keyword and a student match to succeed — a command missing either is too
// ambiguous to act on safely (better to tell the teacher to repeat it than
// guess and mark the wrong student).
window.parseVoiceGradingCommand = function(transcript, students) {
    const sentiment = detectVoiceSentiment(transcript);
    const student = matchStudentByVoice(transcript, students);
    if (!sentiment || !student) {
        return { ok: false, transcript };
    }
    return { ok: true, transcript, sentiment, student, reason: extractVoiceReason(transcript) };
};
