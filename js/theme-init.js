// Apply stored theme/style early to avoid a flash on load.
(function () {
    try {
        const isDark = localStorage.getItem('darkMode') === 'true';
        const style = localStorage.getItem('visualStyle') || 'classic';
        document.documentElement.dataset.mode = isDark ? 'dark' : 'light';
        document.documentElement.dataset.style = style === 'cyber' ? 'cyber' : 'classic';
        document.documentElement.classList.toggle('dark', isDark);

        const themeMeta = document.querySelector('meta[name="theme-color"]');
        if (themeMeta) themeMeta.setAttribute('content', isDark ? '#0b0f17' : '#fcfbf8');
    } catch (e) {}
})();
