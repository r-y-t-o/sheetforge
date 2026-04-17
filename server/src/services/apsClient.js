const axios = require('axios');
const http = require('http');
const https = require('https');
const config = require('../config');

/**
 * Strip the `b.` prefix that Data Management API adds to project IDs.
 * Construction Files / OSS APIs use the raw ID.
 */
function stripProjectPrefix(projectId) {
    return projectId && projectId.startsWith('b.') ? projectId.substring(2) : projectId;
}

/**
 * Ensure a projectId has the `b.` prefix (for Data Management endpoints).
 */
function withProjectPrefix(projectId) {
    if (!projectId) return projectId;
    return projectId.startsWith('b.') ? projectId : `b.${projectId}`;
}

/**
 * Refresh a 3-legged access token using its refresh token. Called automatically
 * from authMiddleware when the token is about to expire.
 */
async function refreshAccessToken(refreshToken) {
    const res = await axios.post(
        `${config.aps.authUrl}/token`,
        new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: config.aps.clientId,
            client_secret: config.aps.clientSecret,
            scope: config.aps.scopes
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    return {
        access_token: res.data.access_token,
        refresh_token: res.data.refresh_token || refreshToken,
        expires_at: Date.now() + res.data.expires_in * 1000
    };
}

// ---- Transport hardening ------------------------------------------------

// Keep-alive + modest pool so repeated calls to developer.api.autodesk.com
// reuse sockets instead of re-handshaking every time. Idle sockets are dropped
// after 30 s which matches Autodesk's typical keep-alive window.
const httpAgent  = new http.Agent({  keepAlive: true, keepAliveMsecs: 10_000, maxSockets: 32 });
const httpsAgent = new https.Agent({ keepAlive: true, keepAliveMsecs: 10_000, maxSockets: 32 });

const TRANSIENT_CODES = new Set([
    'ECONNRESET', 'ECONNABORTED', 'ETIMEDOUT', 'EAI_AGAIN',
    'EPIPE', 'ENOTFOUND', 'ENETUNREACH', 'ECONNREFUSED'
]);
const TRANSIENT_HTTP_STATUS = new Set([502, 503, 504]);

function isTransient(err) {
    if (!err) return false;
    if (err.code && TRANSIENT_CODES.has(err.code)) return true;
    if (err.response && TRANSIENT_HTTP_STATUS.has(err.response.status)) return true;
    // axios wraps socket errors sometimes with code buried in err.cause.
    if (err.cause && err.cause.code && TRANSIENT_CODES.has(err.cause.code)) return true;
    return false;
}

/**
 * Return a promise that retries the given axios request up to `maxRetries`
 * times on transient errors, with exponential backoff + jitter.
 *
 * Retrying non-GET/HEAD requests is usually unsafe, but ECONNRESET on a POST
 * at the TCP level means the server never saw the request, so it's safe.
 * We only retry POST/PUT when the error is a transport error (err.code set);
 * we do NOT retry 5xx responses for non-idempotent methods, because the
 * server may have applied the side effect.
 */
async function requestWithRetry(instance, cfg, maxRetries = 3) {
    const isIdempotent = !cfg.method || /^(get|head|options)$/i.test(cfg.method);
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            return await instance.request(cfg);
        } catch (err) {
            const transient = isTransient(err);
            const isTransportError = !!err.code || !!err.cause?.code;
            const retryable = transient && (isIdempotent || isTransportError);
            if (!retryable || attempt >= maxRetries) throw err;
            const backoff = Math.min(4000, 250 * 2 ** attempt) + Math.floor(Math.random() * 150);
            attempt++;
            console.warn(`[aps] retrying ${cfg.method || 'GET'} ${cfg.url} (attempt ${attempt}) after ${err.code || err.response?.status}`);
            await new Promise((r) => setTimeout(r, backoff));
        }
    }
}

/**
 * Build an authenticated axios instance bound to a session access token.
 * Adds keep-alive + transparent retry on transient network/5xx errors.
 */
function apsRequest(token) {
    const instance = axios.create({
        baseURL: config.aps.baseUrl,
        headers: { Authorization: `Bearer ${token}` },
        timeout: 60_000,
        httpAgent,
        httpsAgent,
        maxBodyLength: Infinity,
        maxContentLength: Infinity
    });

    // Wrap the common verb helpers so every call goes through retry. We keep
    // .request() around for advanced callers.
    const wrap = (method) => (url, ...rest) => {
        let data, cfg;
        if (method === 'get' || method === 'head' || method === 'delete' || method === 'options') {
            cfg = rest[0] || {};
        } else {
            data = rest[0];
            cfg = rest[1] || {};
        }
        return requestWithRetry(instance, { ...cfg, method, url, data });
    };

    return {
        request: (cfg) => requestWithRetry(instance, cfg),
        get:     wrap('get'),
        post:    wrap('post'),
        put:     wrap('put'),
        patch:   wrap('patch'),
        delete:  wrap('delete'),
        head:    wrap('head'),
        options: wrap('options')
    };
}

/**
 * Raw axios with keep-alive + retry, useful for S3 PUT uploads that hit a
 * non-Autodesk host (so shouldn't have the Bearer token attached).
 */
const rawAxios = axios.create({
    timeout: 120_000, // uploads can be bigger
    httpAgent, httpsAgent,
    maxBodyLength: Infinity,
    maxContentLength: Infinity
});
function rawRequest(cfg) { return requestWithRetry(rawAxios, cfg); }

module.exports = {
    stripProjectPrefix,
    withProjectPrefix,
    refreshAccessToken,
    apsRequest,
    rawRequest
};
