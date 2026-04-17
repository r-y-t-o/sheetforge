const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const config = require('../config');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();

// 3-legged OAuth: redirect to Autodesk consent screen with a signed state parameter.
router.get('/login', (req, res) => {
    const state = crypto.randomBytes(32).toString('base64url');
    req.session.oauth_state = state;
    const url =
        `${config.aps.authUrl}/authorize` +
        `?response_type=code` +
        `&client_id=${encodeURIComponent(config.aps.clientId)}` +
        `&redirect_uri=${encodeURIComponent(config.aps.callbackUrl)}` +
        `&scope=${encodeURIComponent(config.aps.scopes)}` +
        `&state=${encodeURIComponent(state)}`;
    res.redirect(url);
});

// OAuth callback: exchange auth code for tokens and write them to the session.
router.get('/callback', asyncHandler(async (req, res) => {
    const code = req.query.code;
    const state = req.query.state;
    if (!code) return res.redirect('/?error=no_code');

    // Constant-time comparison to mitigate timing leaks on state validation.
    const expected = req.session.oauth_state;
    const valid = expected && typeof state === 'string' && state.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expected));
    req.session.oauth_state = null;
    if (!valid) return res.redirect('/?error=state_mismatch');

    try {
        const tokenRes = await axios.post(
            `${config.aps.authUrl}/token`,
            new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                client_id: config.aps.clientId,
                client_secret: config.aps.clientSecret,
                redirect_uri: config.aps.callbackUrl
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        req.session.access_token = tokenRes.data.access_token;
        req.session.refresh_token = tokenRes.data.refresh_token;
        req.session.expires_at = Date.now() + tokenRes.data.expires_in * 1000;
        req.session.login_method = 'oauth';
        res.redirect('/');
    } catch (err) {
        // Never log the raw token response.
        console.error('[auth/callback] token exchange failed:', err.response?.status || err.code || err.message);
        res.redirect('/?error=auth_failed');
    }
}));

// Manual token login — dev-only, gated behind ALLOW_TOKEN_LOGIN. Returns 404
// when disabled so the endpoint is effectively invisible.
router.post('/token-login', (req, res) => {
    if (!config.allowTokenLogin) return res.status(404).json({ error: 'Not found' });
    const { access_token } = req.body || {};
    if (typeof access_token !== 'string' || !access_token.trim() || access_token.length > 4096) {
        return res.status(400).json({ error: 'Access token is required' });
    }
    req.session.access_token = access_token.trim();
    req.session.expires_at = Date.now() + 60 * 60 * 1000;
    req.session.login_method = 'token';
    res.json({ status: 'ok' });
});

router.get('/logout', (req, res) => {
    req.session = null;
    res.redirect('/');
});

// Lightweight status endpoint for the frontend.
router.get('/status', (req, res) => {
    if (req.session && req.session.access_token) {
        return res.json({
            authenticated: true,
            login_method: req.session.login_method || 'unknown',
            expires_at: req.session.expires_at,
            token_login_enabled: config.allowTokenLogin
        });
    }
    res.json({ authenticated: false, token_login_enabled: config.allowTokenLogin });
});

module.exports = router;
