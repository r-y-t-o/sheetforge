const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');

const config = require('./config');
const { errorHandler } = require('./middleware/error');
const {
    securityHeaders, sameOriginGuard, authRateLimit, apiRateLimit
} = require('./middleware/security');

const authRouter = require('./routes/auth');
const dataRouter = require('./routes/data');
const metadataRouter = require('./routes/metadata');
const exportRouter = require('./routes/export');
const uploadRouter = require('./routes/upload');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Security headers first so they apply to every response, even error pages.
app.use(securityHeaders);

// Body size intentionally modest — no endpoint needs more.
app.use(express.json({ limit: '256kb' }));

// Harden the session cookie. __Host- prefix requires Secure + Path=/ + no Domain.
const cookieName = config.session.secure ? '__Host-spc_session' : 'spc_session';
app.use(cookieSession({
    name: cookieName,
    keys: [config.session.secret],
    maxAge: 8 * 60 * 60 * 1000, // 8h; trimmed from 24h
    httpOnly: true,
    // 'lax' is required for the OAuth redirect back from Autodesk — the
    // callback hits us as a cross-site top-level GET and the session cookie
    // must still be readable. 'strict' would drop oauth_state and break login.
    sameSite: 'lax',
    secure: config.session.secure,
    path: '/'
}));

// CSRF defence: reject cross-origin state-changing requests.
app.use(sameOriginGuard);

// Static SPA.
app.use(express.static(path.resolve(__dirname, '..', '..', 'public'), {
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff')
}));

// Routes with per-group rate limits.
app.use('/auth', authRateLimit, authRouter);
app.use('/api/auth', authRateLimit, authRouter);
app.use('/api', apiRateLimit, dataRouter);
app.use('/api/metadata', apiRateLimit, metadataRouter);
app.use('/api/export', apiRateLimit, exportRouter);
app.use('/api/upload', apiRateLimit, uploadRouter);

app.use(errorHandler);

const server = app.listen(config.port, () => {
    console.log(`\n  SheetForge listening on http://localhost:${config.port}\n`);
});

// Long operations — an ACC upload of many sheets is ~5 Autodesk calls per
// sheet, parallelised at concurrency 4. Node's default 5-minute request
// timeout (since Node 18) would cut these connections off with ECONNRESET
// before the browser got a reply. Allow up to 30 minutes per request.
server.requestTimeout   = 30 * 60 * 1000;   // 30 min total request time
server.headersTimeout   = 31 * 60 * 1000;   // must exceed requestTimeout
server.keepAliveTimeout = 120 * 1000;       // 2 min idle keep-alive
server.timeout          = 0;                // no legacy socket inactivity timeout
