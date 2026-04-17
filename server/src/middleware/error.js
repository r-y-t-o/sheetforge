/**
 * Central error handler. Wrap async route handlers with `asyncHandler` and throw
 * or reject — we'll normalize the response here.
 */
function errorHandler(err, req, res, _next) {
    // axios error?
    if (err.response) {
        const status = err.response.status || 500;
        const data = err.response.data;
        console.error(`[api:${status}]`, req.method, req.originalUrl, '→', JSON.stringify(data)?.slice(0, 500));
        const payload = {
            error: data?.errorMessage || data?.detail || data?.message || err.message
        };
        // Only echo raw upstream bodies in development — they can leak internals.
        if (process.env.NODE_ENV !== 'production') payload.details = data;
        return res.status(status).json(payload);
    }
    console.error('[error]', req.method, req.originalUrl, err.stack || err.message);
    res.status(500).json({ error: err.message || 'Internal server error' });
}

function asyncHandler(fn) {
    return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { errorHandler, asyncHandler };
