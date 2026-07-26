/**
 * shared/cheerpj/loader.js
 * ──────────────────────────────────────────────────────────────────────────────
 * MojoSnap Java ME Runtime Bridge
 *
 * This script is an optional self-hosted shim that sits between j2me.js and
 * CheerpJ. It can be used to:
 *   • Point CheerpJ at a specific self-hosted runtime version rather than the CDN
 *   • Inject additional Java classpath entries (e.g. FreeJ2ME extensions)
 *   • Intercept or pre-process JAR files before they are handed to the VM
 *
 * USAGE
 * ─────
 * By default j2me.js loads CheerpJ directly from the Leaning Technologies CDN:
 *   https://cjrtnc.leaningtech.com/3.0/cj3loader.js
 *
 * To switch to a self-hosted runtime, place the CheerpJ distribution files
 * alongside this file and set the CHEERPJ_RUNTIME_URL constant in j2me.js
 * to point here instead:
 *   const CHEERPJ_RUNTIME_URL = 'shared/cheerpj/loader.js';
 *
 * SELF-HOSTING CHECKLIST
 * ──────────────────────
 * 1. Download the CheerpJ 3.x distribution from https://labs.leaningtech.com/cheerpj3
 * 2. Copy all runtime files (cj3loader.js, cj3worker.js, …) into this directory.
 * 3. Place freej2me.jar (compiled from https://github.com/hex007/freej2me) here too.
 * 4. Update the paths below to match your file layout.
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

(function () {
    /**
     * Path to the actual CheerpJ 3.x loader relative to this file's URL.
     * Override this if you have a custom runtime location.
     */
    const CHEERPJ_LOADER = new URL('cj3loader.js', import.meta.url).href;

    /**
     * Optional extra JAR files to add to the Java classpath before the game
     * JAR is loaded.  For example, add MMAPI stubs or a custom J2ME polyfill:
     *
     *   const EXTRA_CLASSPATH = ['shared/cheerpj/mmapi-stubs.jar'];
     */
    const EXTRA_CLASSPATH = [];

    /**
     * loadCheerpJ — dynamically imports the CheerpJ 3 loader and resolves
     * when `cheerpjInit` is available on the global scope.
     *
     * @returns {Promise<void>}
     */
    async function loadCheerpJ() {
        if (typeof cheerpjInit === 'function') return; // already loaded

        await new Promise((resolve, reject) => {
            const script   = document.createElement('script');
            script.src     = CHEERPJ_LOADER;
            script.async   = true;
            script.onload  = resolve;
            script.onerror = () => reject(new Error(
                `[MojoSnap J2ME] Failed to load CheerpJ from: ${CHEERPJ_LOADER}\n` +
                'Check that the runtime files are present under shared/cheerpj/'
            ));
            document.head.appendChild(script);
        });
    }

    /**
     * getExtraClasspath — returns any additional JAR URLs to prepend to the
     * FreeJ2ME invocation classpath.
     *
     * @returns {string[]}
     */
    function getExtraClasspath() {
        return EXTRA_CLASSPATH;
    }

    // Expose the bridge API so j2me.js can opt-in to using this self-hosted path
    window.MojoSnapJ2meBridge = {
        loadCheerpJ,
        getExtraClasspath
    };

})();
