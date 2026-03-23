/**
 * UI UTILITIES
 * Common functions for UI interactions and notifications
 */

class UIUtils {
    static showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        if (!toast) return;

        toast.textContent = message;
        toast.className = `toast toast-${type} show`;

        // Remove previous timeout if exists
        if (toast.timeoutId) {
            clearTimeout(toast.timeoutId);
        }

        toast.timeoutId = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    static showNotification(message) {
        const notification = document.createElement("div");
        notification.innerText = message;
        
        notification.style.position = "fixed";
        notification.style.top = "20px";
        notification.style.right = "20px";
        notification.style.background = "#3b82f6";
        notification.style.color = "#fff";
        notification.style.padding = "12px 16px";
        notification.style.borderRadius = "8px";
        notification.style.zIndex = "9999";
        notification.style.opacity = "0";
        notification.style.transform = "translateY(-10px)";
        notification.style.transition = "all 0.3s ease";
        notification.style.boxShadow = "0 5px 15px rgba(0,0,0,0.2)";
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.opacity = "1";
            notification.style.transform = "translateY(0)";
        }, 100);
        
        // Play sound
        const playFallbackSound = () => {
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.frequency.value = 660;
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
                osc.start(); osc.stop(ctx.currentTime + 0.5);
            } catch (e) { /* AudioContext not supported */ }
        };

        const audio = new Audio("notification.mp3");
        audio.play().catch(() => {
            // If mp3 fails (missing/blocked), use synthesized fallback
            playFallbackSound();
        });
        
        // Remove after 4 sec
        setTimeout(() => {
            notification.style.opacity = "0";
            notification.style.transform = "translateY(-10px)";
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }

    static showError(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.style.display = 'block';
        }
    }

    static clearError(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = '';
            element.style.display = 'none';
        }
    }

    static clearAllErrors(prefix = '') {
        const errorElements = document.querySelectorAll('[id$="Error"]');
        errorElements.forEach(el => {
            if (!prefix || el.id.startsWith(prefix)) {
                el.textContent = '';
                el.style.display = 'none';
            }
        });
    }

    static disableButton(buttonId, text = 'Loading...') {
        const button = document.getElementById(buttonId);
        if (button) {
            button.disabled = true;
            button.classList.add('loading');
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${text}`;
        }
    }

    static enableButton(buttonId) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.disabled = false;
            button.classList.remove('loading');
            if (button.dataset.originalText) {
                button.innerHTML = button.dataset.originalText;
            }
        }
    }

    static togglePasswordVisibility(inputId, buttonId) {
        const input = document.getElementById(inputId);
        const button = document.getElementById(buttonId);

        if (!input || !button) return;

        if (input.type === 'password') {
            input.type = 'text';
            button.innerHTML = '<i class="fas fa-eye-slash"></i>';
        } else {
            input.type = 'password';
            button.innerHTML = '<i class="fas fa-eye"></i>';
        }
    }

    static redirectTo(path) {
        window.location.href = path;
    }

    static redirect(delayMs = 0) {
        setTimeout(() => {
            const session = auth.getSession();
            if (!session) {
                UIUtils.redirectTo('/login');
                return;
            }

            switch (session.role) {
                case 'admin':
                    UIUtils.redirectTo('/admin-dashboard');
                    break;
                case 'officer':
                    UIUtils.redirectTo('/officer-dashboard');
                    break;
                case 'citizen':
                    UIUtils.redirectTo('/citizen-dashboard');
                    break;
                default:
                    UIUtils.redirectTo('/');
            }
        }, delayMs);
    }

    static checkAuth(requiredRole = null) {
        const session = auth.getSession();

        if (!session) {
            UIUtils.showToast('Please login to access this page', 'error');
            setTimeout(() => {
                UIUtils.redirectTo('/login');
            }, 1000);
            return false;
        }

        if (requiredRole && session.role !== requiredRole) {
            UIUtils.showToast(`This page is only for ${requiredRole}s`, 'error');
            setTimeout(() => {
                UIUtils.redirect();
            }, 1000);
            return false;
        }

        return true;
    }

    static logout() {
        auth.logout();
        UIUtils.showToast('Logged out successfully', 'success');
        setTimeout(() => {
            UIUtils.redirectTo('/');
        }, 1000);
    }

    static setNavigation(userName = null, isLoggedIn = false) {
        const userInfo = document.querySelector('.user-info');
        const loginButton = document.querySelector('.btn-login');
        const logoutButton = document.querySelector('.btn-logout');

        if (isLoggedIn && userInfo && userName) {
            userInfo.style.display = 'flex';
            userInfo.querySelector('.user-name').textContent = userName;
            if (loginButton) loginButton.style.display = 'none';
            if (logoutButton) logoutButton.style.display = 'inline-block';
        } else {
            if (userInfo) userInfo.style.display = 'none';
            if (loginButton) loginButton.style.display = 'inline-block';
            if (logoutButton) logoutButton.style.display = 'none';
        }
    }

    static updateNavigationBar() {
        const session = auth.getSession();
        if (session) {
            UIUtils.setNavigation(session.name || session.username, true);
        } else {
            UIUtils.setNavigation(null, false);
        }
    }
}

/**
 * Copy to clipboard utility
 */
function copyToClipboard(username, password) {
    const text = `Username: ${username}\nPassword: ${password}`;
    navigator.clipboard.writeText(text).then(() => {
        UIUtils.showToast('Credentials copied to clipboard!', 'success');
    }).catch(() => {
        UIUtils.showToast('Failed to copy credentials', 'error');
    });
}

/**
 * Common setup for auth pages
 */
function setupAuthPage() {
    // Update navigation on page load
    UIUtils.updateNavigationBar();

    // Handle logout buttons
    document.querySelectorAll('.btn-logout').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            UIUtils.logout();
        });
    });

    // Prevent access if already logged in
    const currentPage = window.location.pathname.split('/').pop();
    const session = auth.getSession();

    if (session && (currentPage === 'login.html' || currentPage === 'register.html' || currentPage === 'admin-login.html')) {
        UIUtils.redirect();
    }
}

// Run setup on page load
document.addEventListener('DOMContentLoaded', setupAuthPage);
