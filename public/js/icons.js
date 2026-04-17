// Heroicons-outline-style SVGs, all 24x24 stroke 1.5, using currentColor.
// Usage: icons.render(name)  →  string of <svg>…</svg>
//        icons.inject(el, name)  →  replace element's innerHTML
//        <span data-icon="name"></span> elements are auto-filled on DOMContentLoaded.

const icons = (function () {
    const SVG = (inner) =>
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ` +
        `stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ` +
        `aria-hidden="true" focusable="false">${inner}</svg>`;

    const lib = {
        // Brand mark — stacked sheets with a spark.
        'forge': SVG(
            `<path d="M7 4h8l4 4v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/>` +
            `<path d="M15 4v4h4"/>` +
            `<path d="M9 13l2 2 4-4" opacity=".5"/>` +
            `<path d="M3.5 7l-.8 2-2 .8 2 .8.8 2 .8-2 2-.8-2-.8-.8-2z" fill="currentColor" stroke="none"/>`
        ),
        'sheet-stack': SVG(
            `<rect x="5" y="3" width="12" height="16" rx="1.5"/>` +
            `<path d="M8 6h6M8 10h6M8 14h4"/>` +
            `<path d="M8 21h11a1 1 0 0 0 1-1V7" opacity=".5"/>`
        ),
        'spark': SVG(
            `<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>`
        ),
        'cloud-up': SVG(
            `<path d="M7 18a4 4 0 1 1 .4-7.98A6 6 0 0 1 19 12a3.5 3.5 0 0 1-1 6.86"/>` +
            `<path d="M12 21v-8m0 0-3 3m3-3 3 3"/>`
        ),
        'cloud-down': SVG(
            `<path d="M7 18a4 4 0 1 1 .4-7.98A6 6 0 0 1 19 12a3.5 3.5 0 0 1-1 6.86"/>` +
            `<path d="M12 13v8m0 0-3-3m3 3 3-3"/>`
        ),
        'download': SVG(
            `<path d="M12 3v12m0 0-4-4m4 4 4-4"/>` +
            `<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>`
        ),
        'upload': SVG(
            `<path d="M12 21V9m0 0-4 4m4-4 4 4"/>` +
            `<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>`
        ),
        'tag': SVG(
            `<path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9z"/>` +
            `<circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/>`
        ),
        'arrange': SVG(
            `<path d="M4 6h10M4 12h16M4 18h7"/>` +
            `<path d="M18 3l3 3-3 3M15 15l-3 3 3 3"/>`
        ),
        'preview': SVG(
            `<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/>` +
            `<circle cx="12" cy="12" r="3"/>`
        ),
        'check': SVG(`<path d="M5 12l4 4 10-10"/>`),
        'x': SVG(`<path d="M6 6l12 12M18 6 6 18"/>`),
        'plus': SVG(`<path d="M12 5v14M5 12h14"/>`),
        'sun': SVG(
            `<circle cx="12" cy="12" r="4"/>` +
            `<path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>`
        ),
        'moon': SVG(`<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/>`),
        'logout': SVG(
            `<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/>` +
            `<path d="M10 17l5-5-5-5M15 12H4"/>`
        ),
        'autodesk': SVG(
            `<path d="M3 19l9-14h4l-9 14h4l3-5" stroke-width="1.8"/>`
        ),
        'play': SVG(`<path d="M6 4l14 8-14 8V4z" fill="currentColor" stroke="none"/>`),
        'folder': SVG(
            `<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>`
        ),
        'folder-open': SVG(
            `<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H3V7z"/>` +
            `<path d="M3 9h18l-2 8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/>`
        ),
        'document': SVG(
            `<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z"/>` +
            `<path d="M14 3v5h5M9 13h6M9 17h6"/>`
        ),
        'hub': SVG(
            `<path d="M4 10l8-6 8 6v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9z"/>` +
            `<path d="M10 21v-6h4v6"/>`
        ),
        'chevron-right': SVG(`<path d="M9 6l6 6-6 6"/>`),
        'chevron-down': SVG(`<path d="M6 9l6 6 6-6"/>`),
        'drag': SVG(
            `<circle cx="9" cy="6" r="1" fill="currentColor" stroke="none"/>` +
            `<circle cx="15" cy="6" r="1" fill="currentColor" stroke="none"/>` +
            `<circle cx="9" cy="12" r="1" fill="currentColor" stroke="none"/>` +
            `<circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/>` +
            `<circle cx="9" cy="18" r="1" fill="currentColor" stroke="none"/>` +
            `<circle cx="15" cy="18" r="1" fill="currentColor" stroke="none"/>`
        ),
        'sliders': SVG(
            `<path d="M4 6h10M4 12h6M4 18h13"/>` +
            `<circle cx="16" cy="6" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="18" r="2"/>`
        ),
        'lock': SVG(
            `<rect x="5" y="11" width="14" height="10" rx="2"/>` +
            `<path d="M8 11V7a4 4 0 0 1 8 0v4"/>`
        )
    };

    function render(name) { return lib[name] || ''; }
    function inject(el, name) { if (el) el.innerHTML = render(name); }
    function hydrate(root) {
        (root || document).querySelectorAll('[data-icon]').forEach((el) => {
            if (!el.dataset.iconDone) { inject(el, el.dataset.icon); el.dataset.iconDone = '1'; }
        });
    }

    document.addEventListener('DOMContentLoaded', () => hydrate());

    return { render, inject, hydrate };
})();
