/**
 * Security middleware — security headers, same-origin check for state-changing
 * requests (CSRF defence), and a simple in-memory sliding-window rate limiter.
 *
 * No external dependencies. Designed for a single-process deployment; if the
 * app is ever scaled horizontally, swap the rate-limit store for Redis.
 */

function securityHeaders(req, res, next) {
    // Content-Security-Policy: strict same-origin. All scripts are served from
    // /public as external files — no inline <script> is allowed.
    const csp = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "form-action 'self' https://developer.api.autodesk.com",
        "base-uri 'self'",
        "object-src 'none'"
    ].join('; ');
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }
    next();
}

/**
 * Same-origin check for state-changing methods. The OAuth callback (`GET`) is
 * exempt by virtue of being a GET. POSTs from other origins are rejected.
 */
function sameOriginGuard(req, res, next) {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    const expected = `${req.protocol}://${req.get('host')}`;
    const origin = req.get('origin');
    const referer = req.get('referer');
    const matches = (u) => {
        if (!u) return false;
        try { return new URL(u).origin === expected; } catch { return false; }
    };
    if (matches(origin) || matches(referer)) return next();
    return res.status(403).json({ error: 'Cross-origin request blocked' });
}

/**
 * Sliding-window per-IP rate limit. `buckets` maps key → timestamp array.
 * Each call shifts old entries out of the window before checking the count.
 */
function createRateLimiter({ windowMs, max, scope }) {
    const buckets = new Map();
    return function rateLimit(req, res, next) {
        const key = `${scope}:${req.ip}`;
        const now = Date.now();
        const times = buckets.get(key) || [];
        const cutoff = now - windowMs;
        // Drop expired entries.
        let i = 0;
        while (i < times.length && times[i] < cutoff) i++;
        const windowed = times.slice(i);
        if (windowed.length >= max) {
            res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
            return res.status(429).json({ error: 'Too many requests — slow down.' });
        }
        windowed.push(now);
        buckets.set(key, windowed);
        // Opportunistic cleanup so the map can't grow unbounded.
        if (buckets.size > 10000) {
            for (const [k, v] of buckets) if (v[v.length - 1] < cutoff) buckets.delete(k);
        }
        next();
    };
}

module.exports = {
    securityHeaders,
    sameOriginGuard,
    // Auth endpoints: generous — login status is polled on every page load,
    // and the 60s window absorbs normal single-user activity.
    authRateLimit: createRateLimiter({ windowMs: 60_000, max: 120, scope: 'auth' }),
    // API endpoints: a single long export legitimately hits the status poll
    // every 5 s for up to 10 min = 120 calls, plus tree browsing, metadata,
    // and upload. 600/min leaves generous headroom for a single active user.
    apiRateLimit:  createRateLimiter({ windowMs: 60_000, max: 600, scope: 'api' })
};
