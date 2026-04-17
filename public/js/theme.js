// Runs before first paint — must stay small. Inline-blocking in <head>.
(function () {
    var stored = null;
    try { stored = localStorage.getItem('theme'); } catch (e) {}
    var preferDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored || (preferDark ? 'dark' : 'light');
    if (theme === 'dark') document.documentElement.classList.add('dark');
})();
