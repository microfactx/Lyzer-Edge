/**
 * @fileoverview Application entry point.
 * Initialises the IndexedDB database then mounts the application shell.
 */

import { initDatabase } from './db/database.js';
import { App } from './app.js';
import './styles/variables.css';
import './styles/base.css';
import '@lyzer/shared/styles/components.css';
import '@lyzer/shared/styles/layout.css';

// Auto-detect and persist admin API key from query params or localStorage
try {
  const urlParams = new URLSearchParams(window.location.search);
  const keyFromUrl = urlParams.get('key') || urlParams.get('adminKey') || urlParams.get('token');
  if (keyFromUrl) {
    localStorage.setItem('lyzer_admin_key', keyFromUrl);
  }
  const storedKey = localStorage.getItem('lyzer_admin_key');
  if (storedKey) {
    const originalFetch = window.fetch;
    window.fetch = function (resource, init) {
      init = init || {};
      init.headers = init.headers || {};
      if (init.headers instanceof Headers) {
        if (!init.headers.has('x-admin-key')) init.headers.set('x-admin-key', storedKey);
      } else if (Array.isArray(init.headers)) {
        if (!init.headers.some(([k]) => k.toLowerCase() === 'x-admin-key')) {
          init.headers.push(['x-admin-key', storedKey]);
        }
      } else {
        if (!init.headers['x-admin-key']) init.headers['x-admin-key'] = storedKey;
      }
      return originalFetch.call(this, resource, init);
    };
  }
} catch (_) {}

async function main() {
  try {
    await initDatabase();
    
    console.log('[LyzerEdge] Starting Dashboard');
    const app = new App();
    app.mount('#app');
    
  } catch (error) {
    console.error('[LyzerEdge] Fatal error during startup:', error);

    const root = document.getElementById('app');
    if (root) {
      root.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;
                    font-family:system-ui;color:#e8eaf0;background:#0c0e14;text-align:center;padding:2rem">
          <div>
            <h1 style="margin-bottom:0.5rem">Failed to Start</h1>
            <p style="color:#9498ad">Unable to initialise the database. Please reload the page.</p>
            <pre style="margin-top:1rem;font-size:12px;color:#ff6b6b">${error.message}</pre>
          </div>
        </div>`;
    }
  }
}

main();
 