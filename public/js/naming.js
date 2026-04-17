// Two-phase filename builder.
//
// Phase 1 (Step 2 in the UI) — parameter picker:
//   User toggles which parameters to include. Output: `selected[]`.
//
// Phase 2 (Step 3 in the UI) — arrange + separators:
//   User drags the selected parameters into order and drops '-' or '_'
//   separator tiles from a tray between them. Internally the pattern row
//   is a flat list of tokens:
//       { type: 'field', key: string }
//       { type: 'sep',   ch:  '-' | '_' }
//
// The backend (unchanged contract) expects:
//       pattern:    string[]   (field keys, in order)
//       separators: string[]   (separators[i] sits between pattern[i] and [i+1])
// If the user drops no separator between two fields, separators[i] === ''.
// Multiple separator tokens between fields concatenate: '-' + '_'  →  '-_'.

const naming = (function () {
    const state = {
        available: [],        // all parameter keys
        selected: new Set(),  // keys the user has ticked in Step 2
        tokens: [],           // Step 3 token list
        sheets: [],
        onChange: () => {}
    };

    // ----- Public API -----
    function init(opts) {
        state.onChange = opts.onChange || (() => {});
        document.getElementById('placeholder-input').addEventListener('input', () => {
            renderPreview(); state.onChange();
        });
        document.getElementById('params-clear').addEventListener('click', () => {
            state.selected.clear();
            syncTokensFromSelection();
            renderAll();
            state.onChange();
        });

        installSeparatorDragHandlers();
        installPatternDropHandlers();
    }

    function setData(parameterKeys, sheetList, defaultPattern) {
        state.available = parameterKeys.slice();
        state.sheets = sheetList;

        const defaults = (defaultPattern && defaultPattern.length)
            ? defaultPattern
            : ['Sheet.Sheet Number', 'Sheet.Sheet Name'];
        state.selected = new Set(defaults.filter((k) => state.available.includes(k)));

        state.tokens = [];
        const sel = [...state.selected];
        sel.forEach((k, i) => {
            state.tokens.push({ type: 'field', key: k });
            if (i < sel.length - 1) state.tokens.push({ type: 'sep', ch: '-' });
        });

        renderAll();
    }

    function getConfig() {
        // Compress tokens into pattern[] + separators[].
        const pattern = [];
        const separators = [];
        let pendingSep = '';
        for (const t of state.tokens) {
            if (t.type === 'field') {
                if (pattern.length > 0) separators.push(pendingSep);
                pattern.push(t.key);
                pendingSep = '';
            } else {
                pendingSep += t.ch;
            }
        }
        return {
            pattern,
            separators,
            placeholder: document.getElementById('placeholder-input').value || ''
        };
    }

    // ----- Rendering -----
    function renderAll() {
        renderParamGroups();
        renderSelectedCount();
        renderPattern();
        renderPreview();
    }

    function renderParamGroups() {
        const host = document.getElementById('param-groups');
        host.innerHTML = '';

        // Group by leading namespace (Sheet. / TitleBlock. / else).
        const groups = {};
        state.available.forEach((k) => {
            const ns = k.includes('.') ? k.split('.')[0] : 'Other';
            (groups[ns] = groups[ns] || []).push(k);
        });
        const order = ['Sheet', 'TitleBlock', ...Object.keys(groups).filter((x) => x !== 'Sheet' && x !== 'TitleBlock')];

        order.forEach((ns) => {
            if (!groups[ns]) return;
            const wrap = document.createElement('div');
            const title = document.createElement('div');
            title.className = 'param-group-title';
            title.textContent = ns;
            const chips = document.createElement('div');
            chips.className = 'param-chips';
            groups[ns].sort().forEach((key) => chips.appendChild(buildParamChip(key)));
            wrap.append(title, chips);
            host.appendChild(wrap);
        });
    }

    function buildParamChip(key) {
        const el = document.createElement('span');
        el.className = 'param-chip' + (state.selected.has(key) ? ' selected' : '');
        el.innerHTML = `<span class="chip-check">${icons.render('check')}</span><span>${escapeHtml(shortLabel(key))}</span>`;
        el.title = key;
        el.addEventListener('click', () => {
            if (state.selected.has(key)) state.selected.delete(key);
            else state.selected.add(key);
            syncTokensFromSelection();
            renderAll();
            state.onChange();
        });
        return el;
    }

    function shortLabel(key) {
        const i = key.indexOf('.');
        return i >= 0 ? key.slice(i + 1) : key;
    }

    function renderSelectedCount() {
        const n = state.selected.size;
        document.getElementById('selected-count').textContent = `${n} selected`;
    }

    // When the Step-2 selection changes, add/remove matching field tokens in
    // the Step-3 pattern while leaving existing order + separators intact.
    function syncTokensFromSelection() {
        // Remove field tokens for deselected keys (and prune orphan separators).
        state.tokens = state.tokens.filter((t) => t.type === 'sep' || state.selected.has(t.key));
        collapseLeadingTrailingSeps();

        // Append any newly-selected keys to the end with a '-' before them.
        const inTokens = new Set(state.tokens.filter((t) => t.type === 'field').map((t) => t.key));
        state.selected.forEach((k) => {
            if (!inTokens.has(k)) {
                if (state.tokens.some((t) => t.type === 'field')) state.tokens.push({ type: 'sep', ch: '-' });
                state.tokens.push({ type: 'field', key: k });
            }
        });
    }

    function collapseLeadingTrailingSeps() {
        while (state.tokens.length && state.tokens[0].type === 'sep') state.tokens.shift();
        while (state.tokens.length && state.tokens[state.tokens.length - 1].type === 'sep') state.tokens.pop();
    }

    // ----- Pattern row rendering + DnD -----
    function renderPattern() {
        const row = document.getElementById('pattern-row');
        row.innerHTML = '';

        // Leading gap
        row.appendChild(buildGap(0));

        state.tokens.forEach((tok, i) => {
            row.appendChild(buildToken(tok, i));
            row.appendChild(buildGap(i + 1));
        });
    }

    function buildToken(tok, idx) {
        const el = document.createElement('span');
        el.className = 'token ' + (tok.type === 'field' ? 'token-field' : 'token-sep');
        el.draggable = true;
        el.dataset.idx = idx;

        if (tok.type === 'field') {
            el.innerHTML =
                `<span class="token-handle">${icons.render('drag')}</span>` +
                `<span>${escapeHtml(shortLabel(tok.key))}</span>` +
                `<span class="token-close" title="Remove">${icons.render('x')}</span>`;
            el.querySelector('.token-close').addEventListener('click', (e) => {
                e.stopPropagation();
                state.selected.delete(tok.key);
                syncTokensFromSelection();
                renderAll();
                state.onChange();
            });
        } else {
            el.innerHTML =
                `<span>${tok.ch}</span>` +
                `<span class="token-close" title="Remove">${icons.render('x')}</span>`;
            el.querySelector('.token-close').addEventListener('click', (e) => {
                e.stopPropagation();
                state.tokens.splice(idx, 1);
                collapseLeadingTrailingSeps();
                renderPattern(); renderPreview();
                state.onChange();
            });
        }

        // Drag source (reorder within row).
        el.addEventListener('dragstart', (e) => {
            el.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('application/x-sf-token', String(idx));
            e.dataTransfer.setData('text/plain', shortLabel(tok.key || tok.ch));
        });
        el.addEventListener('dragend', () => el.classList.remove('dragging'));

        return el;
    }

    function buildGap(insertIndex) {
        const gap = document.createElement('span');
        gap.className = 'drop-gap';
        gap.dataset.insert = insertIndex;
        return gap;
    }

    // Compute which gap index the cursor is closest to. We use the gap
    // element centers so reorder/insert drops are predictable regardless
    // of how narrow each individual gap's hit box actually is.
    function computeInsertIndex(clientX, clientY) {
        const gaps = document.querySelectorAll('#pattern-row .drop-gap');
        if (!gaps.length) return 0;
        let bestIdx = 0, bestDist = Infinity;
        gaps.forEach((g) => {
            const r = g.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            // Weight Y more heavily than X so multi-row patterns pick the
            // correct row before picking within a row.
            const d = Math.abs(clientX - cx) + Math.abs(clientY - cy) * 3;
            if (d < bestDist) { bestDist = d; bestIdx = Number(g.dataset.insert); }
        });
        return bestIdx;
    }

    function highlightGap(idx) {
        document.querySelectorAll('#pattern-row .drop-gap').forEach((g) => {
            g.classList.toggle('active', Number(g.dataset.insert) === idx);
        });
    }

    function clearGapHighlight() {
        document.querySelectorAll('#pattern-row .drop-gap.active')
            .forEach((g) => g.classList.remove('active'));
    }

    function handleDrop(e, insertIndex) {
        // Case 1: reorder existing token
        const fromRaw = e.dataTransfer.getData('application/x-sf-token');
        if (fromRaw !== '') {
            const from = Number(fromRaw);
            if (!Number.isNaN(from)) {
                const [moved] = state.tokens.splice(from, 1);
                // Adjust insertion index if we removed something before it.
                const to = Math.max(0, insertIndex > from ? insertIndex - 1 : insertIndex);
                state.tokens.splice(to, 0, moved);
                collapseLeadingTrailingSeps();
                renderPattern(); renderPreview();
                state.onChange();
                return;
            }
        }
        // Case 2: new separator from the tray
        const sep = e.dataTransfer.getData('application/x-sf-sep');
        if (sep === '-' || sep === '_') {
            state.tokens.splice(insertIndex, 0, { type: 'sep', ch: sep });
            collapseLeadingTrailingSeps();
            renderPattern(); renderPreview();
            state.onChange();
        }
    }

    function installPatternDropHandlers() {
        const row = document.getElementById('pattern-row');
        // Unconditional preventDefault on dragenter+dragover so the browser
        // accepts the drop everywhere on the row. We compute the exact
        // insertion point from cursor XY rather than relying on per-gap
        // hit-testing (which was unreliable — thin gaps, pseudo-elements).
        row.addEventListener('dragenter', (e) => {
            e.preventDefault();
            row.classList.add('drag-active');
        });
        row.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect =
                e.dataTransfer.types && e.dataTransfer.types.length &&
                Array.from(e.dataTransfer.types).includes('application/x-sf-token')
                    ? 'move' : 'copy';
            row.classList.add('drag-active');
            highlightGap(computeInsertIndex(e.clientX, e.clientY));
        });
        row.addEventListener('dragleave', (e) => {
            // Only clear when we actually leave the row (not on child transitions).
            if (!row.contains(e.relatedTarget)) {
                row.classList.remove('drag-active');
                clearGapHighlight();
            }
        });
        row.addEventListener('drop', (e) => {
            e.preventDefault();
            row.classList.remove('drag-active');
            clearGapHighlight();
            handleDrop(e, computeInsertIndex(e.clientX, e.clientY));
        });
    }

    function installSeparatorDragHandlers() {
        document.querySelectorAll('.sep-tile').forEach((tile) => {
            tile.addEventListener('dragstart', (e) => {
                tile.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('application/x-sf-sep', tile.dataset.sep);
                e.dataTransfer.setData('text/plain', tile.dataset.sep);
            });
            tile.addEventListener('dragend', () => tile.classList.remove('dragging'));
        });
    }

    // ----- Preview -----
    function renderPreview() {
        const el = document.getElementById('preview-list');
        el.innerHTML = '';
        const cfg = getConfig();
        if (!state.sheets.length) {
            el.innerHTML = '<li class="muted">No sheets to preview.</li>';
            return;
        }
        if (!cfg.pattern.length) {
            el.innerHTML = '<li class="muted">Pick at least one parameter.</li>';
            return;
        }
        state.sheets.slice(0, 5).forEach((s) => {
            const li = document.createElement('li');
            li.textContent = renderOne(cfg, s);
            el.appendChild(li);
        });
    }

    function sanitize(s) {
        return String(s)
            .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/[.\s]+$/g, '') || 'sheet';
    }

    function renderOne(cfg, sheet) {
        const parts = [];
        const activeSeps = [];
        for (let i = 0; i < cfg.pattern.length; i++) {
            const v = sheet.parameters?.[cfg.pattern[i]];
            const str = v == null || v === '' ? cfg.placeholder : String(v);
            if (str !== '') {
                if (parts.length > 0) activeSeps.push(cfg.separators[i - 1] || '');
                parts.push(str);
            }
        }
        let base = '';
        for (let i = 0; i < parts.length; i++) {
            if (i > 0) base += activeSeps[i - 1];
            base += parts[i];
        }
        return sanitize(base) + '.pdf';
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    return { init, setData, getConfig };
})();
