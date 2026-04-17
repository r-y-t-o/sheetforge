const express = require('express');
const archiver = require('archiver');
const authMiddleware = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const exportSvc = require('../services/exportService');
const { getSheets } = require('../services/derivativeService');
const { buildRenameMap } = require('../services/namingService');
const {
    validateBody, validateParams,
    PROJECT_ID, EXPORT_ID, VERSION_URN, FILE_ID, AUTODESK_URN
} = require('../middleware/validate');

const router = express.Router();
router.use(authMiddleware);

// Trigger a Construction Files export.
router.post('/trigger',
    validateBody({
        projectId: { required: true, re: PROJECT_ID },
        versionUrns: { required: true, array: true, re: VERSION_URN }
    }),
    asyncHandler(async (req, res) => {
        const { projectId, versionUrns } = req.body;
        const data = await exportSvc.triggerExport(req.session.access_token, projectId, versionUrns);
        res.json(data);
    })
);

// Poll.
router.get('/:projectId/:exportId/status',
    validateParams({ projectId: PROJECT_ID, exportId: EXPORT_ID }),
    asyncHandler(async (req, res) => {
    const { projectId, exportId } = req.params;
    const data = await exportSvc.getExportStatus(req.session.access_token, projectId, exportId);
    res.json(data);
}));


// Allow-list of hosts we're willing to GET a ZIP from. The Construction Files
// export hands back signed S3 URLs on these Autodesk/AWS CDNs — anything else
// would be an SSRF vector.
const SIGNED_URL_HOST_ALLOWLIST = [
    /\.autodesk\.com$/i,
    /\.autodeskcdn\.(?:com|net)$/i,
    /\.cloudfront\.net$/i,
    /\.amazonaws\.com$/i
];
function isAllowedSignedUrl(u) {
    try {
        const parsed = new URL(u);
        if (parsed.protocol !== 'https:') return false;
        return SIGNED_URL_HOST_ALLOWLIST.some((re) => re.test(parsed.hostname));
    } catch { return false; }
}

// Download the ZIP from ACC's signed URL and populate the in-memory file cache.
router.post('/extract',
    validateBody({ exportId: { required: true, re: EXPORT_ID } }),
    asyncHandler(async (req, res) => {
        const { signedUrl, exportId } = req.body;
        if (!signedUrl || !isAllowedSignedUrl(signedUrl)) {
            return res.status(400).json({ error: 'signedUrl is missing or not an allowed Autodesk host' });
        }
        const files = await exportSvc.downloadAndExtract(signedUrl, exportId);
        res.json({ exportId, files });
    })
);

// Compute the rename map (no side effects) — used by the UI for live preview
// and for the final download/upload payload.
router.post('/preview',
    validateBody({
        exportId: { required: true, re: EXPORT_ID },
        versionUrn: { required: true, re: VERSION_URN }
    }),
    asyncHandler(async (req, res) => {
    const { exportId, versionUrn, pattern, separator, separators, placeholder } = req.body;
    const cached = exportSvc.getCached(exportId);
    if (!cached) return res.status(404).json({ error: 'Export cache expired. Please re-export.' });
    const files = [...cached.files.entries()].map(([id, f]) => ({
        id, name: f.name, size: f.size, isPdf: f.isPdf, entryName: f.entryName
    }));
    const { sheets } = await getSheets(req.session.access_token, versionUrn);
    const map = buildRenameMap(files, sheets, pattern || [], separators || separator || ' - ', { placeholder: placeholder || '' });
    // Return an array aligned with files so the client can render a table.
    const rows = files.map((f) => ({
        id: f.id,
        oldName: f.name,
        newName: map[f.id]?.newName || f.name,
        matchedSheet: map[f.id]?.sheet
            ? { sheetNumber: map[f.id].sheet.sheetNumber, sheetName: map[f.id].sheet.sheetName }
            : null
    }));
    res.json({ rows });
}));

// Stream all selected + renamed PDFs as a single ZIP.
router.post('/zip',
    validateBody({
        exportId: { required: true, re: EXPORT_ID },
        versionUrn: { required: true, re: VERSION_URN }
    }),
    asyncHandler(async (req, res) => {
    const { exportId, versionUrn, pattern, separator, separators, placeholder, fileIds } = req.body;
    const cached = exportSvc.getCached(exportId);
    if (!cached) return res.status(404).json({ error: 'Export cache expired. Please re-export.' });

    const allFiles = [...cached.files.entries()].map(([id, f]) => ({
        id, name: f.name, size: f.size, isPdf: f.isPdf, entryName: f.entryName
    }));
    const selected = fileIds && fileIds.length
        ? allFiles.filter((f) => fileIds.includes(f.id))
        : allFiles;

    const { sheets } = await getSheets(req.session.access_token, versionUrn);
    const map = buildRenameMap(selected, sheets, pattern || [], separators || separator || ' - ', { placeholder: placeholder || '' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="sheets.zip"');

    const zip = archiver('zip', { zlib: { level: 6 } });
    zip.on('error', (err) => {
        console.error('[zip] archive error', err);
        try { res.status(500).end(); } catch { /* already streaming */ }
    });
    zip.pipe(res);
    for (const f of selected) {
        const entry = cached.files.get(f.id);
        if (!entry) continue;
        const newName = map[f.id]?.newName || entry.name;
        zip.append(entry.buffer, { name: newName });
    }
    zip.finalize();
}));


module.exports = router;
