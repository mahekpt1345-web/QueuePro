/**
 * AUTHENTICATION SYSTEM (API + JWT)
 * Uses backend API for register/login; JWT is stored in HttpOnly cookie (set by server).
 */

class AuthSystem {
    constructor() {
        this.JWT_STORAGE_KEY = 'queuepro_jwt';
        this.API_BASE = typeof window !== 'undefined' && window.API_BASE_URL != null ? window.API_BASE_URL : '';
    }

    getToken() {
        // Token is managed via HttpOnly cookie on the server side.
        // This method reads the non-HttpOnly cookie fallback if available.
        if (typeof document !== 'undefined' && document.cookie) {
            const match = document.cookie.match(/(?:^|;\s*)queuepro_jwt=([^;]*)/);
            if (match) return decodeURIComponent(match[1]);
        }
        return null;
    }

    _decodeJwt(token) {
        if (!token || !token.split) return null;
        try {
            const part = token.split('.')[1];
            if (!part) return null;
            const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
            const json = atob(base64);
            return JSON.parse(json);
        } catch (e) {
            return null;
        }
    }

    // Register new user (async, calls API)
    async register(username, email, password, confirmPassword, role, fullName, phone) {
        if (username && username.toLowerCase() === 'admin') {
            return { success: false, message: 'This username is reserved.', type: 'error' };
        }
        const validation = this.validateRegistration(username, email, password, confirmPassword, role, phone);
        if (!validation.success) return validation;

        const name = fullName != null && fullName !== '' ? fullName : username;
        try {
            const res = await fetch(this.API_BASE + '/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    email,
                    fullName: name,
                    phone,
                    password,
                    confirmPassword,
                    role: role || 'citizen'
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                return {
                    success: false,
                    message: data.message || 'Registration failed.',
                    type: 'error'
                };
            }
            return {
                success: true,
                message: data.message || 'Account created successfully! You can now login.',
                type: 'success'
            };
        } catch (err) {
            console.error('Register API error:', err);
            return {
                success: false,
                message: 'Network error. Please try again.',
                type: 'error'
            };
        }
    }

    // Login user (async, calls API). For admin login from admin page use loginAdmin().
    async login(username, password, rememberMe = false) {
        const validation = this.validateLogin(username, password);
        if (!validation.success) return validation;
        return this._loginRequest('/api/auth/login', { username, password, rememberMe }, username);
    }

    async loginAdmin(username, password, rememberMe = false) {
        const validation = this.validateLogin(username, password);
        if (!validation.success) return validation;
        return this._loginRequest('/api/auth/admin-login', { username, password, rememberMe }, username);
    }

    _loginRequest(endpoint, body, username) {
        return fetch(this.API_BASE + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                return {
                    success: false,
                    message: data.message || 'Invalid username or password.',
                    type: 'error'
                };
            }
            const token = data.token;
            // Token is set as HttpOnly cookie by the server; no localStorage or client-side cookie needed for auth.
            // Store a non-HttpOnly readable copy for client-side session decode if needed.
            if (token && typeof document !== 'undefined') {
                document.cookie = `queuepro_jwt=${encodeURIComponent(token)};path=/;max-age=86400;samesite=strict`;
            }
            const user = data.user || {};
            return {
                success: true,
                message: data.message || `Welcome ${user.name || username}!`,
                type: 'success',
                role: user.role || data.role,
                user
            };
        }).catch((err) => {
            console.error('Login API error:', err);
            return { success: false, message: 'Network error. Please try again.', type: 'error' };
        });
    }

    // Get current session from JWT (decode only; no API call)
    getSession() {
        const token = this.getToken();
        if (!token) return null;
        const payload = this._decodeJwt(token);
        if (!payload) return null;
        if (payload.exp && payload.exp * 1000 < Date.now()) {
            this.logout();
            return null;
        }
        return {
            userId: payload.userId,
            username: payload.username,
            role: payload.role,
            name: payload.name,
            email: payload.email,
            sessionId: payload.sessionId || 'session_' + (payload.userId || payload.username),
            loginTime: payload.iat ? new Date(payload.iat * 1000).toISOString() : null
        };
    }

    isLoggedIn() {
        return this.getSession() !== null;
    }

    getUserRole() {
        const session = this.getSession();
        return session ? session.role : null;
    }

    logout() {
        // Clear the client-accessible cookie if any (main auth is HttpOnly token cookie)
        if (typeof document !== 'undefined') {
            document.cookie = 'queuepro_jwt=;path=/;max-age=0;samesite=strict';
        }
        fetch(this.API_BASE + '/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => { });
        return { success: true, message: 'Logged out successfully!', type: 'success' };
    }

    validateRegistration(username, email, password, confirmPassword, role, phone) {
        if (!username || String(username).trim() === '') {
            return { success: false, message: 'Username is required.', type: 'error' };
        }
        if (String(username).length < 3) {
            return { success: false, message: 'Username must be at least 3 characters.', type: 'error' };
        }
        if (!phone || String(phone).trim() === '') {
            return { success: false, message: 'Phone number is required.', type: 'error' };
        }
        if (!/^[0-9]{10}$/.test(phone)) {
            return { success: false, message: 'Please enter a valid 10-digit phone number.', type: 'error' };
        }
        if (!email || !this.isValidEmail(email)) {
            return { success: false, message: 'Valid email is required.', type: 'error' };
        }
        if (!password || password.length < 6) {
            return { success: false, message: 'Password must be at least 6 characters.', type: 'error' };
        }
        if (password !== confirmPassword) {
            return { success: false, message: 'Passwords do not match.', type: 'error' };
        }
        if (!role || (role !== 'citizen' && role !== 'officer')) {
            return { success: false, message: 'Please select a valid role.', type: 'error' };
        }
        return { success: true };
    }

    validateLogin(username, password) {
        if (!username || String(username).trim() === '') {
            return { success: false, message: 'Username is required.', type: 'error' };
        }
        if (!password || String(password).trim() === '') {
            return { success: false, message: 'Password is required.', type: 'error' };
        }
        return { success: true };
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Get current user from API (for profile data)
    async getMe() {
        const token = this.getToken();
        if (!token) return null;
        try {
            const res = await fetch(this.API_BASE + '/api/auth/me', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) return null;
            const data = await res.json();
            return data.user || null;
        } catch (e) {
            return null;
        }
    }

    // Admin: fetch all users from API
    async getAllUsers() {
        const token = this.getToken();
        if (!token) return [];
        try {
            const res = await fetch(this.API_BASE + '/api/users', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) return [];
            const data = await res.json();
            return data.users || [];
        } catch (e) {
            return [];
        }
    }

    deleteUser(username) {
        return Promise.resolve({ success: false, message: 'Use admin API to delete users.' });
    }

    updateUser(username, updatedData) {
        return Promise.resolve({ success: false, message: 'Use admin API to update users.' });
    }
}

// Define global auth instance
window.auth = new AuthSystem();
