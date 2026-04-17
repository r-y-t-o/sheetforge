// Reusable ACC hub/project/folder tree. Callback fires when user picks a leaf
// appropriate for the tree's mode.
//   mode "source"  → select .rvt file versions (returns { projectId, itemId, versionUrn, name })
//   mode "target"  → select a folder (returns { projectId, folderId, name })

function renderTree(containerId, mode, onSelect) {
    const container = document.getElementById(containerId);
    container._onSelect = onSelect;
    container._mode = mode;
    container.innerHTML = '<div class="muted" style="padding:8px">Loading hubs…</div>';
    api.get('/api/hubs').then((data) => {
        container.innerHTML = '';
        data.data.forEach((hub) => {
            container.appendChild(buildNode({
                id: hub.id, label: hub.attributes.name, type: 'hub', mode
            }));
        });
    }).catch((err) => {
        container.innerHTML = `<div class="error">${err.message}</div>`;
    });
}

function getTreeCallback(node) {
    return node.closest('.tree')?._onSelect;
}

function buildNode({ id, label, type, mode, projectId, included }) {
    const node = document.createElement('div');
    node.className = 'tree-node';
    node.dataset.type = type;
    node.dataset.id = id;
    if (projectId) node.dataset.projectId = projectId;

    const row = document.createElement('div');
    row.className = 'tree-row';
    const caret = document.createElement('span');
    caret.className = 'tree-caret' + (type === 'file' ? ' empty' : '');
    caret.innerHTML = icons.render('chevron-right');
    const icon = document.createElement('span');
    icon.className = 'tree-icon';
    icon.innerHTML = icons.render({
        hub: 'hub', project: 'folder', folder: 'folder', file: 'document'
    }[type] || 'document');
    const text = document.createElement('span');
    text.className = 'tree-label';
    text.textContent = label;
    text.title = label;
    row.append(caret, icon, text);

    if (mode === 'target' && type === 'folder') {
        const select = document.createElement('span');
        select.className = 'tree-select';
        select.textContent = 'Select';
        select.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll(`#${node.closest('.tree').id} .tree-row.selected`).forEach((el) => el.classList.remove('selected'));
            row.classList.add('selected');
            const cb = getTreeCallback(node);
            if (cb) cb({ projectId: node.dataset.projectId, folderId: id, name: label });
        });
        row.appendChild(select);
    }

    const children = document.createElement('div');
    children.className = 'tree-children';

    row.addEventListener('click', async () => {
        if (mode === 'source' && type === 'file') {
            document.querySelectorAll(`#${node.closest('.tree').id} .tree-row.selected`).forEach((el) => el.classList.remove('selected'));
            row.classList.add('selected');
            let versionUrn = null;
            if (included) {
                const v = included.find((x) => x.relationships?.item?.data?.id === id);
                if (v) versionUrn = v.id;
            }
            const cb = getTreeCallback(node);
            if (cb) cb({ projectId: node.dataset.projectId, itemId: id, versionUrn, name: label });
            return;
        }
        if (type === 'file') return;
        const open = children.classList.toggle('open');
        caret.classList.toggle('open', open);
        // Swap folder icon to open variant for folders/projects.
        if (type === 'folder' || type === 'project') {
            icon.innerHTML = icons.render(open ? 'folder-open' : 'folder');
        }
        if (open && !children.dataset.loaded) {
            children.dataset.loaded = '1';
            await loadChildren(children, node, type, mode);
        }
    });

    node.append(row, children);
    return node;
}

async function loadChildren(children, parentNode, parentType, mode) {
    children.innerHTML = '<div class="muted" style="padding:4px 10px;font-size:11px">Loading…</div>';
    try {
        const parentId = parentNode.dataset.id;
        const projectId = parentNode.dataset.projectId || parentId;
        if (parentType === 'hub') {
            const data = await api.get(`/api/hubs/${parentId}/projects`);
            children.innerHTML = '';
            data.data.forEach((p) => children.appendChild(buildNode({
                id: p.id, label: p.attributes.name, type: 'project', mode,
                projectId: p.id
            })));
        } else if (parentType === 'project') {
            // Walk up to find hubId.
            let hub = parentNode.parentElement?.closest('.tree-node[data-type="hub"]');
            const hubId = hub ? hub.dataset.id : null;
            const data = await api.get(`/api/hubs/${hubId}/projects/${parentId}/topFolders`);
            children.innerHTML = '';
            data.data.forEach((f) => children.appendChild(buildNode({
                id: f.id, label: f.attributes.displayName || f.attributes.name,
                type: 'folder', mode, projectId
            })));
        } else if (parentType === 'folder') {
            const data = await api.get(`/api/projects/${projectId}/folders/${parentId}/contents`);
            children.innerHTML = '';
            if (!data.data || data.data.length === 0) {
                children.innerHTML = '<div class="muted" style="padding:4px 10px;font-size:11px">Empty</div>';
                return;
            }
            data.data.forEach((item) => {
                const isFolder = item.type === 'folders';
                const isRvt = !isFolder && /\.rvt$/i.test(item.attributes.displayName || '');
                if (mode === 'source' && !isFolder && !isRvt) return;
                if (mode === 'target' && !isFolder) return;
                children.appendChild(buildNode({
                    id: item.id,
                    label: item.attributes.displayName || item.attributes.name,
                    type: isFolder ? 'folder' : 'file',
                    mode, projectId,
                    included: data.included
                }));
            });
        }
    } catch (err) {
        children.innerHTML = `<div class="error" style="padding:4px 10px;font-size:11px">${err.message}</div>`;
    }
}

// Wrapper used by app.js to mount a fresh tree.
function mountTree(treeId, mode, onSelect) {
    renderTree(treeId, mode, onSelect);
}
