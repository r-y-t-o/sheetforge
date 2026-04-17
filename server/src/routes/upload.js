const express = require('express');
const authMiddleware = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const exportSvc = require('../services/exportService');
const { getSheets } = require('../services/derivativeService');
const { buildRenameMap } = require('../services/namingService');
const { uploadMany } = require('../services/uploadService');
const {
    validateBody, PROJECT_ID, EXPORT_ID, VERSION_URN, AUTODESK_URN, FILE_ID
} = require('../middleware/validate');

const router = express.Router();
router.use(authMiddleware);

router.post('/acc',
    validateBody({
        exportId: { required: true, re: EXPORT_ID },
        versionUrn: { required: true, re: VERSION_URN },
        targetProjectId: { required: true, re: PROJECT_ID },
        targetFolderId: { required: true, re: AUTODESK_URN },
        fileIds: { array: true, re: FILE_ID }
    }),
    asyncHandler(async (req, res) => {
    const { exportId, versionUrn, fileIds, pattern, separator, separators, placeholder, targetProjectId, targetFolderId } = req.body;

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

    const items = selected.map((f) => ({
        name: map[f.id]?.newName || f.name,
        buffer: cached.files.get(f.id).buffer
    }));

    const results = await uploadMany(req.session.access_token, targetProjectId, targetFolderId, items);
    const successCount = results.filter((r) => r.status === 'success').length;
    res.json({ results, successCount, totalCount: items.length });
}));


module.exports = router;
