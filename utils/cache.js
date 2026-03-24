/**
 * LIGHTWEIGHT IN-PROCESS TTL CACHE
 * ─────────────────────────────────────────────────────────────────────────────
 * Simple key-value cache with configurable TTL per entry.
 * No external dependencies (no Redis, no Memcached).
 * Intended for caching short-lived data like analytics aggregations
 * and queue snapshots to reduce repeated MongoDB queries.
 *
 * USAGE:
 *   const cache = require('../utils/cache');
 *   cache.set('key', value, 30);        // store for 30 seconds
 *   const val = cache.get('key');       // null if expired or missing
 *   cache.del('key');                   // invalidate manually
 *   cache.clear();                      // flush everything
 *
 * GUARANTEES:
 *   - Non-blocking, synchronous get/set
 *   - Expired entries are lazily evicted on access
 *   - Periodic sweep every 60s to prevent memory growth
 */

class TTLCache {
    constructor() {
        this._store = new Map();
        // Periodic cleanup every 60 seconds to evict stale entries
        this._sweepInterval = setInterval(() => this._sweep(), 60 * 1000);
        // Allow the process to exit even if interval is active
        if (this._sweepInterval.unref) this._sweepInterval.unref();
    }

    /**
     * Store a value with a TTL.
     * @param {string} key
     * @param {*} value
     * @param {number} ttlSeconds - Expiry in seconds (default: 30)
     */
    set(key, value, ttlSeconds = 30) {
        this._store.set(key, {
            value,
            expiresAt: Date.now() + ttlSeconds * 1000
        });
    }

    /**
     * Retrieve a value. Returns null if expired or not found.
     * @param {string} key
     * @returns {*|null}
     */
    get(key) {
        const entry = this._store.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this._store.delete(key);
            return null;
        }
        return entry.value;
    }

    /**
     * Manually invalidate a cache key.
     * @param {string} key
     */
    del(key) {
        this._store.delete(key);
    }

    /**
     * Flush all cached entries.
     */
    clear() {
        this._store.clear();
    }

    /**
     * Sweep expired entries to free memory.
     */
    _sweep() {
        const now = Date.now();
        for (const [key, entry] of this._store.entries()) {
            if (now > entry.expiresAt) this._store.delete(key);
        }
    }

    /**
     * Returns the number of currently cached (including potentially stale) entries.
     */
    get size() {
        return this._store.size;
    }
}

// Export singleton — shared across the whole process
module.exports = new TTLCache();
