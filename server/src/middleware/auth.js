const { refreshAccessToken } = require('../services/apsClient');

// Refresh a 3-legged token when fewer than this many ms remain before expiry.
const REFRESH_WINDOW_MS = 2 * 60 * 1000;

async function authMiddleware(req, res, next) {
    if (!req.session || !req.session.access_token) {
        return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }

    // Opportunistic refresh for OAuth sessions.
    const expiresAt = req.session.expires_at || 0;
    const soonExpiring = expiresAt - Date.now() < REFRESH_WINDOW_MS;
    if (soonExpiring && req.session.refresh_token && req.session.login_method === 'oauth') {
        try {
            const refreshed = await refreshAccessToken(req.session.refresh_token);
            req.session.access_token = refreshed.access_token;
            req.session.refresh_token = refreshed.refresh_token;
            req.session.expires_at = refreshed.expires_at;
        } catch (err) {
            console.warn('[auth] Token refresh failed, user will need to re-login:', err.response?.data || err.message);
            return res.status(401).json({ error: 'Session expired. Please log in again.' });
        }
    }

    next();
}

module.exports = authMiddleware;
