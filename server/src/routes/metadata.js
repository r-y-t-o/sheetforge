const express = require('express');
const authMiddleware = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { getSheets } = require('../services/derivativeService');
const { validateBody, VERSION_URN } = require('../middleware/validate');

const router = express.Router();
router.use(authMiddleware);
router.use('/sheets', validateBody({ versionUrn: { required: true, re: VERSION_URN } }));

/**
 * Return the sheet list + per-sheet parameters for a Revit version URN.
 * The version URN comes from the Data Management API `included` sideload
 * (type=versions). No need to URL-encode it here — the frontend passes it
 * in the request body.
 */
router.post('/sheets', asyncHandler(async (req, res) => {
    const { versionUrn } = req.body;
    const data = await getSheets(req.session.access_token, versionUrn);
    res.json(data);
}));

module.exports = router;
