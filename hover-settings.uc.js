// Blended Addressbar split hover settings · Kostiantyn Kugot · 1.7.26
(() => {
  window.BlendedSplitHoverSettings?.destroy();
  const pref = 'uc.blended-addressbar.split-focus-on-hover';
  const html = tag => document.createElementNS('http://www.w3.org/1999/xhtml', tag);
  let section, checkbox;

  function refresh() {
    if (checkbox) checkbox.checked = Services.prefs.getBoolPref(pref, false);
  }

  function mount() {
    const pane = document.querySelector('setting-pane[data-category="paneTabsBrowsing"]');
    if (!pane) return;
    if (!section) {
      section = document.createXULElement('groupbox');
      section.id = 'blended-split-hover-settings';
      section.setAttribute('data-category', 'paneTabsBrowsing');
      section.style.marginBlock = 'var(--space-large, 24px)';
      const card = html('moz-card');
      card.setAttribute('role', 'presentation');
      const fieldset = html('moz-fieldset');
      fieldset.label = 'Split pane focus';
      fieldset.headingLevel = 3;
      fieldset.iconSrc = 'chrome://browser/skin/zen-icons/split.svg';
      fieldset.description = 'Follow the pointer between split panes without clicking.';
      const label = html('label');
      checkbox = html('input');
      checkbox.type = 'checkbox';
      checkbox.id = 'blended-split-hover-enabled';
      checkbox.addEventListener('change', () => Services.prefs.setBoolPref(pref, checkbox.checked));
      label.append(checkbox, ' Focus split pane on hover');
      fieldset.append(label);
      card.append(fieldset);
      section.append(card);
      pane.after(section);
      refresh();
    }
    section.hidden = pane.hidden;
  }

  const observer = { observe: refresh };
  const domObserver = new MutationObserver(mount);
  domObserver.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('paneshown', mount);
  Services.prefs.addObserver(pref, observer);

  function destroy() {
    domObserver.disconnect();
    document.removeEventListener('paneshown', mount);
    Services.prefs.removeObserver(pref, observer);
    window.removeEventListener('unload', destroy);
    section?.remove();
    delete window.BlendedSplitHoverSettings;
  }
  window.BlendedSplitHoverSettings = { destroy };
  window.addUnloadListener?.(destroy);
  window.addEventListener('unload', destroy, { once: true });
  mount();
})();
