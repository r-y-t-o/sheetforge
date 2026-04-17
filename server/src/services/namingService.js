/**
 * Build safe filenames from a user-defined pattern (ordered list of parameter
 * keys) with per-field separators, given sheet metadata. Also matches extracted
 * PDFs to sheets by parsing the sheet number out of each filename.
 *
 * Per-field separators:
 *   pattern:    ["Sheet.Sheet Number", "Sheet.Drawn By", "Sheet.Sheet Name"]
 *   separators: [" - ", "_"]
 *
 *   → "A101 - JSmith_First Floor Plan.pdf"
 *
 * If `separators` has fewer entries than pattern.length - 1, the last separator
 * is reused for the remaining gaps. A single-string `separator` is treated as
 * a uniform separator for all gaps (backwards-compatible).
 */

const RESERVED_WIN = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

function sanitize(name, { replacement = '_' } = {}) {
    if (name == null) return '';
    let s = String(name);
    s = s.replace(/[<>:"/\\|?*\u0000-\u001F]/g, replacement);
    s = s.replace(/\s+/g, ' ').trim();
    s = s.replace(/[.\s]+$/g, '');
    if (!s) s = 'sheet';
    if (RESERVED_WIN.test(s)) s = `_${s}`;
    if (s.length > 180) s = s.slice(0, 180);
    return s;
}

/**
 * Normalize the separators input into an array of length pattern.length - 1.
 */
function normalizeSeparators(separators, patternLength) {
    const needed = Math.max(patternLength - 1, 0);
    if (!separators || (Array.isArray(separators) && separators.length === 0)) {
        return new Array(needed).fill(' - ');
    }
    if (typeof separators === 'string') {
        return new Array(needed).fill(separators);
    }
    // Array — pad with last value if shorter.
    const arr = separators.slice(0, needed);
    const last = arr.length > 0 ? arr[arr.length - 1] : ' - ';
    while (arr.length < needed) arr.push(last);
    return arr;
}

/**
 * Render a filename for a sheet.
 */
function renderName(pattern, separators, sheet, { placeholder = '', extension = '.pdf' } = {}) {
    const seps = normalizeSeparators(separators, pattern.length);
    const parts = [];
    const activeSeps = [];

    for (let i = 0; i < pattern.length; i++) {
        const raw = sheet.parameters?.[pattern[i]];
        const val = raw == null || raw === '' ? placeholder : String(raw);
        if (val !== '') {
            if (parts.length > 0) activeSeps.push(seps[i - 1] || ' - ');
            parts.push(val);
        }
    }

    let base = '';
    for (let i = 0; i < parts.length; i++) {
        if (i > 0) base += activeSeps[i - 1];
        base += parts[i];
    }
    return sanitize(base) + extension;
}

function matchFilesToSheets(files, sheets) {
    const byNumber = [...sheets]
        .filter((s) => s.sheetNumber)
        .sort((a, b) => String(b.sheetNumber).length - String(a.sheetNumber).length);

    const out = new Map();
    for (const f of files) {
        if (!f.isPdf) continue;
        const base = f.name.replace(/\.pdf$/i, '');
        let hit = byNumber.find((s) => {
            const n = escapeRe(s.sheetNumber);
            return new RegExp(`^${n}(\\s*[-_]|$)`).test(base);
        });
        if (!hit) hit = byNumber.find((s) => base.includes(s.sheetNumber));
        if (hit) out.set(f.id, hit);
    }
    return out;
}

function escapeRe(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildRenameMap(files, sheets, pattern, separators, opts = {}) {
    const matches = matchFilesToSheets(files, sheets);
    const used = new Set();
    const result = {};
    for (const f of files) {
        const sheet = matches.get(f.id);
        let newName;
        if (sheet && pattern.length > 0) {
            newName = renderName(pattern, separators, sheet, opts);
        } else {
            const base = f.name.replace(/\.(pdf|PDF)$/, '');
            newName = sanitize(base) + (f.isPdf ? '.pdf' : '');
        }
        let candidate = newName;
        let n = 1;
        while (used.has(candidate.toLowerCase())) {
            const ext = candidate.match(/\.[^.]+$/)?.[0] || '';
            const stem = ext ? candidate.slice(0, -ext.length) : candidate;
            candidate = `${stem}-${n}${ext}`;
            n += 1;
        }
        used.add(candidate.toLowerCase());
        result[f.id] = { oldName: f.name, newName: candidate, sheet: sheet || null };
    }
    return result;
}

module.exports = { sanitize, renderName, matchFilesToSheets, buildRenameMap, normalizeSeparators };
