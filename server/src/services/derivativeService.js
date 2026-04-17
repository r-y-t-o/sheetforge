/**
 * Model Derivative service: ensure a Revit version URN is translated, then
 * harvest sheet + title-block parameters.
 *
 * Strategy:
 *   1. Wait for translation (SVF/SVF2).
 *   2. GET /metadata → list model views. Each 2D view IS a sheet.
 *   3. For each sheet view, GET /metadata/{guid}/properties → objects on that
 *      sheet, including the ViewSheet element and title-block family instance.
 *   4. Flatten parameters under "Sheet.*" and "TitleBlock.*" prefixes.
 */
const pLimit = require('p-limit');
const { apsRequest } = require('./apsClient');

const sheetsCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;

function toBase64Urn(urn) {
    return Buffer.from(urn, 'utf8').toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// ────────────────────── Translation ──────────────────────

async function startTranslation(token, urn, region = 'US') {
    const encoded = toBase64Urn(urn);
    console.log(`[derivative] Starting translation region=${region}`);
    try {
        await apsRequest(token).post('/modelderivative/v2/designdata/job', {
            input: { urn: encoded },
            output: {
                destination: { region },
                formats: [{ type: 'svf2', views: ['2d', '3d'] }]
            }
        }, {
            headers: { 'Content-Type': 'application/json', 'x-ads-force': 'true' }
        });
    } catch (err) {
        console.error(`[derivative] startTranslation failed: ${err.response?.status}`);
        throw err;
    }
}

async function getManifest(token, urn) {
    const r = await apsRequest(token).get(
        `/modelderivative/v2/designdata/${toBase64Urn(urn)}/manifest`
    );
    return r.data;
}

async function waitForTranslation(token, urn, { timeoutMs = 10 * 60 * 1000, intervalMs = 5000 } = {}) {
    const start = Date.now();
    let translationStarted = false;
    let region = 'US';
    while (Date.now() - start < timeoutMs) {
        let manifest;
        try {
            manifest = await getManifest(token, urn);
            console.log(`[derivative] manifest status=${manifest.status} progress=${manifest.progress || ''}`);
        } catch (err) {
            if (err.response?.status === 404) {
                if (!translationStarted) {
                    try {
                        await startTranslation(token, urn, region);
                        translationStarted = true;
                    } catch (regErr) {
                        if (region === 'US') {
                            console.warn('[derivative] US rejected, trying EMEA');
                            region = 'EMEA';
                            try {
                                await startTranslation(token, urn, region);
                                translationStarted = true;
                            } catch (emErr) {
                                throw new Error(`Translation rejected: ${emErr.message}`);
                            }
                        } else { throw regErr; }
                    }
                }
                await sleep(intervalMs);
                continue;
            }
            throw err;
        }
        const status = (manifest.status || '').toLowerCase();
        if (status === 'success' || status === 'partialsuccess') return manifest;
        if (status === 'failed') throw new Error(`Translation failed: ${manifest.progress || ''}`);
        await sleep(intervalMs);
    }
    throw new Error('Translation timed out');
}

// ────────────────────── Metadata ──────────────────────

async function getModelViews(token, urn) {
    const r = await apsRequest(token).get(
        `/modelderivative/v2/designdata/${toBase64Urn(urn)}/metadata`
    );
    return r.data?.data?.metadata || [];
}

/**
 * Identify which metadata views are actual sheets (not working views,
 * 3D coordination views, legends, etc.)
 */
function filterSheetViews(views) {
    return views.filter((v) => {
        if (v.role !== '2d') return false;
        const name = v.name || '';
        // Skip working views (commonly prefixed WV_ or "Working View")
        if (/^WV[_\s]/i.test(name)) return false;
        if (/^Working View/i.test(name)) return false;
        return true;
    });
}

/**
 * Parse sheet number and name from view name like "A101 - First Floor Plan".
 */
function parseViewName(name) {
    const m = (name || '').match(/^(.+?)\s+-\s+(.+)$/);
    if (m) return { sheetNumber: m[1].trim(), sheetName: m[2].trim() };
    return { sheetNumber: name || '', sheetName: '' };
}

// ────────────────────── Properties ──────────────────────

async function getViewProperties(token, urn, guid) {
    const encoded = toBase64Urn(urn);
    const url = `/modelderivative/v2/designdata/${encoded}/metadata/${guid}/properties`;

    async function tryFetch() {
        const r = await apsRequest(token).get(url, { params: { forceget: 'true' } });
        return r.data;
    }

    let data;
    try {
        data = await tryFetch();
    } catch (err) {
        // Some views may 404 or fail — not critical, just skip.
        console.warn(`[derivative] properties for ${guid} failed: ${err.response?.status || err.message}`);
        return null;
    }

    // If result is 'accepted' (still computing), poll briefly.
    if (data?.data?.collection) return data;
    for (let i = 0; i < 12; i++) {
        await sleep(5000);
        try {
            data = await tryFetch();
            if (data?.data?.collection) return data;
        } catch { break; }
    }
    return data; // may be partial or null
}

/**
 * From a sheet view's properties, extract the title-block instance parameters.
 *
 * SVF property databases from ACC often set category="NO CATEGORY" on every
 * object, so we can't rely on category names. Instead we detect the title-block
 * instance by looking for an object whose [Identity Data] group contains
 * sheet-specific keys like "Sheet Number" plus at least one authorship field
 * like "Drawn By", "Checked By", or "Approved By".
 *
 * We also look for a separate title-block *type* object (same family name but
 * without the "[ElementId]" suffix) which may carry additional type parameters.
 */
const TITLE_BLOCK_MARKER_KEYS = ['Drawn By', 'Checked By', 'Designed By', 'Approved By', 'Sheet Issue Date'];

function extractParametersFromView(propsData) {
    const objects = propsData?.data?.collection || [];
    const result = {};

    // Strategy 1: category-based detection (works when categories ARE populated).
    let foundByCategory = false;
    for (const obj of objects) {
        const cat = obj.properties?.__category__?.Category || '';
        if (/Sheet/i.test(cat) && !/Schedule/i.test(cat)) {
            extractGroupedParams(obj, 'Sheet.', result);
            foundByCategory = true;
        }
        if (/Title.?Block/i.test(cat)) {
            extractGroupedParams(obj, 'TitleBlock.', result);
            foundByCategory = true;
        }
    }
    if (foundByCategory) return result;

    // Strategy 2: detect title-block instance by key presence (for "NO CATEGORY" SVF).
    // The title block instance has [Identity Data] with "Sheet Number" + authorship fields.
    let titleBlockInstance = null;
    for (const obj of objects) {
        const idData = obj.properties?.['Identity Data'];
        if (!idData || typeof idData !== 'object') continue;
        const keys = Object.keys(idData);
        const hasSheetNumber = keys.includes('Sheet Number');
        const hasAuthorship = TITLE_BLOCK_MARKER_KEYS.some((mk) => keys.includes(mk));
        if (hasSheetNumber && hasAuthorship) {
            titleBlockInstance = obj;
            break;
        }
    }

    if (titleBlockInstance) {
        // Extract all property groups from the title block instance.
        // These include sheet params (Sheet Number, Sheet Name) and
        // authorship params (Drawn By, etc.) — all under one object.
        extractGroupedParams(titleBlockInstance, 'Sheet.', result);

        // Also look for the title-block *type* object (same name without [id]).
        const instName = titleBlockInstance.name || '';
        const familyBase = instName.replace(/\s*\[\d+\]$/, '').trim();
        if (familyBase) {
            for (const obj of objects) {
                if (obj === titleBlockInstance) continue;
                if ((obj.name || '').trim() === familyBase) {
                    extractGroupedParams(obj, 'TitleBlock.', result);
                    break;
                }
            }
        }
    }

    return result;
}

function extractGroupedParams(obj, prefix, result) {
    for (const [group, kv] of Object.entries(obj.properties || {})) {
        if (group.startsWith('__') || typeof kv !== 'object' || kv == null) continue;
        for (const [k, v] of Object.entries(kv)) {
            const key = `${prefix}${k}`;
            if (!(key in result)) result[key] = stringify(v);
        }
    }
}

function stringify(v) {
    if (v == null) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
}

// ────────────────────── Main entry point ──────────────────────

async function getSheets(token, urn) {
    const cached = sheetsCache.get(urn);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.data;

    // 1. Ensure translated.
    await waitForTranslation(token, urn);

    // 2. Get model views; the 2D views are the sheets.
    const views = await getModelViews(token, urn);
    const sheetViews = filterSheetViews(views);
    console.log(`[derivative] ${views.length} total views, ${sheetViews.length} identified as sheets`);

    if (sheetViews.length === 0) {
        throw new Error('No sheet views found in this model');
    }

    // 3. Query properties for each sheet view in parallel (limit concurrency).
    const limit = pLimit(5);
    const sheets = [];

    console.log(`[derivative] querying properties for ${sheetViews.length} sheet views...`);
    const results = await Promise.all(
        sheetViews.map((view) =>
            limit(async () => {
                const { sheetNumber, sheetName } = parseViewName(view.name);
                const propsData = await getViewProperties(token, urn, view.guid);
                const parameters = propsData ? extractParametersFromView(propsData) : {};

                // Ensure the canonical keys are present (from view name as fallback).
                if (sheetNumber && !parameters['Sheet.Sheet Number']) {
                    parameters['Sheet.Sheet Number'] = sheetNumber;
                }
                if (sheetName && !parameters['Sheet.Sheet Name']) {
                    parameters['Sheet.Sheet Name'] = sheetName;
                }

                return {
                    objectId: view.guid,
                    guid: view.guid,
                    sheetNumber,
                    sheetName,
                    parameters
                };
            })
        )
    );

    sheets.push(...results);
    console.log(`[derivative] successfully loaded ${sheets.length} sheets`);

    // 4. Build union of all parameter keys.
    const keySet = new Set();
    sheets.forEach((s) => Object.keys(s.parameters).forEach((k) => keySet.add(k)));
    const parameterKeys = [...keySet].sort((a, b) => {
        const ga = a.startsWith('Sheet.') ? 0 : a.startsWith('TitleBlock.') ? 1 : 2;
        const gb = b.startsWith('Sheet.') ? 0 : b.startsWith('TitleBlock.') ? 1 : 2;
        if (ga !== gb) return ga - gb;
        return a.localeCompare(b);
    });

    const data = { urn, sheets, parameterKeys };
    sheetsCache.set(urn, { fetchedAt: Date.now(), data });
    return data;
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

module.exports = { getSheets, toBase64Urn };
