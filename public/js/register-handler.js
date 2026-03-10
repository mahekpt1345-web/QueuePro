/**
 * REGISTER FORM HANDLER
 */

document.addEventListener('DOMContentLoaded', function () {
    const registerForm = document.getElementById('registerForm');
    const registerBtn = document.getElementById('registerBtn');
    const togglePassword = document.getElementById('togglePassword');
    const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
    const passwordInput = document.getElementById('password');
    const googleSignUpBtn = document.getElementById('googleSignUpBtn');

    // OAuth Buttons - Redirect to OAuth routes
    if (googleSignUpBtn) {
        googleSignUpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/auth/google';
        });
    }

    // Password toggle
    if (togglePassword) {
        togglePassword.addEventListener('click', (e) => {
            e.preventDefault();
            UIUtils.togglePasswordVisibility('password', 'togglePassword');
        });
    }

    if (toggleConfirmPassword) {
        toggleConfirmPassword.addEventListener('click', (e) => {
            e.preventDefault();
            UIUtils.togglePasswordVisibility('confirmPassword', 'toggleConfirmPassword');
        });
    }

    // Password strength indicator
    if (passwordInput) {
        passwordInput.addEventListener('input', updatePasswordStrength);
    }

    // Form submission
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
});

/**
 * Update password strength indicator
 */
function updatePasswordStrength() {
    const password = document.getElementById('password').value;
    const strengthDiv = document.getElementById('passwordStrength');

    if (!strengthDiv) return;

    let strength = 0;
    let strengthText = '';
    let strengthClass = '';

    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    switch (strength) {
        case 0:
        case 1:
            strengthText = 'Weak';
            strengthClass = 'weak';
            break;
        case 2:
        case 3:
            strengthText = 'Medium';
            strengthClass = 'medium';
            break;
        case 4:
        case 5:
            strengthText = 'Strong';
            strengthClass = 'strong';
            break;
    }

    if (password.length > 0) {
        strengthDiv.innerHTML = `
            <div class="strength-bar">
                <div class="strength-fill ${strengthClass}"></div>
            </div>
            <span class="strength-text ${strengthClass}">Strength: ${strengthText}</span>
        `;
    } else {
        strengthDiv.innerHTML = '';
    }
}

/**
 * Handle register form submission
 */
async function handleRegister(e) {
    e.preventDefault();

    UIUtils.clearAllErrors();

    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone')?.value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const role = document.querySelector('input[name="role"]:checked')?.value;
    const termsAccepted = document.getElementById('terms').checked;

    let isValid = true;
    if (!fullName) {
        UIUtils.showError('fullNameError', 'Full name is required');
        isValid = false;
    }
    if (!phone) {
        UIUtils.showError('phoneError', 'Phone number is required');
        isValid = false;
    } else if (!/^[0-9]{10}$/.test(phone)) {
        UIUtils.showError('phoneError', 'Please enter a valid 10-digit mobile number');
        isValid = false;
    }
    if (!email) {
        UIUtils.showError('emailError', 'Email is required');
        isValid = false;
    } else if (!isValidEmail(email)) {
        UIUtils.showError('emailError', 'Please enter a valid email address');
        isValid = false;
    }
    if (!username) {
        UIUtils.showError('usernameError', 'Username is required');
        isValid = false;
    } else if (username.length < 3) {
        UIUtils.showError('usernameError', 'Username must be at least 3 characters');
        isValid = false;
    }
    if (!password) {
        UIUtils.showError('passwordError', 'Password is required');
        isValid = false;
    } else if (password.length < 6) {
        UIUtils.showError('passwordError', 'Password must be at least 6 characters');
        isValid = false;
    }
    if (password !== confirmPassword) {
        UIUtils.showError('confirmPasswordError', 'Passwords do not match');
        isValid = false;
    }
    if (!role) {
        UIUtils.showError('roleError', 'Please select a role');
        isValid = false;
    }
    if (!termsAccepted) {
        UIUtils.showError('termsError', 'You must agree to the Terms & Conditions');
        isValid = false;
    }
    if (!isValid) return;

    UIUtils.disableButton('registerBtn', 'Creating Account...');

    const result = await auth.register(username, email, password, confirmPassword, role, fullName, phone);

    UIUtils.enableButton('registerBtn');

    if (result.success) {
        UIUtils.showToast(result.message, result.type);
        document.getElementById('registerForm').reset();
        const strengthEl = document.getElementById('passwordStrength');
        if (strengthEl) strengthEl.innerHTML = '';
        setTimeout(() => UIUtils.redirectTo('/login'), 1500);
    } else {
        UIUtils.showToast(result.message, result.type);
        if (result.message && result.message.includes('Username')) {
            UIUtils.showError('usernameError', result.message);
        } else if (result.message && result.message.includes('Email')) {
            UIUtils.showError('emailError', result.message);
        } else if (result.message && result.message.includes('Password')) {
            UIUtils.showError('passwordError', result.message);
        }
    }
}

/**
 * Email validation
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
