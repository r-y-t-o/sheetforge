const express = require('express');
const authMiddleware = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { apsRequest } = require('../services/apsClient');
const { validateParams, HUB_ID, PROJECT_ID, AUTODESK_URN } = require('../middleware/validate');

const router = express.Router();
router.use(authMiddleware);

router.get('/hubs', asyncHandler(async (req, res) => {
    const r = await apsRequest(req.session.access_token).get('/project/v1/hubs');
    res.json(r.data);
}));

router.get('/hubs/:hubId/projects',
    validateParams({ hubId: HUB_ID }),
    asyncHandler(async (req, res) => {
        const r = await apsRequest(req.session.access_token).get(`/project/v1/hubs/${req.params.hubId}/projects`);
        res.json(r.data);
    })
);

router.get('/hubs/:hubId/projects/:projectId/topFolders',
    validateParams({ hubId: HUB_ID, projectId: PROJECT_ID }),
    asyncHandler(async (req, res) => {
        const { hubId, projectId } = req.params;
        const r = await apsRequest(req.session.access_token).get(
            `/project/v1/hubs/${hubId}/projects/${projectId}/topFolders`
        );
        res.json(r.data);
    })
);

router.get('/projects/:projectId/folders/:folderId/contents',
    validateParams({ projectId: PROJECT_ID, folderId: AUTODESK_URN }),
    asyncHandler(async (req, res) => {
        const { projectId, folderId } = req.params;
        const r = await apsRequest(req.session.access_token).get(
            `/data/v1/projects/${projectId}/folders/${folderId}/contents`
        );
        res.json(r.data);
    })
);

router.get('/projects/:projectId/items/:itemId/versions',
    validateParams({ projectId: PROJECT_ID, itemId: AUTODESK_URN }),
    asyncHandler(async (req, res) => {
        const { projectId, itemId } = req.params;
        const r = await apsRequest(req.session.access_token).get(
            `/data/v1/projects/${projectId}/items/${itemId}/versions`
        );
        res.json(r.data);
    })
);

module.exports = router;
