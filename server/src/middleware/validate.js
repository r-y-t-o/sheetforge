/**
 * Input validators. The goal is defence-in-depth: stop obvious attack shapes
 * (control chars, path traversal, whitespace smuggling, excessive length)
 * before forwarding the value to Autodesk, without pretending to know every
 * legitimate URN format they might return. Autodesk's APIs will reject any
 * malformed ID we forward.
 *
 * Rule of thumb:
 *   - Path-segment IDs:    no whitespace, no `/`, `\`, `#`, no control chars.
 *   - Body-carried URNs:   no whitespace, no `\`, no control chars
 *                          (but `/`, `?`, `=`, `&` are allowed — version URNs
 *                          legitimately contain `?version=N`).
 *   - Both have a generous length cap.
 */

// 1 – 500 printable chars, no whitespace, `/`, `\`, `#`, or control bytes.
// Used for IDs that will be concatenated into a URL *path* on the server side.
const PATH_SAFE_ID = /^[^\s/\\#\x00-\x1F\x7F]{1,500}$/;

// 1 – 500 printable chars, no whitespace, no `\`, no control bytes.
// Used for URNs / IDs that travel only in JSON bodies (never in a URL path).
const BODY_SAFE_ID = /^[^\s\\\x00-\x1F\x7F]{1,500}$/;

// Aliases — kept so route files remain readable. All point at the same loose
// patterns, because encoding our assumptions about Autodesk's ID shapes into
// stricter regexes has produced more outages than attack deflections.
const HUB_ID       = PATH_SAFE_ID;
const PROJECT_ID   = PATH_SAFE_ID;
const AUTODESK_URN = PATH_SAFE_ID;   // folderId / itemId in path
const VERSION_URN  = BODY_SAFE_ID;   // body-only; may contain `?version=N`
const EXPORT_ID    = PATH_SAFE_ID;
const FILE_ID      = PATH_SAFE_ID;

function reject(res, field) {
    return res.status(400).json({ error: `Invalid or missing '${field}'` });
}

function validateParams(shape) {
    return (req, res, next) => {
        for (const [key, re] of Object.entries(shape)) {
            const v = req.params[key];
            if (typeof v !== 'string' || !re.test(v)) return reject(res, key);
        }
        next();
    };
}

function validateBody(shape) {
    return (req, res, next) => {
        const body = req.body || {};
        for (const [key, rule] of Object.entries(shape)) {
            const v = body[key];
            if (rule.required && (v === undefined || v === null || v === '')) return reject(res, key);
            if (v === undefined || v === null) continue;
            if (rule.array) {
                if (!Array.isArray(v) || v.length === 0) return reject(res, key);
                if (rule.re && !v.every((x) => typeof x === 'string' && rule.re.test(x))) return reject(res, key);
            } else {
                if (typeof v !== 'string' || !rule.re.test(v)) return reject(res, key);
            }
        }
        next();
    };
}

module.exports = {
    HUB_ID, PROJECT_ID, AUTODESK_URN, VERSION_URN, EXPORT_ID, FILE_ID,
    validateParams, validateBody
};
