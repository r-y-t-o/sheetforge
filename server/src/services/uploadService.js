/**
 * Upload a Buffer to an ACC folder using the full 5-step pipeline:
 *   1. POST  /data/v1/projects/{b.id}/storage             → objectId
 *   2. GET   /oss/v2/buckets/{bucket}/objects/{name}/signeds3upload
 *   3. PUT   {signed S3 url}
 *   4. POST  /oss/v2/buckets/{bucket}/objects/{name}/signeds3upload  (finalize)
 *   5. POST  /data/v1/projects/{b.id}/items              → item
 */
const pLimit = require('p-limit');
const { apsRequest, withProjectPrefix, rawRequest } = require('./apsClient');

async function uploadOne(token, projectId, folderId, name, buffer) {
    const prefixed = withProjectPrefix(projectId);
    const api = apsRequest(token);

    // Step 1: storage reservation
    const storageRes = await api.post(
        `/data/v1/projects/${prefixed}/storage`,
        {
            jsonapi: { version: '1.0' },
            data: {
                type: 'objects',
                attributes: { name },
                relationships: { target: { data: { type: 'folders', id: folderId } } }
            }
        },
        { headers: { 'Content-Type': 'application/vnd.api+json' } }
    );
    const objectId = storageRes.data.data.id;
    const bucketKey = objectId.split(':')[3].split('/')[0];
    const objectName = objectId.split('/').slice(1).join('/');

    // Step 2: signed S3 upload URL
    const signUrl = `/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(objectName)}/signeds3upload`;
    const signRes = await api.get(signUrl);
    const { urls, uploadKey } = signRes.data;

    // Step 3: PUT to S3 (raw request: different host, no Bearer token).
    // rawRequest re-uses the keep-alive agents and retries on ECONNRESET.
    await rawRequest({
        method: 'put',
        url: urls[0],
        data: buffer,
        headers: { 'Content-Type': 'application/octet-stream' }
    });

    // Step 4: finalize
    await api.post(signUrl, { uploadKey }, { headers: { 'Content-Type': 'application/json' } });

    // Step 5: create item linking the storage object
    const itemRes = await api.post(
        `/data/v1/projects/${prefixed}/items`,
        {
            jsonapi: { version: '1.0' },
            data: {
                type: 'items',
                attributes: {
                    displayName: name,
                    extension: { type: 'items:autodesk.bim360:File', version: '1.0' }
                },
                relationships: {
                    tip: { data: { type: 'versions', id: '1' } },
                    parent: { data: { type: 'folders', id: folderId } }
                }
            },
            included: [
                {
                    type: 'versions',
                    id: '1',
                    attributes: {
                        name,
                        extension: { type: 'versions:autodesk.bim360:File', version: '1.0' }
                    },
                    relationships: { storage: { data: { type: 'objects', id: objectId } } }
                }
            ]
        },
        { headers: { 'Content-Type': 'application/vnd.api+json' } }
    );

    return itemRes.data.data.id;
}

/**
 * Parallelized upload. `items` = [{ name, buffer }].
 * Returns per-item results in the same order.
 */
async function uploadMany(token, projectId, folderId, items, { concurrency = 4 } = {}) {
    const limit = pLimit(concurrency);
    return Promise.all(
        items.map((it) =>
            limit(async () => {
                try {
                    const itemId = await uploadOne(token, projectId, folderId, it.name, it.buffer);
                    return { name: it.name, status: 'success', itemId };
                } catch (err) {
                    const msg = err.response?.data?.errors?.[0]?.detail
                        || err.response?.data?.message
                        || err.message;
                    return { name: it.name, status: 'error', error: msg };
                }
            })
        )
    );
}

module.exports = { uploadOne, uploadMany };
