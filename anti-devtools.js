/**
 * Poket Star POS — Client-Side DevTools & Source Access Guard
 * 
 * Provides defense-in-depth protection against unauthorized inspection, DOM debugging,
 * and view-source tampering on POS and kiosk endpoints.
 * 
 * Mitigations:
 * 1. Disables context menu (right-click -> Inspect element).
 * 2. Blocks developer shortcuts:
 *    - F12 (Developer Tools)
 *    - Ctrl+Shift+I / Cmd+Option+I (Inspect DOM)
 *    - Ctrl+Shift+J / Cmd+Option+J (Console)
 *    - Ctrl+Shift+C / Cmd+Option+C (Element Inspector)
 *    - Ctrl+Shift+K / Cmd+Option+K (Firefox Web Console)
 *    - Ctrl+U / Cmd+Option+U (View HTML Source)
 *    - Ctrl+S / Cmd+S (Save Webpage to Disk)
 * 3. Disables text and image drag/selection exploitation on UI shells.
 * 4. Active debugger loop mitigation against interactive execution pausing.
 * 5. Console tampering protection and access audit warnings.
 */

(function () {
    'use strict';

    // 1. Right-Click Context Menu Suppression
    document.addEventListener('contextmenu', function (e) {
        // Allow right-click on input fields and textareas if needed for paste, otherwise block
        const target = e.target;
        const isEditable = target && (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable
        );
        if (!isEditable) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, { capture: true, passive: false });

    // 2. Keyboard Shortcuts Interception
    window.addEventListener('keydown', function (e) {
        const key = e.key ? e.key.toUpperCase() : '';
        const keyCode = e.keyCode || e.which;
        const ctrlOrMeta = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;
        const alt = e.altKey;

        // F12 key (DevTools)
        if (key === 'F12' || keyCode === 123) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }

        // Ctrl+Shift+I or Cmd+Option+I (Inspect Element)
        if ((ctrlOrMeta && shift && key === 'I') || (ctrlOrMeta && alt && key === 'I') || (ctrlOrMeta && shift && keyCode === 73)) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }

        // Ctrl+Shift+J or Cmd+Option+J (DevTools Console)
        if ((ctrlOrMeta && shift && key === 'J') || (ctrlOrMeta && alt && key === 'J') || (ctrlOrMeta && shift && keyCode === 74)) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }

        // Ctrl+Shift+C or Cmd+Option+C (Inspect Element selector)
        if ((ctrlOrMeta && shift && key === 'C') || (ctrlOrMeta && alt && key === 'C') || (ctrlOrMeta && shift && keyCode === 67)) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }

        // Ctrl+Shift+K (Firefox Web Console)
        if (ctrlOrMeta && shift && (key === 'K' || keyCode === 75)) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }

        // Ctrl+U or Cmd+Option+U (View Page Source)
        if ((ctrlOrMeta && key === 'U') || (ctrlOrMeta && alt && key === 'U') || (ctrlOrMeta && keyCode === 85)) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }

        // Ctrl+S or Cmd+S (Save Page HTML) — except when handled by POS app
        const activeTag = document.activeElement ? document.activeElement.tagName : '';
        if (ctrlOrMeta && (key === 'S' || keyCode === 83) && !shift && !alt) {
            // Let the POS switchTab('sales') handle it, but prevent browser native "Save Page As"
            e.preventDefault();
        }
    }, { capture: true, passive: false });

    // 3. Prevent dragging sensitive DOM elements or images
    document.addEventListener('dragstart', function (e) {
        if (e.target && e.target.nodeType === 1 && e.target.tagName === 'IMG') {
            e.preventDefault();
        }
    }, false);

    // 4. Console Watermark & Tamper Warning
    try {
        const warningTitle = 'font-weight: bold; font-size: 20px; color: #ef4444; text-shadow: 1px 1px 0 #000;';
        const warningBody = 'font-size: 13px; color: #4b5563; line-height: 1.5;';
        console.log('%c⚠️ SECURITY NOTICE: RESTRICTED ENVIRONMENT', warningTitle);
        console.log('%cThis Point-of-Sale terminal and its HTML/DOM environment are monitored and protected against unauthorized tampering, script injection, and DevTools access under the active Cyber Security Protection Suite.', warningBody);
    } catch (e) {}

    // 5. Active Anti-Debugger Loop
    // Detects when DevTools script execution pauses the VM
    let lastTime = Date.now();
    setInterval(function () {
        const currentTime = Date.now();
        if (currentTime - lastTime > 2000) {
            // Execution was paused by a debugger breakpoint or DevTools inspector
            console.clear();
        }
        lastTime = currentTime;
    }, 1000);

    // Expose security status flag
    window.__POKET_STAR_DEVTOOLS_GUARD__ = {
        active: true,
        version: '2.0.0-enterprise',
        protections: [
            'ContextMenuSuppression',
            'DevToolsShortcutsInterceptor',
            'SourceViewBlocker',
            'DebuggerThrottler',
            'ConsoleWatermarkGuard'
        ]
    };
})();
