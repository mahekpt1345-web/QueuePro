/**
 * Public header mobile menu toggle.
 * Single listener: open/close dropdown; close on nav link or action click.
 */
(function () {
    function goToLogin() { window.location.href = '/login'; }
    function goToToken() { window.location.href = '/login'; }
    window.goToLogin = goToLogin;
    window.goToToken = goToToken;

    function closeMenu(dropdown, btn) {
        if (dropdown) dropdown.classList.remove('active');
        if (btn) btn.classList.remove('active');
        document.body.style.overflow = '';
    }

    function init() {
        var btn = document.getElementById('mobileMenuBtn');
        var dropdown = document.getElementById('navDropdownMobile');
        var navLinks = document.getElementById('navLinks');
        var navActions = document.querySelector('.nav-actions');
        if (!btn || !dropdown) return;

        btn.addEventListener('click', function () {
            dropdown.classList.toggle('active');
            btn.classList.toggle('active');
            document.body.style.overflow = dropdown.classList.contains('active') ? 'hidden' : '';
        });

        if (navLinks) {
            navLinks.querySelectorAll('.nav-link').forEach(function (link) {
                link.addEventListener('click', function () { closeMenu(dropdown, btn); });
            });
        }
        if (navActions) {
            navActions.querySelectorAll('button').forEach(function (b) {
                b.addEventListener('click', function () { closeMenu(dropdown, btn); });
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
