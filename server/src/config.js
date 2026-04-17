const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const required = ['APS_CLIENT_ID', 'APS_CLIENT_SECRET', 'APS_CALLBACK_URL', 'SESSION_SECRET'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
    console.error(`\n[config] Missing required env vars: ${missing.join(', ')}`);
    console.error('[config] Copy .env.example to .env and fill in the values.\n');
    process.exit(1);
}

if (Buffer.byteLength(process.env.SESSION_SECRET, 'utf8') < 24) {
    console.error('[config] SESSION_SECRET must be at least 24 bytes of entropy.');
    process.exit(1);
}

const isProd = process.env.NODE_ENV === 'production';

module.exports = {
    port: parseInt(process.env.PORT, 10) || 8080,
    aps: {
        clientId: process.env.APS_CLIENT_ID,
        clientSecret: process.env.APS_CLIENT_SECRET,
        callbackUrl: process.env.APS_CALLBACK_URL,
        authUrl: 'https://developer.api.autodesk.com/authentication/v2',
        baseUrl: 'https://developer.api.autodesk.com',
        scopes: 'data:read data:write data:create viewables:read'
    },
    session: {
        secret: process.env.SESSION_SECRET,
        // Local dev runs over HTTP; behind a TLS-terminating proxy (Azure, Fly, etc.)
        // set NODE_ENV=production so secure cookies are used.
        secure: isProd
    },
    // The paste-a-token login path is a convenience for development only.
    // Disabled by default. Set ALLOW_TOKEN_LOGIN=1 in .env to re-enable.
    // It is force-disabled in production regardless.
    allowTokenLogin: !isProd && process.env.ALLOW_TOKEN_LOGIN === '1'
};
