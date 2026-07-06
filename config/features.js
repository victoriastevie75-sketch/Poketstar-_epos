// config/features.js
// Simple runtime config loader and helpers for the Poket Star UI.
// Usage: include this script and call await loadMainConfig('/config/main-config.json');

(function (global) {
  async function loadMainConfig(path = '/config/main-config.json') {
    try {
      const res = await fetch(path, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load config: ' + res.status);
      const cfg = await res.json();
      global._PKT_CONFIG = cfg;
      applyConfigToUI(cfg);
      return cfg;
    } catch (err) {
      console.warn('[features] could not load config, using defaults:', err);
      const defaultCfg = {
        appName: 'Poket Star',
        environment: 'production',
        features: {
          deploymentSync: true,
          runDiagnostics: true,
          chatBroadcast: true,
          terminalLogging: true,
          fileExplorer: true
        },
        api: {}
      };
      global._PKT_CONFIG = defaultCfg;
      applyConfigToUI(defaultCfg);
      return defaultCfg;
    }
  }

  function getConfig() {
    return global._PKT_CONFIG || null;
  }

  function featureEnabled(name) {
    return !!(global._PKT_CONFIG && global._PKT_CONFIG.features && global._PKT_CONFIG.features[name]);
  }

  function applyConfigToUI(cfg) {
    // update center title
    try {
      const center = document.querySelector('.bar-center');
      if (center && cfg && cfg.appName) {
        center.textContent = `${cfg.appName} Environment Console`;
      }

      // toggle sync buttons
      const syncBtns = document.querySelectorAll('[data-action="trigger-sync"]');
      if (!featureEnabled('deploymentSync')) {
        syncBtns.forEach(b => {
          b.disabled = true;
          b.classList.add('disabled');
          b.title = 'Disabled by configuration';
        });
      }

      // toggle diagnostics buttons
      const diagBtns = document.querySelectorAll('[data-action="run-diagnostics"]');
      if (!featureEnabled('runDiagnostics')) {
        diagBtns.forEach(b => {
          b.disabled = true;
          b.classList.add('disabled');
          b.title = 'Disabled by configuration';
        });
      }

      // toggle file explorer visibility
      if (!featureEnabled('fileExplorer')) {
        const fg = document.getElementById('file-grid');
        if (fg) fg.style.display = 'none';
      }

      // toggle chat input
      if (!featureEnabled('chatBroadcast')) {
        const input = document.getElementById('chat-msg-input');
        const sendBtn = document.getElementById('chat-send-btn');
        if (input) input.disabled = true;
        if (sendBtn) { sendBtn.disabled = true; sendBtn.title = 'Disabled by configuration'; }
      }
    } catch (e) {
      console.error('[features] applyConfigToUI error', e);
    }
  }

  // Expose helpers
  global.loadMainConfig = loadMainConfig;
  global.getConfig = getConfig;
  global.featureEnabled = featureEnabled;

})(window);
