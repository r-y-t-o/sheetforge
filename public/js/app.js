// Top-level orchestration. State lives here; the other modules are pure UI.

const state = {
    source: null,
    target: null,
    deliveryMode: 'acc',
    sheetsData: null,
    exportId: null,
    extractedFiles: null
};

document.addEventListener('DOMContentLoaded', async () => {
    // Auth status
    let status = null;
    try { status = await api.get('/api/auth/status'); } catch { /* network error — treat as logged out */ }

    // Reveal the token-login block only if the server permits it.
    if (status?.token_login_enabled) document.getElementById('token-login-block').classList.remove('hidden');

    if (status?.authenticated) showApp(status.login_method);
    else showLogin();

    // URL error hint
    const params = new URLSearchParams(location.search);
    if (params.get('error')) {
        const map = {
            state_mismatch: 'Login aborted — security check failed. Please try again.',
            auth_failed:    'Authentication failed. Please try again.',
            no_code:        'Autodesk did not return an authorization code.'
        };
        const e = document.getElementById('login-error');
        e.textContent = map[params.get('error')] || 'Authentication failed.';
        e.classList.remove('hidden');
        history.replaceState({}, '', '/');
    }

    document.getElementById('token-login-btn')?.addEventListener('click', handleTokenLogin);
    document.getElementById('token-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleTokenLogin();
    });
    document.getElementById('logout-btn').addEventListener('click', () => (location.href = '/auth/logout'));

    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch {}
    });

    document.querySelectorAll('input[name="delivery"]').forEach((r) => {
        r.addEventListener('change', (e) => {
            state.deliveryMode = e.target.value;
            document.getElementById('target-section').style.display =
                state.deliveryMode === 'zip' ? 'none' : '';
            updateRunButton();
        });
    });
    document.getElementById('run-btn').addEventListener('click', handleRun);

    naming.init({ onChange: () => { /* preview auto-updates */ } });
});

function showLogin() {
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('app-screen').classList.remove('active');
}
function showApp(method) {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('app-screen').classList.add('active');
    document.getElementById('auth-badge').textContent = method === 'oauth' ? 'Autodesk' : 'Token';
    mountTree('source-tree', 'source', handleSourceSelect);
}

async function handleTokenLogin() {
    const token = document.getElementById('token-input').value.trim();
    if (!token) return;
    try {
        await api.post('/auth/token-login', { access_token: token });
        showApp('token');
    } catch (err) {
        const e = document.getElementById('login-error');
        e.textContent = err.message;
        e.classList.remove('hidden');
    }
}

async function handleSourceSelect(sel) {
    state.source = sel;
    const el = document.getElementById('selected-source');
    el.textContent = sel.name;
    el.classList.remove('hidden');

    if (!sel.versionUrn) {
        el.textContent = `${sel.name} — no version URN found, cannot export`;
        return;
    }

    document.getElementById('params-card').hidden = false;
    document.getElementById('params-ui').classList.add('hidden');
    const status = document.getElementById('sheets-status');
    status.textContent = 'Translating model + reading sheet parameters (this can take a minute on first run)…';
    try {
        const data = await api.post('/api/metadata/sheets', { versionUrn: sel.versionUrn });
        state.sheetsData = data;
        status.textContent = `Loaded ${data.sheets.length} sheet(s); ${data.parameterKeys.length} parameter(s) available.`;
        naming.setData(data.parameterKeys, data.sheets);
        document.getElementById('params-ui').classList.remove('hidden');
        document.getElementById('arrange-card').hidden = false;
        document.getElementById('delivery-card').hidden = false;

        if (!document.getElementById('target-tree').dataset.mounted) {
            mountTree('target-tree', 'target', handleTargetSelect);
            document.getElementById('target-tree').dataset.mounted = '1';
        }
        updateRunButton();
    } catch (err) {
        status.textContent = `Failed to load sheets: ${err.message}`;
    }
}

function handleTargetSelect(sel) {
    state.target = sel;
    const el = document.getElementById('selected-target');
    el.textContent = sel.name;
    el.classList.remove('hidden');
    updateRunButton();
}

function updateRunButton() {
    const btn = document.getElementById('run-btn');
    const label = document.getElementById('run-btn-label');
    const needsTarget = state.deliveryMode !== 'zip';
    const ready = state.source?.versionUrn && state.sheetsData && (!needsTarget || state.target);
    btn.disabled = !ready;
    label.textContent = state.deliveryMode === 'zip'
        ? 'Download ZIP'
        : state.deliveryMode === 'both'
            ? 'Upload to ACC + Download ZIP'
            : 'Upload to ACC';
}

async function handleRun() {
    const btn = document.getElementById('run-btn');
    const progress = document.getElementById('progress');
    const fill = document.getElementById('progress-fill');
    const text = document.getElementById('progress-text');
    const result = document.getElementById('result');
    btn.disabled = true;
    progress.classList.remove('hidden');
    result.classList.add('hidden');
    fill.style.width = '5%';
    text.textContent = 'Triggering export…';

    try {
        const trig = await api.post('/api/export/trigger', {
            projectId: state.source.projectId,
            versionUrns: [state.source.versionUrn]
        });
        const exportId = trig.id || trig.exportId;
        state.exportId = exportId;
        fill.style.width = '15%';
        text.textContent = 'Export running on ACC…';

        let doneData;
        for (let i = 0; i < 120; i++) {
            await sleep(5000);
            const s = await api.get(`/api/export/${state.source.projectId}/${exportId}/status`);
            const st = (s.status || '').toLowerCase();
            if (['successful', 'completed', 'success', 'partialsuccess'].includes(st)) {
                doneData = s; break;
            }
            if (st === 'failed') throw new Error(s.result?.error?.message || 'Export failed');
            fill.style.width = (15 + Math.min(i, 40)) + '%';
            text.textContent = `Export running (${st || 'pending'})…`;
        }
        if (!doneData) throw new Error('Export timed out');
        const signedUrl = doneData.result?.output?.signedUrl || doneData.signedUrl || doneData.downloadUrl;

        fill.style.width = '60%';
        text.textContent = 'Downloading + extracting PDFs…';
        const ext = await api.post('/api/export/extract', { signedUrl, exportId });
        state.extractedFiles = ext.files;

        fill.style.width = '75%';
        text.textContent = 'Computing renames…';
        const cfg = naming.getConfig();
        const prev = await api.post('/api/export/preview', {
            exportId, versionUrn: state.source.versionUrn,
            pattern: cfg.pattern, separators: cfg.separators, placeholder: cfg.placeholder
        });
        renderFileTable(prev.rows);

        const mode = state.deliveryMode;
        const fileIds = getCheckedFileIds();

        if (mode === 'acc' || mode === 'both') {
            fill.style.width = '85%';
            text.textContent = 'Uploading renamed PDFs to ACC…';
            const up = await api.post('/api/upload/acc', {
                exportId,
                versionUrn: state.source.versionUrn,
                fileIds,
                pattern: cfg.pattern, separators: cfg.separators, placeholder: cfg.placeholder,
                targetProjectId: state.target.projectId,
                targetFolderId: state.target.folderId
            });
            applyUploadStatuses(up.results);
            result.className = 'alert ' + (up.successCount === up.totalCount ? 'alert-success' : 'alert-error');
            result.textContent = `Uploaded ${up.successCount}/${up.totalCount} to ${state.target.name}`;
            result.classList.remove('hidden');
        }

        if (mode === 'zip' || mode === 'both') {
            fill.style.width = '95%';
            text.textContent = 'Building ZIP…';
            await downloadZip(exportId, state.source.versionUrn, cfg, fileIds);
            if (mode === 'zip') {
                result.className = 'alert alert-success';
                result.textContent = 'Downloaded renamed PDFs as ZIP.';
                result.classList.remove('hidden');
            }
        }

        fill.style.width = '100%';
        text.textContent = 'Done';
    } catch (err) {
        console.error(err);
        result.className = 'alert alert-error';
        result.textContent = err.message;
        result.classList.remove('hidden');
    } finally {
        btn.disabled = false;
    }
}

function renderFileTable(rows) {
    const wrap = document.getElementById('file-table-wrap');
    wrap.classList.remove('hidden');
    const tbody = wrap.querySelector('tbody');
    tbody.innerHTML = '';
    rows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.dataset.fileId = row.id;
        tr.innerHTML = `
            <td><input type="checkbox" class="row-cb" checked /></td>
            <td>${escapeHtml(row.oldName)}</td>
            <td>${escapeHtml(row.newName)}</td>
            <td>${row.matchedSheet ? escapeHtml(row.matchedSheet.sheetNumber + ' — ' + row.matchedSheet.sheetName) : '<span class="muted">no match</span>'}</td>
            <td class="status-col status-pending">—</td>
        `;
        tbody.appendChild(tr);
    });
    document.getElementById('select-all').onchange = (e) => {
        tbody.querySelectorAll('.row-cb').forEach((cb) => (cb.checked = e.target.checked));
    };
}

function getCheckedFileIds() {
    return [...document.querySelectorAll('#file-table tbody tr')]
        .filter((tr) => tr.querySelector('.row-cb').checked)
        .map((tr) => tr.dataset.fileId);
}

function applyUploadStatuses(results) {
    const rows = [...document.querySelectorAll('#file-table tbody tr')]
        .filter((tr) => tr.querySelector('.row-cb').checked);
    results.forEach((r, i) => {
        const cell = rows[i]?.querySelector('.status-col');
        if (!cell) return;
        cell.textContent = r.status === 'success' ? '✓ uploaded' : `✗ ${r.error || 'error'}`;
        cell.className = 'status-col ' + (r.status === 'success' ? 'status-success' : 'status-error');
    });
}

async function downloadZip(exportId, versionUrn, cfg, fileIds) {
    const r = await fetch('/api/export/zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            exportId, versionUrn,
            pattern: cfg.pattern, separators: cfg.separators, placeholder: cfg.placeholder,
            fileIds
        })
    });
    if (!r.ok) throw new Error('ZIP download failed');
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sheets.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}
