// Thin fetch wrapper with JSON + error handling.
const api = {
    async get(url) {
        const r = await fetch(url);
        if (!r.ok) throw new Error((await r.json()).error || `GET ${url} failed`);
        return r.json();
    },
    async post(url, body) {
        const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {})
        });
        if (!r.ok) {
            let msg;
            try { msg = (await r.json()).error; } catch { msg = r.statusText; }
            throw new Error(msg || `POST ${url} failed`);
        }
        return r.json();
    }
};

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
