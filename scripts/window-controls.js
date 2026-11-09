var BlendedAddressbarModule = ((options) => {
  'use strict';

  // Dual-toolbar compact mode on macOS: Zen keeps the window controls in the
  // addressbar row (ZenVerticalTabsManager appends them to #nav-bar). While the
  // floating sidebar spans the full window height, host them at the top of the
  // sidebar instead, so they show only when the sidebar does.
  //
  // Zen caches the controls element (gZenVerticalTabsManager.actualWindowButtons)
  // and moves it back on its own layout updates; the #nav-bar observer below
  // re-hosts it in the same microtask, before the next paint.

  options = options || {};
  const chromeDoc = options.chromeDoc;
  const isMacOS = Boolean(options.isMacOS);
  const readBoolPref = options.readBoolPref || (() => false);
  const getWindowButtons = options.getWindowButtons || (() => null);
  const MutationObserverCtor = options.MutationObserver
    || (typeof MutationObserver === 'function' ? MutationObserver : null);

  const hostId = 'blended-addressbar-sidebar-window-controls';
  const activeAttribute = 'data-blended-sidebar-window-controls';
  const disabledPref = 'uc.blended-addressbar.compact-sidebar-window-controls.disabled';
  const overToolbarDisabledPref = 'uc.blended-addressbar.compact-sidebar-over-toolbar.disabled';
  const hideTabbarPref = 'zen.view.compact.hide-tabbar';
  const hideToolbarPref = 'zen.view.compact.hide-toolbar';
  const watchedPrefs = Object.freeze([disabledPref, overToolbarDisabledPref, hideTabbarPref, hideToolbarPref]);
  const rootAttributes = Object.freeze([
    'zen-compact-mode',
    'zen-single-toolbar',
    'zen-right-side',
    'customizing',
    'inDOMFullscreen',
    'inFullscreen'
  ]);
  // Zen moves the controls between these containers.
  const buttonParentIds = Object.freeze(['nav-bar', 'zen-sidebar-top-buttons', 'zen-appcontent-navbar-container']);

  let restoreTarget = null;
  let observers = [];

  function shouldHostInSidebar() {
    const root = chromeDoc?.documentElement;
    if (!isMacOS || !root) return false;
    if (root.getAttribute('zen-compact-mode') !== 'true') return false;
    if (root.getAttribute('zen-single-toolbar') === 'true') return false;
    if (root.getAttribute('zen-right-side') === 'true') return false;
    if (root.hasAttribute('customizing')) return false;
    if (root.getAttribute('inDOMFullscreen') === 'true' || root.getAttribute('inFullscreen') === 'true') return false;
    if (readBoolPref(disabledPref, false) || readBoolPref(overToolbarDisabledPref, false)) return false;
    // Only the floating sidebar under a visible toolbar (see style.css).
    return readBoolPref(hideTabbarPref, false) && !readBoolPref(hideToolbarPref, false);
  }

  function getHost(create) {
    const existing = chromeDoc.getElementById(hostId);
    if (existing || !create) return existing;
    const titlebar = chromeDoc.getElementById('titlebar');
    if (!titlebar) return null;
    const host = chromeDoc.createElement('div');
    host.id = hostId;
    titlebar.prepend(host);
    return host;
  }

  function restoreWindowButtons(buttons) {
    const target = restoreTarget;
    restoreTarget = null;
    const parent = target?.parent?.isConnected ? target.parent : chromeDoc.getElementById('nav-bar');
    if (!parent) return;
    const nextSibling = target?.nextSibling?.parentNode === parent ? target.nextSibling : null;
    parent.insertBefore(buttons, nextSibling);
  }

  function updateWindowControlsPlacement() {
    const root = chromeDoc?.documentElement;
    const buttons = getWindowButtons();
    if (!root || !buttons) return;

    if (shouldHostInSidebar()) {
      const host = getHost(true);
      if (!host) return;
      if (buttons.parentNode !== host) {
        restoreTarget = { parent: buttons.parentNode, nextSibling: buttons.nextSibling };
        host.appendChild(buttons);
      }
      root.setAttribute(activeAttribute, 'true');
      return;
    }

    root.removeAttribute(activeAttribute);
    const host = getHost(false);
    if (host && buttons.parentNode === host) restoreWindowButtons(buttons);
  }

  function observeWindowControlsPlacement(prefs) {
    cleanupWindowControlsPlacement();
    if (!isMacOS || !chromeDoc?.documentElement) return;

    if (MutationObserverCtor) {
      const rootObserver = new MutationObserverCtor(updateWindowControlsPlacement);
      rootObserver.observe(chromeDoc.documentElement, { attributes: true, attributeFilter: [...rootAttributes] });
      observers.push(() => rootObserver.disconnect());

      const parentObserver = new MutationObserverCtor(updateWindowControlsPlacement);
      for (const id of buttonParentIds) {
        const parent = chromeDoc.getElementById(id);
        if (parent) parentObserver.observe(parent, { childList: true });
      }
      observers.push(() => parentObserver.disconnect());
    }

    if (prefs?.addObserver) {
      const prefObserver = {
        observe(_subject, topic) {
          if (topic === 'nsPref:changed') updateWindowControlsPlacement();
        }
      };
      for (const name of watchedPrefs) {
        try { prefs.addObserver(name, prefObserver); } catch {}
      }
      observers.push(() => {
        for (const name of watchedPrefs) {
          try { prefs.removeObserver(name, prefObserver); } catch {}
        }
      });
    }

    updateWindowControlsPlacement();
  }

  function cleanupWindowControlsPlacement() {
    for (const dispose of observers) {
      try { dispose(); } catch {}
    }
    observers = [];

    const root = chromeDoc?.documentElement;
    const host = chromeDoc ? getHost(false) : null;
    const buttons = getWindowButtons();
    if (host && buttons?.parentNode === host) restoreWindowButtons(buttons);
    host?.remove();
    root?.removeAttribute(activeAttribute);
  }

  return Object.freeze({
    cleanupWindowControlsPlacement,
    observeWindowControlsPlacement,
    shouldHostInSidebar,
    updateWindowControlsPlacement
  });
})(BlendedAddressbarModuleOptions);
