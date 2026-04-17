/**
 * ACC Construction Files Export: trigger a sheet-PDF export for a Revit
 * version, poll to completion, download the resulting ZIP and cache the
 * individual PDFs in memory keyed by exportId.
 */
const AdmZip = require('adm-zip');
const path = require('path');
const { apsRequest, stripProjectPrefix, rawRequest } = require('./apsClient');

// exportId -> { files: Map<fileId,{name,buffer,size,isPdf,entryName}>, createdAt }
const exportCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;

async function triggerExport(token, projectId, versionUrns) {
    const raw = stripProjectPrefix(projectId);
    const r = await apsRequest(token).post(
        `/construction/files/v1/projects/${raw}/exports`,
        { fileVersions: versionUrns },
        { headers: { 'Content-Type': 'application/json' } }
    );
    return r.data;
}

async function getExportStatus(token, projectId, exportId) {
    const raw = stripProjectPrefix(projectId);
    const r = await apsRequest(token).get(
        `/construction/files/v1/projects/${raw}/exports/${exportId}`
    );
    return r.data;
}

async function downloadAndExtract(signedUrl, exportId) {
    // rawRequest gives us keep-alive + retry on ECONNRESET.
    const resp = await rawRequest({ method: 'get', url: signedUrl, responseType: 'arraybuffer' });
    const buf = Buffer.from(resp.data);
    const zip = new AdmZip(buf);
    const files = new Map();
    const manifest = [];

    for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue;
        const entryName = entry.entryName;
        const name = path.basename(entryName);
        const fileId = Buffer.from(entryName).toString('base64url');
        const data = entry.getData();
        const isPdf = name.toLowerCase().endsWith('.pdf');
        files.set(fileId, { name, entryName, buffer: data, size: data.length, isPdf });
        manifest.push({ id: fileId, name, entryName, size: data.length, isPdf });
    }

    exportCache.set(exportId, { files, createdAt: Date.now() });
    // Schedule TTL cleanup.
    setTimeout(() => exportCache.delete(exportId), CACHE_TTL_MS).unref?.();
    return manifest;
}

function getCached(exportId) {
    return exportCache.get(exportId);
}

function getFile(exportId, fileId) {
    return exportCache.get(exportId)?.files.get(fileId) || null;
}

module.exports = {
    triggerExport,
    getExportStatus,
    downloadAndExtract,
    getCached,
    getFile
};
