var BlendedAddressbarModule = ((options) => {
  'use strict';
  const { chromeDoc, getTab, openAddress, copyAddress, openSite, getReadableForeground,
    setStylePropertyIfChanged, removeStylePropertyIfChanged } = options;
  const bars = new Map();

  function getEditorPlacement(rect, viewportWidth, viewportHeight, editorHeaderHeight = rect.height) {
    const width = Math.max(0, Math.min(rect.width, viewportWidth - 16));
    const left = Math.max(8, Math.min(rect.left, viewportWidth - width - 8));
    const top = Math.max(0, rect.top);
    return { left, top, width, resultsHeight: Math.max(0, viewportHeight - top - Math.max(rect.height, editorHeaderHeight) - 16) };
  }

  function formatAddress(href) {
    try {
      const url = new URL(href);
      url.username = '';
      url.password = '';
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        return { host: url.host, path: `${url.pathname === '/' ? '' : url.pathname}${url.search}${url.hash}`, full: url.href };
      }
    } catch {}
    return { host: href || 'New Tab', path: '', full: href || 'New Tab' };
  }

  function makeElement(name, className) {
    const element = chromeDoc.createElementNS('http://www.w3.org/1999/xhtml', name);
    element.className = className;
    return element;
  }

  function setAttribute(element, name, value) {
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  }

  function update(browser) {
    const record = bars.get(browser);
    if (!record) return;
    const href = browser.currentURI?.spec || '';
    const { host, path, full } = formatAddress(href);
    if (record.host.textContent !== host) record.host.textContent = host;
    if (record.path.textContent !== path) record.path.textContent = path;
    setAttribute(record.address, 'title', full);
    setAttribute(record.address, 'aria-label', `Edit address: ${full}`);
    const loading = !!getTab(browser)?.hasAttribute('busy');
    setAttribute(record.reload, 'aria-label', loading ? 'Stop loading' : 'Reload page');
    setAttribute(record.reload, 'title', loading ? 'Stop loading' : 'Reload page');
    setAttribute(record.reload, 'data-loading', String(loading));
    if (record.href !== href) {
      record.href = href;
      removeStylePropertyIfChanged(record.bar.style, '--blended-addressbar-pane-background');
      removeStylePropertyIfChanged(record.bar.style, '--blended-addressbar-pane-foreground');
    }
  }

  function sync(containers) {
    const visible = new Map();
    for (const container of containers) {
      const holder = container.querySelector(':scope > .browserContainer');
      const browser = holder?.querySelector('.browserStack > browser');
      if (browser) visible.set(browser, holder);
    }
    for (const [browser, record] of bars) {
      if (visible.get(browser) !== record.bar.parentNode) {
        record.bar.remove();
        bars.delete(browser);
      }
    }
    const added = [];
    for (const [browser, holder] of visible) {
      if (!bars.has(browser)) {
        const bar = makeElement('div', 'blended-addressbar-pane-bar');
        bar.setAttribute('role', 'group');
        bar.setAttribute('aria-label', 'Split page navigation');
        const field = makeElement('div', 'blended-addressbar-pane-field');
        const copy = makeElement('button', 'blended-addressbar-pane-copy');
        copy.type = 'button';
        copy.setAttribute('title', 'Copy URL');
        copy.setAttribute('aria-label', 'Copy URL');
        copy.addEventListener('click', () => copyAddress(browser));
        const address = makeElement('button', 'blended-addressbar-pane-address');
        address.type = 'button';
        const host = makeElement('span', 'blended-addressbar-pane-host');
        const path = makeElement('span', 'blended-addressbar-pane-path');
        address.append(host, path);
        address.addEventListener('click', () => openAddress(browser));
        const reload = makeElement('button', 'blended-addressbar-pane-reload');
        reload.type = 'button';
        reload.addEventListener('click', () => {
          if (getTab(browser)?.hasAttribute('busy')) browser.stop();
          else browser.reload();
        });
        bar.addEventListener('mousedown', event => event.stopPropagation());
        const site = makeElement('button', 'blended-addressbar-pane-site');
        site.type = 'button';
        site.setAttribute('title', 'Site settings and extensions');
        site.setAttribute('aria-label', 'Site settings and extensions');
        site.addEventListener('click', () => openSite(browser));
        field.append(copy, address, site);
        bar.append(field, reload);
        holder.prepend(bar);
        bars.set(browser, { bar, field, copy, site, address, host, path, reload, href: null });
        added.push(browser);
      }
      update(browser);
    }
    return added;
  }

  function applyTheme(browser, theme) {
    const record = bars.get(browser);
    if (!record || !theme?.bg || theme.href !== browser.currentURI?.spec) return;
    update(browser);
    const foreground = getReadableForeground(theme.bg);
    if (!foreground) return;
    setStylePropertyIfChanged(record.bar.style, '--blended-addressbar-pane-background', theme.bg);
    setStylePropertyIfChanged(record.bar.style, '--blended-addressbar-pane-foreground', foreground);
  }

  function cleanup() {
    for (const record of bars.values()) record.bar.remove();
    bars.clear();
  }

  return Object.freeze({ bars, formatAddress, getEditorPlacement, sync, update, applyTheme, cleanup });
})(BlendedAddressbarModuleOptions);
