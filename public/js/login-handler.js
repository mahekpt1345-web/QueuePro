/**
 * LOGIN FORM HANDLER
 */

document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');
    const togglePassword = document.getElementById('togglePassword');

    // Password toggle
    if (togglePassword) {
        togglePassword.addEventListener('click', (e) => {
            e.preventDefault();
            UIUtils.togglePasswordVisibility('password', 'togglePassword');
        });
    }

    // Form submission
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Load remembered username
    loadRememberedUsername();
});

/**
 * Handle login form submission
 */
async function handleLogin(e) {
    e.preventDefault();

    UIUtils.clearAllErrors();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe') && document.getElementById('rememberMe').checked;

    let isValid = true;
    if (!username) {
        UIUtils.showError('usernameError', 'Username is required');
        isValid = false;
    }
    if (!password) {
        UIUtils.showError('passwordError', 'Password is required');
        isValid = false;
    }
    if (!isValid) return;

    UIUtils.disableButton('loginBtn', 'Logging in...');

    const result = await auth.login(username, password);

    UIUtils.enableButton('loginBtn');

    if (result.success) {
        UIUtils.showToast(result.message, 'success');
        // Note: Remember Me functionality removed. Browser autofill handles username persistence.
        setTimeout(() => {
            if (result.role === 'admin') UIUtils.redirectTo('/admin-dashboard');
            else if (result.role === 'officer') UIUtils.redirectTo('/officer-dashboard');
            else UIUtils.redirectTo('/citizen-dashboard');
        }, 1000);
    } else {
        UIUtils.showToast(result.message, 'error');
        if (result.message && (result.message.includes('username') || result.message.includes('password') || result.message.includes('Invalid') || result.message.includes('credentials'))) {
            UIUtils.showError('usernameError', result.message);
        }
    }
}

/**
 * Pre-fill remember me username if available
 * NOTE: This function is deprecated. Browser autofill handles username persistence.
 */
function loadRememberedUsername() {
    // Legacy function - sessionStorage no longer used
    // Browser autofill will populate the username field if user chooses
}

