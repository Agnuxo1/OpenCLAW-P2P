/**
 * gunCollect — Smart Gun.js collection with early resolution.
 * 
 * Replaces the anti-pattern:
 *   await new Promise(resolve => {
 *       db.get("x").map().once((d) => results.push(d));
 *       setTimeout(resolve, 1500);  // ← wastes 1.5s even if data arrives in 10ms
 *   });
 * 
 * With idle-based resolution:
 *   const results = await gunCollect(db.get("x"), (d) => d && d.title);
 * 
 * Resolves when no new data arrives for `idleMs` (default 150ms)
 * or when `maxWaitMs` is reached (safety cap).
 */

/**
 * @param {Object} gunRef - A Gun.js reference (e.g. db.get("papers"))
 * @param {Function} filter - Predicate: (data, id) => truthy to include, falsy to skip
 * @param {Object} opts
 * @param {number} opts.idleMs - Resolve after this many ms of silence (default 150)
 * @param {number} opts.maxWaitMs - Hard cap in ms (default 2000)
 * @param {number} opts.limit - Max items to collect (default 500)
 * @returns {Promise<Array<{id: string, [key: string]: any}>>}
 */
export function gunCollect(gunRef, filter, { idleMs = 150, maxWaitMs = 2000, limit = 500 } = {}) {
    return new Promise((resolve) => {
        const results = [];
        let idleTimer = null;
        let settled = false;

        const finish = () => {
            if (settled) return;
            settled = true;
            clearTimeout(hardTimer);
            clearTimeout(idleTimer);
            resolve(results);
        };

        // Hard cap — never wait longer than this
        const hardTimer = setTimeout(finish, maxWaitMs);

        // Reset idle timer on every data event
        const resetIdle = () => {
            clearTimeout(idleTimer);
            idleTimer = setTimeout(finish, idleMs);
        };

        // Start the idle timer immediately (handles empty collections)
        resetIdle();

        gunRef.map().once((data, id) => {
            if (settled) return;
            if (filter && !filter(data, id)) return;

            results.push({ ...data, id });

            if (results.length >= limit) {
                finish();
                return;
            }

            resetIdle();
        });
    });
}

/**
 * Collect a single Gun.js .get().once() with a timeout.
 * Replaces:
 *   new Promise(resolve => {
 *       ref.get(key).once(data => resolve(data));
 *       setTimeout(() => resolve(null), 1000);
 *   });
 */
export function gunOnce(gunRef, { maxWaitMs = 500 } = {}) {
    return new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (!settled) { settled = true; resolve(null); }
        }, maxWaitMs);

        gunRef.once((data) => {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                resolve(data || null);
            }
        });
    });
}
