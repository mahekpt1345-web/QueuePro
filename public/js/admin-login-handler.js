/**
 * ADMIN LOGIN FORM HANDLER
 */

document.addEventListener('DOMContentLoaded', function() {
    const adminLoginForm = document.getElementById('adminLoginForm');
    const adminLoginBtn = document.getElementById('adminLoginBtn');
    const togglePassword = document.getElementById('togglePassword');

    // Password toggle
    if (togglePassword) {
        togglePassword.addEventListener('click', (e) => {
            e.preventDefault();
            UIUtils.togglePasswordVisibility('adminPassword', 'togglePassword');
        });
    }

    // Form submission
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', handleAdminLogin);
    }

    // Prevent access if already logged in as admin
    const session = auth.getSession();
    if (session && session.role === 'admin') {
        UIUtils.redirectTo('/admin-dashboard');
    }
});

/**
 * Handle admin login form submission
 */
async function handleAdminLogin(e) {
    e.preventDefault();

    UIUtils.clearAllErrors();

    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value;

    let isValid = true;
    if (!username) {
        UIUtils.showError('usernameError', 'Admin username is required');
        isValid = false;
    }
    if (!password) {
        UIUtils.showError('passwordError', 'Admin password is required');
        isValid = false;
    }
    if (!isValid) return;

    UIUtils.disableButton('adminLoginBtn', 'Verifying...');

    const result = await auth.loginAdmin(username, password);

    UIUtils.enableButton('adminLoginBtn');

    if (result.success && result.role === 'admin') {
        UIUtils.showToast('Admin access granted!', 'success');
        setTimeout(() => UIUtils.redirectTo('/admin-dashboard'), 1000);
    } else {
        UIUtils.showError('usernameError', result.message || 'Invalid admin credentials');
        UIUtils.showToast(result.message || 'Access denied. Invalid credentials.', 'error');
    }
}
