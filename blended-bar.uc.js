// ==UserScript==
// @name           Blended Addressbar
// @description    Adaptive header color for Zen URL bar
// @version        0.9.2
// ==/UserScript==

(() => {
  'use strict';

  const DEBUG = false;
  const DEBUG_VERBOSE = false;
  const DEBUG_SHOW_SAMPLER = false;
  const DEBUG_THEME = false;
  const samplingEnabled = false;
  const samplingIntervalMs = 120;
  const postLoadSamplingIntervalMs = 200;
  const postLoadSamplingEnabled = true;
  const earlyThemeUpdateDelays = [0, 50, 120, 250, 500, 900, 1400];
  const settledThemeUpdateDelays = [50, 300, 1000];
  const viewportThemeUpdateDelays = [0, 100, 300, 700];
  const loadingThemePollFastIntervalMs = 140;
  const loadingThemePollSlowIntervalMs = 650;
  const loadingThemePollAggressiveWindowMs = 3500;
  const loadingThemePollMaxMs = 45000;
  const loadingSamplingEnabled = false;
  const loadingSamplingIntervalMs = 120;
  const sampledColorMinAlpha = 0.08;
  const fallbackThemeStableDelayMs = 350;
  const immediateThemeConfidenceMin = 4;
  const activeThemeRefreshIntervalMs = 2500;
  const themeBridgeTimeoutMs = 250;
  const themeMessageName = 'blended-addressbar:theme-response';
  const loadbarPrefBranch = 'uc.loadbar.';
  const loadbarHeightPref = `${loadbarPrefBranch}height`;
  const loadbarOpacityPref = `${loadbarPrefBranch}opacity`;
  const loadbarColorPref = `${loadbarPrefBranch}color`;
  const loadbarColorSourcePref = `${loadbarPrefBranch}color-source`;
  const selectorRulePref = 'uc.blended-addressbar.selector-rule';
  const chromeDoc = document;
  const themeCache = new WeakMap();
  let themeRequestSeq = 0;
  let servicesModule = null;
  let lastThemeKey = null;
  const themeApplyState = {
    href: '',
    applied: null,
    pending: null,
    pendingTimer: 0
  };
  let samplingActive = false;
  let samplingTimer = 0;
  let samplingInFlight = false;
  let lastCss = null;
  let lastLogAt = 0;
  let currentIntervalMs = samplingIntervalMs;
  let scheduledThemeTimers = [];
  let viewportThemeUpdateTimer = 0;
  let viewportResizeObserver = null;
  let loadingThemePollTimer = 0;
  let loadingThemePollStartedAt = 0;
  let loadingThemePollBrowser = null;
  let loadingThemePollHref = '';
  let activeThemeUpdateInFlight = false;
  let pendingActiveThemeUpdateOptions = null;
  let activeThemeRefreshTimer = 0;

  const setVar = (value, foreground) => {
    chromeDoc.documentElement.style.setProperty('--zen-tab-header-background', value || 'transparent');
    if (foreground) {
      chromeDoc.documentElement.style.setProperty('--zen-tab-header-foreground', foreground);
    } else {
      chromeDoc.documentElement.style.removeProperty('--zen-tab-header-foreground');
    }
  };

  function applyTheme(theme, reason) {
    if (!theme) return;

    setVar(theme.bg, theme.fg);
    setPageLoadbarColors(theme);

    if (!DEBUG_THEME) return;

    const root = chromeDoc.documentElement;
    root.setAttribute('data-blended-addressbar-theme-reason', reason || '');
    root.setAttribute('data-blended-addressbar-theme-bridge', theme.bridge || '');
    root.setAttribute('data-blended-addressbar-theme-source', theme.source || '');
    root.setAttribute('data-blended-addressbar-theme-bg', theme.bg || '');
    root.setAttribute('data-blended-addressbar-theme-fg', theme.fg || '');
    root.setAttribute('data-blended-addressbar-theme-href', theme.href || '');

    console.info('[blended-addressbar:urlbar] Theme resolved', {
      reason,
      href: theme.href,
      bridge: theme.bridge,
      source: theme.source,
      bg: theme.bg,
      fg: theme.fg,
      candidates: theme.candidates || null
    });
  }

  function getBrowserHref(browser) {
    return browser?.currentURI?.spec || '';
  }

  function getThemeKey(theme) {
    return `${theme?.bg || ''}|${theme?.fg || ''}`;
  }

  function getThemeSourceConfidence(themeOrSource) {
    const source = typeof themeOrSource === 'string'
      ? themeOrSource
      : (themeOrSource?.source || '');
    return {
      'selector-rule': 7,
      'dark-reader': 5,
      'top-visible': 6,
      'theme-color': 5,
      body: 3,
      html: 3,
      'document-canvas': 2,
      sampler: 1,
      'chrome-contrast-fallback': 1,
      'toolbar-fallback': 0
    }[source] ?? 0;
  }

  function clearPendingThemeCandidate() {
    if (themeApplyState.pendingTimer) clearTimeout(themeApplyState.pendingTimer);
    themeApplyState.pendingTimer = 0;
    themeApplyState.pending = null;
  }

  function resetThemeArbitration(href = '') {
    clearPendingThemeCandidate();
    themeApplyState.href = href;
    themeApplyState.applied = null;
  }

  function ensureThemeArbitrationHref(href) {
    if (themeApplyState.href !== href) {
      resetThemeArbitration(href);
    }
  }

  function shouldApplyThemeCandidate(theme, options = {}) {
    if (!theme?.bg) return { action: 'ignore', confidence: 0, key: '' };

    const {
      appliedConfidence = themeApplyState.applied?.confidence ?? -1,
      loading = false,
      now = Date.now(),
      pendingKey = themeApplyState.pending?.key || '',
      pendingSince = themeApplyState.pending?.since || 0,
      stableDelay = fallbackThemeStableDelayMs
    } = options;
    const confidence = getThemeSourceConfidence(theme);
    const key = `${getThemeKey(theme)}|${theme.source || ''}`;

    if (!loading) {
      return confidence >= appliedConfidence
        ? { action: 'apply', confidence, key }
        : { action: 'ignore', confidence, key };
    }

    if (appliedConfidence >= 0 && confidence <= appliedConfidence) {
      return { action: 'ignore', confidence, key };
    }

    if (confidence >= immediateThemeConfidenceMin) {
      return { action: 'apply', confidence, key };
    }

    if (pendingKey === key && pendingSince && now - pendingSince >= stableDelay) {
      return { action: 'apply', confidence, key };
    }

    return { action: 'defer', confidence, key };
  }

  function cacheTheme(browser, theme) {
    if (!browser || !theme?.bg) return;
    themeCache.set(browser, {
      href: theme.href || getBrowserHref(browser),
      theme
    });
  }

  function getCachedTheme(browser) {
    const cached = browser ? themeCache.get(browser) : null;
    if (!cached || cached.href !== getBrowserHref(browser)) return null;
    return cached.theme?.bg ? cached.theme : null;
  }

  function isLoadingThemeFor(browser) {
    return !!browser
      && browser === loadingThemePollBrowser
      && !!loadingThemePollStartedAt
      && getBrowserHref(browser) === loadingThemePollHref;
  }

  function applyThemeCandidateNow(browser, theme, reason, expectedHref, decision) {
    cacheTheme(browser, theme);
    clearPendingThemeCandidate();

    const key = getThemeKey(theme);
    themeApplyState.applied = {
      confidence: decision.confidence,
      href: getBrowserHref(browser),
      key,
      source: theme.source || ''
    };

    if (key !== lastThemeKey) {
      lastThemeKey = key;
      lastCss = theme.bg;
      applyTheme(theme, reason);
    }

    return true;
  }

  function queueStableThemeCandidate(browser, theme, reason, expectedHref, decision) {
    const href = getBrowserHref(browser);
    const now = Date.now();
    const pending = themeApplyState.pending;
    const sameCandidate = pending?.href === href && pending.key === decision.key;
    const since = sameCandidate ? pending.since : now;

    if (themeApplyState.pendingTimer) clearTimeout(themeApplyState.pendingTimer);
    themeApplyState.pending = {
      confidence: decision.confidence,
      expectedHref,
      href,
      key: decision.key,
      reason,
      since,
      theme
    };

    const elapsed = now - since;
    const remaining = Math.max(0, fallbackThemeStableDelayMs - elapsed);
    themeApplyState.pendingTimer = setTimeout(() => {
      const queued = themeApplyState.pending;
      if (!queued || queued.key !== decision.key || queued.href !== getBrowserHref(browser)) return;
      void applyResolvedTheme(browser, queued.theme, queued.reason, queued.expectedHref, {
        loading: true,
        now: Date.now()
      });
    }, remaining);
  }

  function applyResolvedTheme(browser, theme, reason, expectedHref = null, options = {}) {
    if (!theme?.bg || !browser || browser !== gBrowser?.selectedBrowser) return false;
    if (expectedHref && getBrowserHref(browser) !== expectedHref) return false;
    if (expectedHref && theme.href && theme.href !== expectedHref) return false;

    const visibleTheme = hasVisibleColor(theme.bg)
      ? theme
      : getChromeContrastFallbackTheme(browser, 'chrome-contrast-fallback');

    const href = getBrowserHref(browser);
    ensureThemeArbitrationHref(href);

    const decision = shouldApplyThemeCandidate(visibleTheme, {
      loading: options.loading ?? isLoadingThemeFor(browser),
      now: options.now ?? Date.now()
    });

    if (decision.action === 'ignore') return false;
    if (decision.action === 'defer') {
      queueStableThemeCandidate(browser, visibleTheme, reason, expectedHref, decision);
      return false;
    }

    return applyThemeCandidateNow(browser, visibleTheme, reason, expectedHref, decision);
  }

  function getPrefs() {
    try {
      if (typeof Services !== 'undefined') return Services.prefs;
    } catch {}

    try {
      if (!servicesModule && typeof ChromeUtils !== 'undefined') {
        servicesModule = ChromeUtils.importESModule('resource://gre/modules/Services.sys.mjs').Services;
      }
      return servicesModule?.prefs || null;
    } catch {}

    return null;
  }

  function readStringPref(name, fallback) {
    const prefs = getPrefs();
    if (!prefs) return fallback;

    try {
      return prefs.getStringPref(name, fallback);
    } catch {}

    try {
      return prefs.getCharPref(name, fallback);
    } catch {}

    return fallback;
  }

  function cssSupports(property, value) {
    try {
      return !!window.CSS?.supports?.(property, value);
    } catch {
      return false;
    }
  }

  function normalizeCssLength(value, fallback) {
    const raw = String(value || '').trim();
    if (!raw) return fallback;

    const normalized = /^\d+(?:\.\d+)?$/.test(raw) ? `${raw}px` : raw;
    return cssSupports('height', normalized) ? normalized : fallback;
  }

  function normalizeCssColor(value, fallback) {
    const raw = String(value || '').trim();
    if (!raw) return fallback;

    return cssSupports('color', raw) ? raw : fallback;
  }

  function normalizeOpacity(value, fallback) {
    const raw = String(value || '').trim();
    if (!raw) return fallback;

    const match = raw.match(/^(\d+(?:\.\d+)?)\s*(%)?$/);
    if (!match) return fallback;

    const amount = Number(match[1]);
    if (!Number.isFinite(amount)) return fallback;

    const alpha = (match[2] || amount > 1) ? amount / 100 : amount;
    const clamped = Math.max(0, Math.min(1, alpha));
    return `${Math.round(clamped * 1000) / 1000}`;
  }

  function setPageLoadbarColors(theme) {
    const root = chromeDoc.documentElement;
    if (hasVisibleColor(theme?.bg)) {
      root.style.setProperty('--blended-addressbar-page-loadbar-background', theme.bg);
    } else {
      root.style.removeProperty('--blended-addressbar-page-loadbar-background');
    }

    if (hasVisibleColor(theme?.fg)) {
      root.style.setProperty('--blended-addressbar-page-loadbar-foreground', theme.fg);
      return;
    }

    const bgRgb = parseCssRgb(theme?.bg);
    if (bgRgb) {
      root.style.setProperty('--blended-addressbar-page-loadbar-foreground', chooseForeground(bgRgb));
    } else {
      root.style.removeProperty('--blended-addressbar-page-loadbar-foreground');
    }
  }

  function applyLoadbarPrefs() {
    const root = chromeDoc.documentElement;
    const height = normalizeCssLength(readStringPref(loadbarHeightPref, '2px'), '2px');
    const opacity = normalizeOpacity(readStringPref(loadbarOpacityPref, '85'), '0.85');
    const customColor = normalizeCssColor(readStringPref(loadbarColorPref, '#3b82f6'), '#3b82f6');
    const colorSource = readStringPref(loadbarColorSourcePref, 'zen');

    const colorValue = {
      custom: 'var(--blended-addressbar-loadbar-custom-color)',
      'page-background': 'var(--blended-addressbar-page-loadbar-background, var(--zen-primary-color))',
      'page-foreground': 'var(--blended-addressbar-page-loadbar-foreground, var(--zen-primary-color))',
      zen: 'var(--zen-primary-color)'
    }[colorSource] || 'var(--zen-primary-color)';

    root.style.setProperty('--blended-addressbar-loadbar-height', height);
    root.style.setProperty('--blended-addressbar-loadbar-opacity', opacity);
    root.style.setProperty('--blended-addressbar-loadbar-custom-color', customColor);
    root.style.setProperty('--blended-addressbar-loadbar-color', colorValue);

    if (DEBUG_THEME) {
      root.setAttribute('data-blended-addressbar-loadbar-height', height);
      root.setAttribute('data-blended-addressbar-loadbar-opacity', opacity);
      root.setAttribute('data-blended-addressbar-loadbar-color-source', colorSource);
      root.setAttribute('data-blended-addressbar-loadbar-custom-color', customColor);
    }
  }

  function observeLoadbarPrefs() {
    const prefs = getPrefs();
    if (!prefs?.addObserver) return;

    const observer = {
      observe(_subject, topic, prefName) {
        if (topic === 'nsPref:changed' && String(prefName || '').startsWith(loadbarPrefBranch)) {
          applyLoadbarPrefs();
        }
      }
    };

    try {
      prefs.addObserver(loadbarPrefBranch, observer);
      if (typeof addUnloadListener === 'function') {
        addUnloadListener(() => {
          try {
            prefs.removeObserver(loadbarPrefBranch, observer);
          } catch {}
        });
      }
    } catch {}
  }

  function getRelativeLuminance({ r, g, b }) {
    const toLinear = (c) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  }

  function getContrastRatio(colorA, colorB) {
    const lumA = getRelativeLuminance(colorA);
    const lumB = getRelativeLuminance(colorB);
    const lighter = Math.max(lumA, lumB);
    const darker = Math.min(lumA, lumB);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function chooseForeground({ r, g, b }) {
    const luminance = getRelativeLuminance({ r, g, b });
    return luminance > 0.6 ? 'rgba(11, 13, 16, 0.92)' : 'rgba(245, 247, 251, 0.96)';
  }

  function parseCssRgb(input) {
    if (!input) return null;
    const raw = String(input).trim();
    const perceptual = raw.match(/^ok(?:lab|lch)\(\s*(\d+(?:\.\d+)?%?)/i);
    if (perceptual) {
      const channel = perceptual[1];
      const lightness = channel.endsWith('%')
        ? parseFloat(channel) / 100
        : parseFloat(channel);
      if (Number.isFinite(lightness)) {
        const value = Math.max(0, Math.min(255, Math.round(lightness * 255)));
        return { r: value, g: value, b: value };
      }
    }

    const hex = raw.match(/^#([0-9a-f]{3,8})$/i);
    if (hex) {
      const value = hex[1];
      const expand = (part) => part.length === 1 ? `${part}${part}` : part;
      const r = parseInt(expand(value.length <= 4 ? value[0] : value.slice(0, 2)), 16);
      const g = parseInt(expand(value.length <= 4 ? value[1] : value.slice(2, 4)), 16);
      const b = parseInt(expand(value.length <= 4 ? value[2] : value.slice(4, 6)), 16);
      return { r, g, b };
    }

    const m = raw.match(/^rgba?\(([^)]+)\)$/i);
    if (!m) return null;
    const parts = m[1].replace(/\s*\/\s*[\d.]+%?$/, '').split(/[,\s]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const readChannel = (part) => {
      const value = parseFloat(part);
      const scaled = String(part).trim().endsWith('%') ? value * 2.55 : value;
      return Math.max(0, Math.min(255, Math.round(scaled)));
    };
    const r = readChannel(parts[0]);
    const g = readChannel(parts[1]);
    const b = readChannel(parts[2]);
    return { r, g, b };
  }

  function getCssColorAlpha(value) {
    const match = String(value || '').trim().match(/^[a-z-]+\(([^)]+)\)$/i);
    if (!match) return null;

    const body = match[1].trim();
    let alpha = null;
    if (body.includes('/')) {
      alpha = body.slice(body.lastIndexOf('/') + 1).trim();
    } else {
      const parts = body.split(',');
      if (parts.length === 4) alpha = parts[3].trim();
    }

    if (alpha === null) return null;

    const amount = parseFloat(alpha);
    if (!Number.isFinite(amount)) return null;
    return alpha.endsWith('%') ? amount / 100 : amount;
  }

  function hasVisibleColor(input) {
    if (!input) return false;
    const value = String(input).trim().toLowerCase();
    if (!value || value === 'transparent') return false;
    const alpha = getCssColorAlpha(value);
    if (alpha !== null && alpha < sampledColorMinAlpha) return false;
    return true;
  }

  function extractCssColor(input) {
    const value = String(input || '').trim();
    if (!value || value === 'none') return null;

    const candidates = value.match(/[a-z-]+\([^)]*\)|#[0-9a-f]{3,8}\b/gi) || [];
    return candidates.find(color => hasVisibleColor(color) && cssSupports('color', color)) || null;
  }

  function getStyleBackground(style) {
    if (!style) return null;
    if (hasVisibleColor(style.backgroundColor)) return style.backgroundColor;
    return extractCssColor(style.backgroundImage);
  }

  function describeElementTheme(view, element) {
    if (!view || !element) {
      return { found: false, bg: null, fg: null };
    }

    const style = view.getComputedStyle(element);
    return {
      found: true,
      bg: getStyleBackground(style),
      fg: style.color || null
    };
  }

  function getViewportSize(view, doc = null) {
    const root = doc?.documentElement || view?.document?.documentElement || null;
    return {
      width: view?.innerWidth || root?.clientWidth || 0,
      height: view?.innerHeight || root?.clientHeight || 0
    };
  }

  function rectIntersectsViewport(view, rect) {
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;

    const { width, height } = getViewportSize(view);
    if (!width || !height) return true;

    return rect.right > 0
      && rect.bottom > 0
      && rect.left < width
      && rect.top < height;
  }

  function isRenderedElement(view, element) {
    if (!view || !element) return false;
    const style = view.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
      return false;
    }

    const rects = element.getClientRects();
    for (const rect of rects) {
      if (rectIntersectsViewport(view, rect)) return true;
    }

    return false;
  }

  function getFirstRenderedElement(view, doc, selector) {
    const elements = doc?.querySelectorAll?.(selector) || [];
    for (const element of elements) {
      if (isRenderedElement(view, element)) return element;
    }

    return doc?.querySelector?.(selector) || null;
  }

  function getTopVisibleElement(view, doc) {
    if (!view || !doc) return null;

    const { width, height } = getViewportSize(view, doc);
    const xMid = Math.max(1, Math.floor((width || 2) / 2));
    const xEnd = Math.max(1, (width || 2) - 2);
    const yTop = Math.min(3, Math.max(0, (height || 4) - 1));
    const yBand = Math.min(30, Math.max(0, (height || 31) - 1));
    const points = [
      [1, yTop],
      [xMid, yTop],
      [xEnd, yTop],
      [1, yBand],
      [xMid, yBand]
    ];

    let firstRendered = null;
    for (const [x, y] of points) {
      const elements = typeof doc.elementsFromPoint === 'function'
        ? doc.elementsFromPoint(x, y)
        : (typeof doc.elementFromPoint === 'function' ? [doc.elementFromPoint(x, y)] : []);

      for (const element of elements) {
        if (!isRenderedElement(view, element)) continue;
        firstRendered ||= element;

        const background = getStyleBackground(view.getComputedStyle(element));
        if (hasVisibleColor(background)) return element;
      }
    }

    return firstRendered || (typeof doc.elementFromPoint === 'function' ? doc.elementFromPoint(1, 3) : null);
  }

  function getDescendantBackground(view, element) {
    if (!view || !element?.querySelectorAll) return null;

    const doc = element.ownerDocument || null;
    if (element === doc?.body || element === doc?.documentElement) return null;

    const elementRect = element.getBoundingClientRect();
    const { width: viewportWidth, height: viewportHeight } = getViewportSize(view, doc);
    const maxWidth = Math.max(1, Math.min(elementRect.width || viewportWidth || 1, viewportWidth || elementRect.width || 1));
    let best = null;
    let inspected = 0;

    const descendants = element.querySelectorAll('*');
    for (const descendant of descendants) {
      if (inspected >= 64) break;
      if (!isRenderedElement(view, descendant)) continue;
      inspected++;

      const style = view.getComputedStyle(descendant);
      const background = getStyleBackground(style);
      if (!hasVisibleColor(background)) continue;

      const rect = descendant.getBoundingClientRect();
      const visibleWidth = Math.max(0, Math.min(rect.right, viewportWidth || rect.right) - Math.max(rect.left, 0));
      const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight || rect.bottom) - Math.max(rect.top, 0));
      if (visibleWidth < 16 || visibleHeight < 8) continue;

      const widthCoverage = visibleWidth / maxWidth;
      if (widthCoverage < 0.35) continue;

      const topDistance = Math.max(0, rect.top - Math.max(0, elementRect.top));
      const score = (widthCoverage * 1000) + Math.min(visibleHeight, 96) - topDistance;

      if (!best || score > best.score) {
        best = { value: background, score };
      }
    }

    return best?.value || null;
  }

  function addColorCandidate(candidates, value, priority = 'text') {
    if (hasVisibleColor(value)) {
      candidates.push({ value, priority });
    }
  }

  function isLinkLikeElement(element) {
    const role = element?.getAttribute?.('role');
    return element?.localName === 'a'
      || element?.localName === 'button'
      || role === 'link'
      || role === 'button'
      || !!element?.closest?.('a,button,[role="link"],[role="button"]');
  }

  function collectForegroundCandidates(view, element, allowPageFallback = true) {
    const candidates = [];
    if (!view || !element) return candidates;

    const doc = element.ownerDocument || null;
    let current = element;
    while (current) {
      if (!allowPageFallback && (current === doc?.body || current === doc?.documentElement)) break;

      const style = view.getComputedStyle(current);
      addColorCandidate(candidates, style.color, 'text');
      addColorCandidate(candidates, style.fill, 'text');
      addColorCandidate(candidates, style.stroke, 'text');
      current = current.parentElement;
    }

    return candidates;
  }

  function getReadableForeground(bg, candidates = []) {
    const bgRgb = parseCssRgb(bg);
    if (!bgRgb) {
      const fallback = candidates.find(candidate => hasVisibleColor(
        typeof candidate === 'string' ? candidate : candidate?.value
      ));
      return typeof fallback === 'string' ? fallback : (fallback?.value || null);
    }

    const minimumReadableContrast = 3;
    const preferredReadableContrast = 4.5;
    const seen = new Set();
    let best = null;

    for (const candidate of candidates) {
      const value = typeof candidate === 'string' ? candidate : candidate?.value;
      const priority = typeof candidate === 'string' ? 'text' : candidate?.priority;
      if (!hasVisibleColor(value)) continue;
      const key = String(value).trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const rgb = parseCssRgb(value);
      if (!rgb) continue;

      const ratio = getContrastRatio(bgRgb, rgb);
      if (priority === 'link' && ratio >= minimumReadableContrast) return value;
      if (ratio >= preferredReadableContrast) return value;
      if (ratio >= minimumReadableContrast && (!best || ratio > best.ratio)) {
        best = { value, ratio };
      }
    }

    if (best) return best.value;

    const fallbacks = ['rgba(11, 13, 16, 0.92)', 'rgba(245, 247, 251, 0.96)'];
    return fallbacks
      .map(value => ({ value, ratio: getContrastRatio(bgRgb, parseCssRgb(value)) }))
      .sort((a, b) => b.ratio - a.ratio)[0].value;
  }

  function getThemeFromElement(view, element, source = 'element', allowPageFallback = true) {
    if (!view || !element) return null;

    let fg = null;
    let bg = null;
    let current = element;
    const doc = element.ownerDocument || null;
    const elementBackground = getStyleBackground(view.getComputedStyle(element));

    while (current) {
      if (!allowPageFallback && (current === doc?.body || current === doc?.documentElement)) break;

      const style = view.getComputedStyle(current);
      if (!fg && hasVisibleColor(style.color)) {
        fg = style.color;
      }
      const background = getStyleBackground(style);
      if (!bg && hasVisibleColor(background)) {
        bg = background;
      }
      if (bg && fg) break;
      current = current.parentElement;
    }

    const descendantBackground = getDescendantBackground(view, element);
    if (descendantBackground && !hasVisibleColor(elementBackground)) {
      bg = descendantBackground;
    } else if (!bg) {
      bg = descendantBackground;
    }

    if (!bg) return null;
    const fgCandidates = [
      ...collectForegroundCandidates(view, element, allowPageFallback),
      { value: fg, priority: 'text' }
    ];
    return {
      bg,
      fg: getReadableForeground(bg, fgCandidates),
      source
    };
  }

  function getDarkReaderTheme(doc, view) {
    const root = doc?.documentElement;
    if (!root || !view) return null;

    const rootStyle = view.getComputedStyle(root);
    const bodyStyle = doc.body ? view.getComputedStyle(doc.body) : null;
    const bg = rootStyle.getPropertyValue('--darkreader-neutral-background').trim()
      || (bodyStyle?.getPropertyValue('--darkreader-neutral-background').trim() || '');
    const fg = rootStyle.getPropertyValue('--darkreader-neutral-text').trim()
      || (bodyStyle?.getPropertyValue('--darkreader-neutral-text').trim() || '');

    if (!hasVisibleColor(bg)) return null;

    const bgRgb = parseCssRgb(bg);
    return {
      bg,
      fg: getReadableForeground(bg, [fg, bgRgb ? chooseForeground(bgRgb) : null]),
      source: 'dark-reader'
    };
  }

  function getThemeColorTheme(doc, view) {
    if (!doc || !view) return null;

    const metas = doc.querySelectorAll?.('meta[name="theme-color" i]') || [];
    for (const meta of metas) {
      const media = meta.getAttribute?.('media') || '';
      if (media) {
        try {
          if (!view.matchMedia(media).matches) continue;
        } catch {}
      }

      const bg = meta.getAttribute?.('content') || '';
      if (!hasVisibleColor(bg) || !cssSupports('color', bg)) continue;

      const rootStyle = doc.documentElement ? view.getComputedStyle(doc.documentElement) : null;
      const bodyStyle = doc.body ? view.getComputedStyle(doc.body) : null;
      const bgRgb = parseCssRgb(bg);
      return {
        bg,
        fg: getReadableForeground(bg, [
          bodyStyle?.color || null,
          rootStyle?.color || null,
          bgRgb ? chooseForeground(bgRgb) : null
        ]),
        source: 'theme-color'
      };
    }

    return null;
  }

  function parseSelectorRule(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;

    try {
      const rule = JSON.parse(raw);
      if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return null;

      const url = String(rule.url || '').trim();
      const bg = String(rule.bg || '').trim();
      const fg = String(rule.fg || '').trim();
      return url && bg ? { url, bg, fg } : null;
    } catch {
      return null;
    }
  }

  function wildcardMatches(pattern, value) {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`).test(value);
  }

  function selectorRuleMatchesUrl(pattern, href) {
    const ruleUrl = String(pattern || '').trim();
    if (!ruleUrl || !href) return false;
    if (ruleUrl.includes('*')) return wildcardMatches(ruleUrl, href);

    try {
      if (ruleUrl.includes('://')) return href.startsWith(ruleUrl);
      return new URL(href).hostname === ruleUrl;
    } catch {
      return href.startsWith(ruleUrl);
    }
  }

  function getSelectorRuleElement(view, doc, selector) {
    const raw = String(selector || '').trim();
    if (!raw) return null;

    try {
      return getFirstRenderedElement(view, doc, raw);
    } catch {
      return null;
    }
  }

  function getSelectorRuleTheme(doc, view, href, value) {
    if (!doc || !view) return null;

    const rule = parseSelectorRule(value);
    if (!rule || !selectorRuleMatchesUrl(rule.url, href || doc.location?.href || '')) return null;

    const bgElement = getSelectorRuleElement(view, doc, rule.bg);
    const bgTheme = getThemeFromElement(view, bgElement, 'selector-rule', false);
    if (!bgTheme?.bg) return null;

    const foregroundCandidates = [];
    const fgElement = getSelectorRuleElement(view, doc, rule.fg);
    if (fgElement) {
      foregroundCandidates.push(...collectForegroundCandidates(view, fgElement, false));
    }
    foregroundCandidates.push(...collectForegroundCandidates(view, bgElement, false));
    foregroundCandidates.push(bgTheme.fg);

    return {
      bg: bgTheme.bg,
      fg: getReadableForeground(bgTheme.bg, foregroundCandidates),
      source: 'selector-rule',
      selectorRule: rule
    };
  }

  function getTopVisibleTheme(doc, view) {
    if (!doc || !view) return null;

    const element = getTopVisibleElement(view, doc);
    if (!element || element === doc.body || element === doc.documentElement) return null;

    return getThemeFromElement(view, element, 'top-visible', false);
  }

  function getDocumentCanvasTheme(doc, view) {
    const root = doc?.documentElement;
    if (!doc || !view || !root) return null;

    const rootStyle = view.getComputedStyle(root);
    const bodyStyle = doc.body ? view.getComputedStyle(doc.body) : null;
    let canvasFg = '';
    let probe = null;

    try {
      probe = doc.createElement('div');
      probe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;pointer-events:none;background-color:Canvas;color:CanvasText;';
      root.appendChild(probe);
      const probeStyle = view.getComputedStyle(probe);
      canvasFg = probeStyle.color;
    } catch {
    } finally {
      try { probe?.remove?.(); } catch {}
    }

    const bg = [
      bodyStyle ? getStyleBackground(bodyStyle) : null,
      getStyleBackground(rootStyle)
    ].find(hasVisibleColor);

    if (!bg) return null;

    return {
      bg,
      fg: getReadableForeground(bg, [
        bodyStyle?.color || null,
        rootStyle?.color || null,
        canvasFg || null
      ]),
      source: 'document-canvas'
    };
  }

  function getBrowserPageThemeFromChrome(browser) {
    try {
      const doc = browser?.contentDocument;
      const view = doc?.defaultView;
      const root = doc?.documentElement;
      if (!doc || !view || !root) return null;

      const href = doc.location?.href || '';
      const browserHref = browser?.currentURI?.spec || '';
      if (browserHref && href && href !== browserHref) return null;

      const candidates = {
        body: describeElementTheme(view, doc.body),
        html: describeElementTheme(view, root)
      };

      const withMeta = (theme) => theme && ({
        ...theme,
        bridge: 'chrome',
        href,
        candidates
      });

      const selectorRuleValue = readStringPref(selectorRulePref, '');
      return withMeta(getSelectorRuleTheme(doc, view, href, selectorRuleValue))
        || withMeta(getDarkReaderTheme(doc, view))
        || withMeta(getTopVisibleTheme(doc, view))
        || withMeta(getThemeColorTheme(doc, view))
        || withMeta(getThemeFromElement(view, doc.body, 'body'))
        || withMeta(getThemeFromElement(view, root, 'html'))
        || withMeta(getDocumentCanvasTheme(doc, view));
    } catch (error) {
      if (DEBUG_VERBOSE) console.warn('[blended-addressbar:urlbar] Unable to read page theme', error);
      return null;
    }
  }

  function getBrowserMessageManager(browser) {
    return browser?.messageManager || browser?.frameLoader?.messageManager || null;
  }

  function getThemeFrameScript(requestId) {
    return `
      (() => {
        const requestId = ${JSON.stringify(requestId)};
        const messageName = ${JSON.stringify(themeMessageName)};
        const selectorRuleValue = ${JSON.stringify(readStringPref(selectorRulePref, ''))};

        const send = (payload) => {
          sendAsyncMessage(messageName, { requestId, ...payload });
        };

        const describeElementTheme = (view, element) => {
          if (!view || !element) {
            return { found: false, bg: null, fg: null };
          }

          const style = view.getComputedStyle(element);
          return {
            found: true,
            bg: getStyleBackground(style),
            fg: style.color || null
          };
        };

        const getViewportSize = (view, doc = null) => {
          const root = doc?.documentElement || view?.document?.documentElement || null;
          return {
            width: view?.innerWidth || root?.clientWidth || 0,
            height: view?.innerHeight || root?.clientHeight || 0
          };
        };

        const rectIntersectsViewport = (view, rect) => {
          if (!rect || rect.width <= 0 || rect.height <= 0) return false;

          const { width, height } = getViewportSize(view);
          if (!width || !height) return true;

          return rect.right > 0
            && rect.bottom > 0
            && rect.left < width
            && rect.top < height;
        };

        const isRenderedElement = (view, element) => {
          if (!view || !element) return false;
          const style = view.getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
            return false;
          }

          const rects = element.getClientRects();
          for (const rect of rects) {
            if (rectIntersectsViewport(view, rect)) return true;
          }

          return false;
        };

        const getFirstRenderedElement = (view, doc, selector) => {
          const elements = doc?.querySelectorAll?.(selector) || [];
          for (const element of elements) {
            if (isRenderedElement(view, element)) return element;
          }

          return doc?.querySelector?.(selector) || null;
        };

        const getTopVisibleElement = (view, doc) => {
          if (!view || !doc) return null;

          const { width, height } = getViewportSize(view, doc);
          const xMid = Math.max(1, Math.floor((width || 2) / 2));
          const xEnd = Math.max(1, (width || 2) - 2);
          const yTop = Math.min(3, Math.max(0, (height || 4) - 1));
          const yBand = Math.min(30, Math.max(0, (height || 31) - 1));
          const points = [
            [1, yTop],
            [xMid, yTop],
            [xEnd, yTop],
            [1, yBand],
            [xMid, yBand]
          ];

          let firstRendered = null;
          for (const [x, y] of points) {
            const elements = typeof doc.elementsFromPoint === 'function'
              ? doc.elementsFromPoint(x, y)
              : (typeof doc.elementFromPoint === 'function' ? [doc.elementFromPoint(x, y)] : []);

            for (const element of elements) {
              if (!isRenderedElement(view, element)) continue;
              firstRendered ||= element;

              const background = getStyleBackground(view.getComputedStyle(element));
              if (hasVisibleColor(background)) return element;
            }
          }

          return firstRendered || (typeof doc.elementFromPoint === 'function' ? doc.elementFromPoint(1, 3) : null);
        };

        const getCssColorAlpha = (value) => {
          const match = String(value || '').trim().match(/^[a-z-]+\\(([^)]+)\\)$/i);
          if (!match) return null;

          const body = match[1].trim();
          let alpha = null;
          if (body.includes('/')) {
            alpha = body.slice(body.lastIndexOf('/') + 1).trim();
          } else {
            const parts = body.split(',');
            if (parts.length === 4) alpha = parts[3].trim();
          }

          if (alpha === null) return null;

          const amount = parseFloat(alpha);
          if (!Number.isFinite(amount)) return null;
          return alpha.endsWith('%') ? amount / 100 : amount;
        };

        function hasVisibleColor(input) {
          if (!input) return false;
          const value = String(input).trim().toLowerCase();
          if (!value || value === 'transparent') return false;
          const alpha = getCssColorAlpha(value);
          if (alpha !== null && alpha < ${sampledColorMinAlpha}) return false;
          return true;
        }

        const extractCssColor = (input) => {
          const value = String(input || '').trim();
          if (!value || value === 'none') return null;

          const candidates = value.match(/[a-z-]+\\([^)]*\\)|#[0-9a-f]{3,8}\\b/gi) || [];
          return candidates.find((color) => hasVisibleColor(color)
            && typeof CSS !== 'undefined'
            && CSS.supports?.('color', color)) || null;
        };

        function getStyleBackground(style) {
          if (!style) return null;
          if (hasVisibleColor(style.backgroundColor)) return style.backgroundColor;
          return extractCssColor(style.backgroundImage);
        }

        const getDescendantBackground = (view, element) => {
          if (!view || !element?.querySelectorAll) return null;

          const doc = element.ownerDocument || null;
          if (element === doc?.body || element === doc?.documentElement) return null;

          const elementRect = element.getBoundingClientRect();
          const { width: viewportWidth, height: viewportHeight } = getViewportSize(view, doc);
          const maxWidth = Math.max(1, Math.min(elementRect.width || viewportWidth || 1, viewportWidth || elementRect.width || 1));
          let best = null;
          let inspected = 0;

          const descendants = element.querySelectorAll('*');
          for (const descendant of descendants) {
            if (inspected >= 64) break;
            if (!isRenderedElement(view, descendant)) continue;
            inspected++;

            const style = view.getComputedStyle(descendant);
            const background = getStyleBackground(style);
            if (!hasVisibleColor(background)) continue;

            const rect = descendant.getBoundingClientRect();
            const visibleWidth = Math.max(0, Math.min(rect.right, viewportWidth || rect.right) - Math.max(rect.left, 0));
            const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight || rect.bottom) - Math.max(rect.top, 0));
            if (visibleWidth < 16 || visibleHeight < 8) continue;

            const widthCoverage = visibleWidth / maxWidth;
            if (widthCoverage < 0.35) continue;

            const topDistance = Math.max(0, rect.top - Math.max(0, elementRect.top));
            const score = (widthCoverage * 1000) + Math.min(visibleHeight, 96) - topDistance;

            if (!best || score > best.score) {
              best = { value: background, score };
            }
          }

          return best?.value || null;
        };

        const getRelativeLuminance = ({ r, g, b }) => {
          const toLinear = (channel) => {
            const value = channel / 255;
            return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
        };

        const getContrastRatio = (colorA, colorB) => {
          const lumA = getRelativeLuminance(colorA);
          const lumB = getRelativeLuminance(colorB);
          const lighter = Math.max(lumA, lumB);
          const darker = Math.min(lumA, lumB);
          return (lighter + 0.05) / (darker + 0.05);
        };

        const chooseForeground = ({ r, g, b }) => {
          const luminance = getRelativeLuminance({ r, g, b });
          return luminance > 0.6 ? 'rgba(11, 13, 16, 0.92)' : 'rgba(245, 247, 251, 0.96)';
        };

        const parseCssRgb = (input) => {
          if (!input) return null;
          const raw = String(input).trim();
          const perceptual = raw.match(/^ok(?:lab|lch)\\(\\s*(\\d+(?:\\.\\d+)?%?)/i);
          if (perceptual) {
            const channel = perceptual[1];
            const lightness = channel.endsWith('%')
              ? parseFloat(channel) / 100
              : parseFloat(channel);
            if (Number.isFinite(lightness)) {
              const value = Math.max(0, Math.min(255, Math.round(lightness * 255)));
              return { r: value, g: value, b: value };
            }
          }

          const hex = raw.match(/^#([0-9a-f]{3,8})$/i);
          if (hex) {
            const value = hex[1];
            const expand = (part) => part.length === 1 ? part + part : part;
            const r = parseInt(expand(value.length <= 4 ? value[0] : value.slice(0, 2)), 16);
            const g = parseInt(expand(value.length <= 4 ? value[1] : value.slice(2, 4)), 16);
            const b = parseInt(expand(value.length <= 4 ? value[2] : value.slice(4, 6)), 16);
            return { r, g, b };
          }

          const match = raw.match(/^rgba?\\(([^)]+)\\)$/i);
          if (!match) return null;
          const parts = match[1].replace(/\\s*\\/\\s*[\\d.]+%?$/, '').split(/[,\\s]+/).filter(Boolean);
          if (parts.length < 3) return null;
          const readChannel = (part) => {
            const value = parseFloat(part);
            const scaled = String(part).trim().endsWith('%') ? value * 2.55 : value;
            return Math.max(0, Math.min(255, Math.round(scaled)));
          };
          return { r: readChannel(parts[0]), g: readChannel(parts[1]), b: readChannel(parts[2]) };
        };

        const addColorCandidate = (candidates, value, priority = 'text') => {
          if (hasVisibleColor(value)) candidates.push({ value, priority });
        };

        const isLinkLikeElement = (element) => {
          const role = element?.getAttribute?.('role');
          return element?.localName === 'a'
            || element?.localName === 'button'
            || role === 'link'
            || role === 'button'
            || !!element?.closest?.('a,button,[role="link"],[role="button"]');
        };

        const collectForegroundCandidates = (view, element, allowPageFallback = true) => {
          const ancestorCandidates = [];
          if (!view || !element) return ancestorCandidates;

          const doc = element.ownerDocument || null;
          let current = element;
          while (current) {
            if (!allowPageFallback && (current === doc?.body || current === doc?.documentElement)) break;

            const style = view.getComputedStyle(current);
            addColorCandidate(ancestorCandidates, style.color, 'text');
            addColorCandidate(ancestorCandidates, style.fill, 'text');
            addColorCandidate(ancestorCandidates, style.stroke, 'text');
            current = current.parentElement;
          }

          return ancestorCandidates;
        };

        const getReadableForeground = (bg, candidates = []) => {
          const bgRgb = parseCssRgb(bg);
          if (!bgRgb) {
            const fallback = candidates.find((candidate) => hasVisibleColor(
              typeof candidate === 'string' ? candidate : candidate?.value
            ));
            return typeof fallback === 'string' ? fallback : (fallback?.value || null);
          }

          const minimumReadableContrast = 3;
          const preferredReadableContrast = 4.5;
          const seen = new Set();
          let best = null;

          for (const candidate of candidates) {
            const value = typeof candidate === 'string' ? candidate : candidate?.value;
            const priority = typeof candidate === 'string' ? 'text' : candidate?.priority;
            if (!hasVisibleColor(value)) continue;
            const key = String(value).trim().toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);

            const rgb = parseCssRgb(value);
            if (!rgb) continue;

            const ratio = getContrastRatio(bgRgb, rgb);
            if (priority === 'link' && ratio >= minimumReadableContrast) return value;
            if (ratio >= preferredReadableContrast) return value;
            if (ratio >= minimumReadableContrast && (!best || ratio > best.ratio)) {
              best = { value, ratio };
            }
          }

          if (best) return best.value;

          const fallbacks = ['rgba(11, 13, 16, 0.92)', 'rgba(245, 247, 251, 0.96)'];
          return fallbacks
            .map((value) => ({ value, ratio: getContrastRatio(bgRgb, parseCssRgb(value)) }))
            .sort((a, b) => b.ratio - a.ratio)[0].value;
        };

        const getThemeFromElement = (view, element, source = 'element', allowPageFallback = true) => {
          if (!view || !element) return null;
          let fg = null;
          let bg = null;
          let current = element;
          const doc = element.ownerDocument || null;
          const elementBackground = getStyleBackground(view.getComputedStyle(element));
          while (current) {
            if (!allowPageFallback && (current === doc?.body || current === doc?.documentElement)) break;

            const style = view.getComputedStyle(current);
            if (!fg && hasVisibleColor(style.color)) fg = style.color;
            const background = getStyleBackground(style);
            if (!bg && hasVisibleColor(background)) bg = background;
            if (bg && fg) break;
            current = current.parentElement;
          }
          const descendantBackground = getDescendantBackground(view, element);
          if (descendantBackground && !hasVisibleColor(elementBackground)) {
            bg = descendantBackground;
          } else if (!bg) {
            bg = descendantBackground;
          }
          if (!bg) return null;
          const fgCandidates = [
            ...collectForegroundCandidates(view, element, allowPageFallback),
            { value: fg, priority: 'text' }
          ];
          return {
            bg,
            fg: getReadableForeground(bg, fgCandidates),
            source
          };
        };

        const getDarkReaderTheme = (doc, view) => {
          const root = doc?.documentElement;
          if (!root || !view) return null;

          const rootStyle = view.getComputedStyle(root);
          const bodyStyle = doc.body ? view.getComputedStyle(doc.body) : null;
          const bg = rootStyle.getPropertyValue('--darkreader-neutral-background').trim()
            || (bodyStyle?.getPropertyValue('--darkreader-neutral-background').trim() || '');
          const fg = rootStyle.getPropertyValue('--darkreader-neutral-text').trim()
            || (bodyStyle?.getPropertyValue('--darkreader-neutral-text').trim() || '');

          if (!hasVisibleColor(bg)) return null;

          const bgRgb = parseCssRgb(bg);
          return {
            bg,
            fg: getReadableForeground(bg, [fg, bgRgb ? chooseForeground(bgRgb) : null]),
            source: 'dark-reader'
          };
        };

        const getThemeColorTheme = (doc, view) => {
          if (!doc || !view) return null;

          const metas = doc.querySelectorAll?.('meta[name="theme-color" i]') || [];
          for (const meta of metas) {
            const media = meta.getAttribute?.('media') || '';
            if (media) {
              try {
                if (!view.matchMedia(media).matches) continue;
              } catch {}
            }

            const bg = meta.getAttribute?.('content') || '';
            if (!hasVisibleColor(bg)
              || typeof CSS === 'undefined'
              || !CSS.supports?.('color', bg)) {
              continue;
            }

            const rootStyle = doc.documentElement ? view.getComputedStyle(doc.documentElement) : null;
            const bodyStyle = doc.body ? view.getComputedStyle(doc.body) : null;
            const bgRgb = parseCssRgb(bg);
            return {
              bg,
              fg: getReadableForeground(bg, [
                bodyStyle?.color || null,
                rootStyle?.color || null,
                bgRgb ? chooseForeground(bgRgb) : null
              ]),
              source: 'theme-color'
            };
          }

          return null;
        };

        const parseSelectorRule = (value) => {
          const raw = String(value || '').trim();
          if (!raw) return null;

          try {
            const rule = JSON.parse(raw);
            if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return null;

            const url = String(rule.url || '').trim();
            const bg = String(rule.bg || '').trim();
            const fg = String(rule.fg || '').trim();
            return url && bg ? { url, bg, fg } : null;
          } catch {
            return null;
          }
        };

        const wildcardMatches = (pattern, value) => {
          const escaped = pattern.replace(/[|\\{}()[\\]^$+*?.]/g, '\\$&').replace(/\\\*/g, '.*');
          return new RegExp('^' + escaped + '$').test(value);
        };

        const selectorRuleMatchesUrl = (pattern, href) => {
          const ruleUrl = String(pattern || '').trim();
          if (!ruleUrl || !href) return false;
          if (ruleUrl.includes('*')) return wildcardMatches(ruleUrl, href);

          try {
            if (ruleUrl.includes('://')) return href.startsWith(ruleUrl);
            return new URL(href).hostname === ruleUrl;
          } catch {
            return href.startsWith(ruleUrl);
          }
        };

        const getSelectorRuleElement = (view, doc, selector) => {
          const raw = String(selector || '').trim();
          if (!raw) return null;

          try {
            return getFirstRenderedElement(view, doc, raw);
          } catch {
            return null;
          }
        };

        const getSelectorRuleTheme = (doc, view, href, value) => {
          if (!doc || !view) return null;

          const rule = parseSelectorRule(value);
          if (!rule || !selectorRuleMatchesUrl(rule.url, href || doc.location?.href || '')) return null;

          const bgElement = getSelectorRuleElement(view, doc, rule.bg);
          const bgTheme = getThemeFromElement(view, bgElement, 'selector-rule', false);
          if (!bgTheme?.bg) return null;

          const foregroundCandidates = [];
          const fgElement = getSelectorRuleElement(view, doc, rule.fg);
          if (fgElement) {
            foregroundCandidates.push(...collectForegroundCandidates(view, fgElement, false));
          }
          foregroundCandidates.push(...collectForegroundCandidates(view, bgElement, false));
          foregroundCandidates.push(bgTheme.fg);

          return {
            bg: bgTheme.bg,
            fg: getReadableForeground(bgTheme.bg, foregroundCandidates),
            source: 'selector-rule',
            selectorRule: rule
          };
        };

        const getTopVisibleTheme = (doc, view) => {
          if (!doc || !view) return null;

          const element = getTopVisibleElement(view, doc);
          if (!element || element === doc.body || element === doc.documentElement) return null;

          return getThemeFromElement(view, element, 'top-visible', false);
        };

        const getDocumentCanvasTheme = (doc, view) => {
          const root = doc?.documentElement;
          if (!doc || !view || !root) return null;

          const rootStyle = view.getComputedStyle(root);
          const bodyStyle = doc.body ? view.getComputedStyle(doc.body) : null;
          let canvasFg = '';
          let probe = null;

          try {
            probe = doc.createElement('div');
            probe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;pointer-events:none;background-color:Canvas;color:CanvasText;';
            root.appendChild(probe);
            const probeStyle = view.getComputedStyle(probe);
            canvasFg = probeStyle.color;
          } catch {
          } finally {
            try { probe?.remove?.(); } catch {}
          }

          const bg = [
            bodyStyle ? getStyleBackground(bodyStyle) : null,
            getStyleBackground(rootStyle)
          ].find(hasVisibleColor);

          if (!bg) return null;

          return {
            bg,
            fg: getReadableForeground(bg, [
              bodyStyle?.color || null,
              rootStyle?.color || null,
              canvasFg || null
            ]),
            source: 'document-canvas'
          };
        };

        const withMeta = (theme, href, candidates) => theme && ({
          ...theme,
          bridge: 'message-manager',
          href,
          candidates
        });

        try {
          if (content.top !== content) return;

          const doc = content.document;
          const view = doc?.defaultView;
          const root = doc?.documentElement;
          if (!doc || !view || !root) {
            send({ ok: false, error: 'content-document-unavailable' });
            return;
          }

          const candidates = {
            body: describeElementTheme(view, doc.body),
            html: describeElementTheme(view, root)
          };

          const href = content.location.href;
          const theme = withMeta(getSelectorRuleTheme(doc, view, href, selectorRuleValue), href, candidates)
            || withMeta(getDarkReaderTheme(doc, view), href, candidates)
            || withMeta(getTopVisibleTheme(doc, view), href, candidates)
            || withMeta(getThemeColorTheme(doc, view), href, candidates)
            || withMeta(getThemeFromElement(view, doc.body, 'body'), href, candidates)
            || withMeta(getThemeFromElement(view, root, 'html'), href, candidates)
            || withMeta(getDocumentCanvasTheme(doc, view), href, candidates);

          send({ ok: true, theme, candidates, href });
        } catch (error) {
          send({
            ok: false,
            error: error?.message || String(error)
          });
        }
      })();
    `;
  }

  async function getBrowserPageThemeFromMessageManager(browser) {
    const messageManager = getBrowserMessageManager(browser);
    if (!browser || !messageManager?.loadFrameScript || !messageManager?.addMessageListener) {
      if (DEBUG_THEME) {
        console.info('[blended-addressbar:urlbar] Message manager bridge unavailable', {
          hasBrowser: !!browser,
          hasMessageManager: !!messageManager,
          href: browser?.currentURI?.spec || ''
        });
      }
      return null;
    }

    const requestId = `theme-${Date.now()}-${++themeRequestSeq}`;

    return await new Promise((resolve) => {
      let settled = false;
      let listener = null;
      let timeoutId = 0;

      const cleanup = () => {
        try {
          messageManager.removeMessageListener(themeMessageName, listener);
        } catch {}
      };

      const finish = (theme, debugPayload = null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        cleanup();
        if (DEBUG_THEME && debugPayload) {
          console.info('[blended-addressbar:urlbar] Message manager bridge result', debugPayload);
        }
        resolve(theme);
      };

      listener = {
        receiveMessage(message) {
          const data = message?.data;
          if (!data || data.requestId !== requestId) return;
          finish(data.theme || null, data);
        }
      };

      timeoutId = setTimeout(() => {
        finish(null, {
          requestId,
          ok: false,
          error: 'message-manager-timeout',
          href: browser?.currentURI?.spec || ''
        });
      }, themeBridgeTimeoutMs);

      try {
        messageManager.addMessageListener(themeMessageName, listener);
        const scriptUrl = `data:application/javascript;charset=utf-8,${encodeURIComponent(getThemeFrameScript(requestId))}`;
        messageManager.loadFrameScript(scriptUrl, false);
      } catch (error) {
        finish(null, {
          requestId,
          ok: false,
          error: error?.message || String(error),
          href: browser?.currentURI?.spec || ''
        });
      }
    });
  }

  async function getBrowserPageThemeFromContent(browser) {
    if (!browser || typeof ContentTask === 'undefined' || !ContentTask?.spawn) {
      return null;
    }

    const selectorRuleValue = readStringPref(selectorRulePref, '');

    try {
      return await ContentTask.spawn(browser, selectorRuleValue, (selectorRuleValue) => {
        const describeElementTheme = (view, element) => {
          if (!view || !element) {
            return { found: false, bg: null, fg: null };
          }

          const style = view.getComputedStyle(element);
          return {
            found: true,
            bg: getStyleBackground(style),
            fg: style.color || null
          };
        };

        const getViewportSize = (view, doc = null) => {
          const root = doc?.documentElement || view?.document?.documentElement || null;
          return {
            width: view?.innerWidth || root?.clientWidth || 0,
            height: view?.innerHeight || root?.clientHeight || 0
          };
        };

        const rectIntersectsViewport = (view, rect) => {
          if (!rect || rect.width <= 0 || rect.height <= 0) return false;

          const { width, height } = getViewportSize(view);
          if (!width || !height) return true;

          return rect.right > 0
            && rect.bottom > 0
            && rect.left < width
            && rect.top < height;
        };

        const isRenderedElement = (view, element) => {
          if (!view || !element) return false;
          const style = view.getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
            return false;
          }

          const rects = element.getClientRects();
          for (const rect of rects) {
            if (rectIntersectsViewport(view, rect)) return true;
          }

          return false;
        };

        const getFirstRenderedElement = (view, doc, selector) => {
          const elements = doc?.querySelectorAll?.(selector) || [];
          for (const element of elements) {
            if (isRenderedElement(view, element)) return element;
          }

          return doc?.querySelector?.(selector) || null;
        };

        const getTopVisibleElement = (view, doc) => {
          if (!view || !doc) return null;

          const { width, height } = getViewportSize(view, doc);
          const xMid = Math.max(1, Math.floor((width || 2) / 2));
          const xEnd = Math.max(1, (width || 2) - 2);
          const yTop = Math.min(3, Math.max(0, (height || 4) - 1));
          const yBand = Math.min(30, Math.max(0, (height || 31) - 1));
          const points = [
            [1, yTop],
            [xMid, yTop],
            [xEnd, yTop],
            [1, yBand],
            [xMid, yBand]
          ];

          let firstRendered = null;
          for (const [x, y] of points) {
            const elements = typeof doc.elementsFromPoint === 'function'
              ? doc.elementsFromPoint(x, y)
              : (typeof doc.elementFromPoint === 'function' ? [doc.elementFromPoint(x, y)] : []);

            for (const element of elements) {
              if (!isRenderedElement(view, element)) continue;
              firstRendered ||= element;

              const background = getStyleBackground(view.getComputedStyle(element));
              if (hasVisibleColor(background)) return element;
            }
          }

          return firstRendered || (typeof doc.elementFromPoint === 'function' ? doc.elementFromPoint(1, 3) : null);
        };

        const getCssColorAlpha = (value) => {
          const match = String(value || '').trim().match(/^[a-z-]+\(([^)]+)\)$/i);
          if (!match) return null;

          const body = match[1].trim();
          let alpha = null;
          if (body.includes('/')) {
            alpha = body.slice(body.lastIndexOf('/') + 1).trim();
          } else {
            const parts = body.split(',');
            if (parts.length === 4) alpha = parts[3].trim();
          }

          if (alpha === null) return null;

          const amount = parseFloat(alpha);
          if (!Number.isFinite(amount)) return null;
          return alpha.endsWith('%') ? amount / 100 : amount;
        };

        function hasVisibleColor(input) {
          if (!input) return false;
          const value = String(input).trim().toLowerCase();
          if (!value || value === 'transparent') return false;
          const alpha = getCssColorAlpha(value);
          if (alpha !== null && alpha < 0.08) return false;
          return true;
        }

        const extractCssColor = (input) => {
          const value = String(input || '').trim();
          if (!value || value === 'none') return null;

          const candidates = value.match(/[a-z-]+\([^)]*\)|#[0-9a-f]{3,8}\b/gi) || [];
          return candidates.find((color) => hasVisibleColor(color)
            && typeof CSS !== 'undefined'
            && CSS.supports?.('color', color)) || null;
        };

        function getStyleBackground(style) {
          if (!style) return null;
          if (hasVisibleColor(style.backgroundColor)) return style.backgroundColor;
          return extractCssColor(style.backgroundImage);
        }

        const getDescendantBackground = (view, element) => {
          if (!view || !element?.querySelectorAll) return null;

          const doc = element.ownerDocument || null;
          if (element === doc?.body || element === doc?.documentElement) return null;

          const elementRect = element.getBoundingClientRect();
          const { width: viewportWidth, height: viewportHeight } = getViewportSize(view, doc);
          const maxWidth = Math.max(1, Math.min(elementRect.width || viewportWidth || 1, viewportWidth || elementRect.width || 1));
          let best = null;
          let inspected = 0;

          const descendants = element.querySelectorAll('*');
          for (const descendant of descendants) {
            if (inspected >= 64) break;
            if (!isRenderedElement(view, descendant)) continue;
            inspected++;

            const style = view.getComputedStyle(descendant);
            const background = getStyleBackground(style);
            if (!hasVisibleColor(background)) continue;

            const rect = descendant.getBoundingClientRect();
            const visibleWidth = Math.max(0, Math.min(rect.right, viewportWidth || rect.right) - Math.max(rect.left, 0));
            const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight || rect.bottom) - Math.max(rect.top, 0));
            if (visibleWidth < 16 || visibleHeight < 8) continue;

            const widthCoverage = visibleWidth / maxWidth;
            if (widthCoverage < 0.35) continue;

            const topDistance = Math.max(0, rect.top - Math.max(0, elementRect.top));
            const score = (widthCoverage * 1000) + Math.min(visibleHeight, 96) - topDistance;

            if (!best || score > best.score) {
              best = { value: background, score };
            }
          }

          return best?.value || null;
        };

        const getRelativeLuminance = ({ r, g, b }) => {
          const toLinear = (channel) => {
            const value = channel / 255;
            return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
        };

        const getContrastRatio = (colorA, colorB) => {
          const lumA = getRelativeLuminance(colorA);
          const lumB = getRelativeLuminance(colorB);
          const lighter = Math.max(lumA, lumB);
          const darker = Math.min(lumA, lumB);
          return (lighter + 0.05) / (darker + 0.05);
        };

        const chooseForeground = ({ r, g, b }) => {
          const luminance = getRelativeLuminance({ r, g, b });
          return luminance > 0.6 ? 'rgba(11, 13, 16, 0.92)' : 'rgba(245, 247, 251, 0.96)';
        };

        const parseCssRgb = (input) => {
          if (!input) return null;
          const raw = String(input).trim();
          const perceptual = raw.match(/^ok(?:lab|lch)\(\s*(\d+(?:\.\d+)?%?)/i);
          if (perceptual) {
            const channel = perceptual[1];
            const lightness = channel.endsWith('%')
              ? parseFloat(channel) / 100
              : parseFloat(channel);
            if (Number.isFinite(lightness)) {
              const value = Math.max(0, Math.min(255, Math.round(lightness * 255)));
              return { r: value, g: value, b: value };
            }
          }

          const hex = raw.match(/^#([0-9a-f]{3,8})$/i);
          if (hex) {
            const value = hex[1];
            const expand = (part) => part.length === 1 ? part + part : part;
            const r = parseInt(expand(value.length <= 4 ? value[0] : value.slice(0, 2)), 16);
            const g = parseInt(expand(value.length <= 4 ? value[1] : value.slice(2, 4)), 16);
            const b = parseInt(expand(value.length <= 4 ? value[2] : value.slice(4, 6)), 16);
            return { r, g, b };
          }

          const match = raw.match(/^rgba?\(([^)]+)\)$/i);
          if (!match) return null;
          const parts = match[1].replace(/\s*\/\s*[\d.]+%?$/, '').split(/[,\s]+/).filter(Boolean);
          if (parts.length < 3) return null;
          const readChannel = (part) => {
            const value = parseFloat(part);
            const scaled = String(part).trim().endsWith('%') ? value * 2.55 : value;
            return Math.max(0, Math.min(255, Math.round(scaled)));
          };
          return { r: readChannel(parts[0]), g: readChannel(parts[1]), b: readChannel(parts[2]) };
        };

        const addColorCandidate = (candidates, value, priority = 'text') => {
          if (hasVisibleColor(value)) candidates.push({ value, priority });
        };

        const isLinkLikeElement = (element) => {
          const role = element?.getAttribute?.('role');
          return element?.localName === 'a'
            || element?.localName === 'button'
            || role === 'link'
            || role === 'button'
            || !!element?.closest?.('a,button,[role="link"],[role="button"]');
        };

        const collectForegroundCandidates = (view, element, allowPageFallback = true) => {
          const ancestorCandidates = [];
          if (!view || !element) return ancestorCandidates;

          const doc = element.ownerDocument || null;
          let current = element;
          while (current) {
            if (!allowPageFallback && (current === doc?.body || current === doc?.documentElement)) break;

            const style = view.getComputedStyle(current);
            addColorCandidate(ancestorCandidates, style.color, 'text');
            addColorCandidate(ancestorCandidates, style.fill, 'text');
            addColorCandidate(ancestorCandidates, style.stroke, 'text');
            current = current.parentElement;
          }

          return ancestorCandidates;
        };

        const getReadableForeground = (bg, candidates = []) => {
          const bgRgb = parseCssRgb(bg);
          if (!bgRgb) {
            const fallback = candidates.find((candidate) => hasVisibleColor(
              typeof candidate === 'string' ? candidate : candidate?.value
            ));
            return typeof fallback === 'string' ? fallback : (fallback?.value || null);
          }

          const minimumReadableContrast = 3;
          const preferredReadableContrast = 4.5;
          const seen = new Set();
          let best = null;

          for (const candidate of candidates) {
            const value = typeof candidate === 'string' ? candidate : candidate?.value;
            const priority = typeof candidate === 'string' ? 'text' : candidate?.priority;
            if (!hasVisibleColor(value)) continue;
            const key = String(value).trim().toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);

            const rgb = parseCssRgb(value);
            if (!rgb) continue;

            const ratio = getContrastRatio(bgRgb, rgb);
            if (priority === 'link' && ratio >= minimumReadableContrast) return value;
            if (ratio >= preferredReadableContrast) return value;
            if (ratio >= minimumReadableContrast && (!best || ratio > best.ratio)) {
              best = { value, ratio };
            }
          }

          if (best) return best.value;

          const fallbacks = ['rgba(11, 13, 16, 0.92)', 'rgba(245, 247, 251, 0.96)'];
          return fallbacks
            .map((value) => ({ value, ratio: getContrastRatio(bgRgb, parseCssRgb(value)) }))
            .sort((a, b) => b.ratio - a.ratio)[0].value;
        };

        const getThemeFromElement = (view, element, source = 'element', allowPageFallback = true) => {
          if (!view || !element) return null;
          let fg = null;
          let bg = null;
          let current = element;
          const doc = element.ownerDocument || null;
          const elementBackground = getStyleBackground(view.getComputedStyle(element));
          while (current) {
            if (!allowPageFallback && (current === doc?.body || current === doc?.documentElement)) break;

            const style = view.getComputedStyle(current);
            if (!fg && hasVisibleColor(style.color)) fg = style.color;
            const background = getStyleBackground(style);
            if (!bg && hasVisibleColor(background)) bg = background;
            if (bg && fg) break;
            current = current.parentElement;
          }
          const descendantBackground = getDescendantBackground(view, element);
          if (descendantBackground && !hasVisibleColor(elementBackground)) {
            bg = descendantBackground;
          } else if (!bg) {
            bg = descendantBackground;
          }
          if (!bg) return null;
          const fgCandidates = [
            ...collectForegroundCandidates(view, element, allowPageFallback),
            { value: fg, priority: 'text' }
          ];
          return {
            bg,
            fg: getReadableForeground(bg, fgCandidates),
            source
          };
        };

        const getDarkReaderTheme = (doc, view) => {
          const root = doc?.documentElement;
          if (!root || !view) return null;

          const rootStyle = view.getComputedStyle(root);
          const bodyStyle = doc.body ? view.getComputedStyle(doc.body) : null;
          const bg = rootStyle.getPropertyValue('--darkreader-neutral-background').trim()
            || (bodyStyle?.getPropertyValue('--darkreader-neutral-background').trim() || '');
          const fg = rootStyle.getPropertyValue('--darkreader-neutral-text').trim()
            || (bodyStyle?.getPropertyValue('--darkreader-neutral-text').trim() || '');

          if (!hasVisibleColor(bg)) return null;

          const bgRgb = parseCssRgb(bg);
          return {
            bg,
            fg: getReadableForeground(bg, [fg, bgRgb ? chooseForeground(bgRgb) : null]),
            source: 'dark-reader'
          };
        };

        const getThemeColorTheme = (doc, view) => {
          if (!doc || !view) return null;

          const metas = doc.querySelectorAll?.('meta[name="theme-color" i]') || [];
          for (const meta of metas) {
            const media = meta.getAttribute?.('media') || '';
            if (media) {
              try {
                if (!view.matchMedia(media).matches) continue;
              } catch {}
            }

            const bg = meta.getAttribute?.('content') || '';
            if (!hasVisibleColor(bg)
              || typeof CSS === 'undefined'
              || !CSS.supports?.('color', bg)) {
              continue;
            }

            const rootStyle = doc.documentElement ? view.getComputedStyle(doc.documentElement) : null;
            const bodyStyle = doc.body ? view.getComputedStyle(doc.body) : null;
            const bgRgb = parseCssRgb(bg);
            return {
              bg,
              fg: getReadableForeground(bg, [
                bodyStyle?.color || null,
                rootStyle?.color || null,
                bgRgb ? chooseForeground(bgRgb) : null
              ]),
              source: 'theme-color'
            };
          }

          return null;
        };

        const parseSelectorRule = (value) => {
          const raw = String(value || '').trim();
          if (!raw) return null;

          try {
            const rule = JSON.parse(raw);
            if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return null;

            const url = String(rule.url || '').trim();
            const bg = String(rule.bg || '').trim();
            const fg = String(rule.fg || '').trim();
            return url && bg ? { url, bg, fg } : null;
          } catch {
            return null;
          }
        };

        const wildcardMatches = (pattern, value) => {
          const escaped = pattern.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/\\\*/g, '.*');
          return new RegExp('^' + escaped + '$').test(value);
        };

        const selectorRuleMatchesUrl = (pattern, href) => {
          const ruleUrl = String(pattern || '').trim();
          if (!ruleUrl || !href) return false;
          if (ruleUrl.includes('*')) return wildcardMatches(ruleUrl, href);

          try {
            if (ruleUrl.includes('://')) return href.startsWith(ruleUrl);
            return new URL(href).hostname === ruleUrl;
          } catch {
            return href.startsWith(ruleUrl);
          }
        };

        const getSelectorRuleElement = (view, doc, selector) => {
          const raw = String(selector || '').trim();
          if (!raw) return null;

          try {
            return getFirstRenderedElement(view, doc, raw);
          } catch {
            return null;
          }
        };

        const getSelectorRuleTheme = (doc, view, href, value) => {
          if (!doc || !view) return null;

          const rule = parseSelectorRule(value);
          if (!rule || !selectorRuleMatchesUrl(rule.url, href || doc.location?.href || '')) return null;

          const bgElement = getSelectorRuleElement(view, doc, rule.bg);
          const bgTheme = getThemeFromElement(view, bgElement, 'selector-rule', false);
          if (!bgTheme?.bg) return null;

          const foregroundCandidates = [];
          const fgElement = getSelectorRuleElement(view, doc, rule.fg);
          if (fgElement) {
            foregroundCandidates.push(...collectForegroundCandidates(view, fgElement, false));
          }
          foregroundCandidates.push(...collectForegroundCandidates(view, bgElement, false));
          foregroundCandidates.push(bgTheme.fg);

          return {
            bg: bgTheme.bg,
            fg: getReadableForeground(bgTheme.bg, foregroundCandidates),
            source: 'selector-rule',
            selectorRule: rule
          };
        };

        const getTopVisibleTheme = (doc, view) => {
          if (!doc || !view) return null;

          const element = getTopVisibleElement(view, doc);
          if (!element || element === doc.body || element === doc.documentElement) return null;

          return getThemeFromElement(view, element, 'top-visible', false);
        };

        const getDocumentCanvasTheme = (doc, view) => {
          const root = doc?.documentElement;
          if (!doc || !view || !root) return null;

          const rootStyle = view.getComputedStyle(root);
          const bodyStyle = doc.body ? view.getComputedStyle(doc.body) : null;
          let canvasFg = '';
          let probe = null;

          try {
            probe = doc.createElement('div');
            probe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;pointer-events:none;background-color:Canvas;color:CanvasText;';
            root.appendChild(probe);
            const probeStyle = view.getComputedStyle(probe);
            canvasFg = probeStyle.color;
          } catch {
          } finally {
            try { probe?.remove?.(); } catch {}
          }

          const bg = [
            bodyStyle ? getStyleBackground(bodyStyle) : null,
            getStyleBackground(rootStyle)
          ].find(hasVisibleColor);

          if (!bg) return null;

          return {
            bg,
            fg: getReadableForeground(bg, [
              bodyStyle?.color || null,
              rootStyle?.color || null,
              canvasFg || null
            ]),
            source: 'document-canvas'
          };
        };

        const withMeta = (theme, href, candidates) => theme && ({
          ...theme,
          bridge: 'content',
          href,
          candidates
        });

        try {
          const doc = content.document;
          const view = doc?.defaultView;
          const root = doc?.documentElement;
          if (!doc || !view || !root) return null;

          const candidates = {
            body: describeElementTheme(view, doc.body),
            html: describeElementTheme(view, root)
          };

          const href = content.location.href;
          return withMeta(getSelectorRuleTheme(doc, view, href, selectorRuleValue), href, candidates)
            || withMeta(getDarkReaderTheme(doc, view), href, candidates)
            || withMeta(getTopVisibleTheme(doc, view), href, candidates)
            || withMeta(getThemeColorTheme(doc, view), href, candidates)
            || withMeta(getThemeFromElement(view, doc.body, 'body'), href, candidates)
            || withMeta(getThemeFromElement(view, root, 'html'), href, candidates)
            || withMeta(getDocumentCanvasTheme(doc, view), href, candidates);
        } catch {
          return null;
        }
      });
    } catch (error) {
      if (DEBUG_VERBOSE) console.warn('[blended-addressbar:urlbar] ContentTask theme lookup failed', error);
      return null;
    }
  }

  async function firstResolvedTheme(promises) {
    if (!promises.length) return null;

    return await new Promise((resolve) => {
      let pending = promises.length;

      const finishEmpty = () => {
        pending--;
        if (pending === 0) resolve(null);
      };

      for (const promise of promises) {
        Promise.resolve(promise).then((theme) => {
          if (theme?.bg) {
            resolve(theme);
          } else {
            finishEmpty();
          }
        }).catch(() => {
          finishEmpty();
        });
      }
    });
  }

  async function getBrowserPageTheme(browser) {
    const chromeTheme = getBrowserPageThemeFromChrome(browser);
    if (chromeTheme?.bg) return chromeTheme;

    return firstResolvedTheme([
      getBrowserPageThemeFromContent(browser),
      getBrowserPageThemeFromMessageManager(browser)
    ]);
  }

  function getToolbarFallbackTheme(browser) {
    return {
      ...getChromeContrastFallbackTheme(browser, 'chrome-contrast-fallback'),
      bridge: 'toolbar-fallback',
      source: 'toolbar-fallback'
    };
  }

  function rgbaToCss(color) {
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a.toFixed(3)})`;
  }

  function rgbToCss({ r, g, b }) {
    return `rgb(${r}, ${g}, ${b})`;
  }

  function mixRgb(color, target, amount) {
    const mix = (channel, targetChannel) => Math.round(channel + ((targetChannel - channel) * amount));
    return {
      r: Math.max(0, Math.min(255, mix(color.r, target.r))),
      g: Math.max(0, Math.min(255, mix(color.g, target.g))),
      b: Math.max(0, Math.min(255, mix(color.b, target.b)))
    };
  }

  function getChromeFallbackOverlay(baseColor, colorScheme = '') {
    const normalizedScheme = String(colorScheme || '').trim().toLowerCase();
    const shouldLighten = normalizedScheme === 'light'
      || (normalizedScheme !== 'dark' && getRelativeLuminance(baseColor) > 0.5);
    const target = shouldLighten
      ? { r: 255, g: 255, b: 255 }
      : { r: 0, g: 0, b: 0 };
    const amount = 0.3;

    return {
      bg: rgbaToCss({ ...target, a: amount }),
      composite: mixRgb(baseColor, target, amount)
    };
  }

  function getSampledTheme(result, browser = gBrowser?.selectedBrowser || null) {
    if (!result?.rgba || result.rgba.a < sampledColorMinAlpha) return null;

    const css = rgbaToCss(result.rgba);
    if (!hasVisibleColor(css)) return null;

    return {
      bg: css,
      fg: chooseForeground(result.rgba),
      bridge: 'sampler',
      source: 'sampler',
      href: browser?.currentURI?.spec || ''
    };
  }

  function getAverageSampleLineColor(data) {
    if (!data?.length) return null;

    let alphaTotal = 0;
    let redTotal = 0;
    let greenTotal = 0;
    let blueTotal = 0;

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3] / 255;
      if (alpha <= 0) continue;

      alphaTotal += alpha;
      redTotal += data[i] * alpha;
      greenTotal += data[i + 1] * alpha;
      blueTotal += data[i + 2] * alpha;
    }

    if (alphaTotal <= 0) return null;

    const pixels = data.length / 4;
    return {
      r: Math.round(redTotal / alphaTotal),
      g: Math.round(greenTotal / alphaTotal),
      b: Math.round(blueTotal / alphaTotal),
      a: Math.max(0, Math.min(1, alphaTotal / pixels))
    };
  }

  function getChromeContrastFallbackTheme(browser, reason = 'chrome-contrast-fallback') {
    const probe = chromeDoc.createElement('div');
    probe.style.position = 'fixed';
    probe.style.pointerEvents = 'none';
    probe.style.opacity = '0';
    probe.style.backgroundColor = 'var(--zen-main-browser-background-toolbar)';
    probe.style.color = 'var(--toolbox-textcolor)';
    chromeDoc.documentElement.appendChild(probe);
    const toolbarBg = getComputedStyle(probe).backgroundColor;
    const toolbarFg = getComputedStyle(probe).color;
    probe.remove();

    const rootStyle = getComputedStyle(chromeDoc.documentElement);
    const rootBg = rootStyle.backgroundColor;
    const colorScheme = rootStyle.getPropertyValue('--toolbar-color-scheme') || rootStyle.colorScheme;
    const baseBg = [toolbarBg, rootBg, 'Canvas'].find(hasVisibleColor) || 'Canvas';
    const baseRgb = parseCssRgb(baseBg) || { r: 255, g: 255, b: 255 };
    const fallback = getChromeFallbackOverlay(baseRgb, colorScheme);
    const fg = getReadableForeground(rgbToCss(fallback.composite), [
      { value: toolbarFg, priority: 'text' },
      chooseForeground(fallback.composite)
    ]);

    return {
      bg: fallback.bg,
      fg,
      bridge: 'chrome',
      source: reason,
      href: browser?.currentURI?.spec || ''
    };
  }

  const sampleCanvas = chromeDoc.createElement('canvas');
  sampleCanvas.width = 1;
  sampleCanvas.height = 1;
  const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });

  let samplerOverlay = null;
  function ensureSamplerOverlay() {
    if (!DEBUG_SHOW_SAMPLER) return null;
    if (samplerOverlay && samplerOverlay.isConnected) return samplerOverlay;
    const el = chromeDoc.createElement('div');
    el.id = 'zen-urlbar-sampler-overlay';
    el.style.position = 'fixed';
    el.style.width = '2px';
    el.style.height = '2px';
    el.style.border = '1px solid red';
    el.style.boxSizing = 'border-box';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '2147483647';
    el.style.left = '3px';
    el.style.top = '3px';
    chromeDoc.documentElement.appendChild(el);
    samplerOverlay = el;
    return samplerOverlay;
  }

  function updateSamplerOverlay(x, y) {
    const el = ensureSamplerOverlay();
    if (!el) return;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  async function sampleTabPanelsPixel() {
    const panels = chromeDoc.getElementById('tabbrowser-tabpanels');
    if (!panels) {
      if (DEBUG) console.warn('[blended-addressbar:urlbar] tabbrowser-tabpanels not found');
      return null;
    }

    const browser = gBrowser?.selectedBrowser || null;
    const rect = (browser || panels).getBoundingClientRect();
    if (!rect || rect.width < 1 || rect.height < 1) {
      if (DEBUG_VERBOSE) console.warn('[blended-addressbar:urlbar] tabbrowser-tabpanels has no size');
      return null;
    }

    const sampleWidth = Math.max(1, Math.floor(rect.width));
    const sampleHeight = 1;
    const contentX = 0;
    const contentY = 0;
    const x = Math.max(0, Math.floor(rect.left + contentX));
    const y = Math.max(0, Math.floor(rect.top + contentY));
    updateSamplerOverlay(x, y);

    if (!sampleCtx) {
      if (DEBUG) console.warn('[blended-addressbar:urlbar] No canvas context for sampling');
      return null;
    }

    const windowUtils = window.windowUtils;
    try {
      if (sampleCanvas.width !== sampleWidth) sampleCanvas.width = sampleWidth;
      if (sampleCanvas.height !== sampleHeight) sampleCanvas.height = sampleHeight;

      const wg = browser?.browsingContext?.currentWindowGlobal;
      if (wg && typeof wg.drawSnapshot === 'function') {
        const bc = browser?.browsingContext || null;
        const scrollX = typeof bc?.top?.scrollX === 'number'
          ? bc.top.scrollX
          : (typeof bc?.scrollX === 'number' ? bc.scrollX : 0);
        const scrollY = typeof bc?.top?.scrollY === 'number'
          ? bc.top.scrollY
          : (typeof bc?.scrollY === 'number' ? bc.scrollY : 0);
        const rect = new DOMRect(contentX + scrollX, contentY + scrollY, sampleWidth, sampleHeight);
        const bitmap = await wg.drawSnapshot(rect, 1, 'transparent');
        sampleCtx.clearRect(0, 0, sampleWidth, sampleHeight);
        sampleCtx.drawImage(bitmap, 0, 0);
        if (bitmap && typeof bitmap.close === 'function') bitmap.close();
      } else if (windowUtils && typeof windowUtils.drawSnapshot === 'function') {
        const bitmap = await windowUtils.drawSnapshot({ x, y, width: sampleWidth, height: sampleHeight }, 1, 'transparent');
        sampleCtx.clearRect(0, 0, sampleWidth, sampleHeight);
        sampleCtx.drawImage(bitmap, 0, 0);
        if (bitmap && typeof bitmap.close === 'function') bitmap.close();
      } else if (typeof sampleCtx.drawWindow === 'function') {
        sampleCtx.clearRect(0, 0, sampleWidth, sampleHeight);
        sampleCtx.drawWindow(window, x, y, sampleWidth, sampleHeight, 'transparent');
      } else {
        if (DEBUG) console.warn('[blended-addressbar:urlbar] No snapshot API available');
        return null;
      }
    } catch (e) {
      if (DEBUG) console.error('[blended-addressbar:urlbar] Snapshot failed', e);
      return null;
    }

    const data = sampleCtx.getImageData(0, 0, sampleWidth, sampleHeight).data;
    const rgba = getAverageSampleLineColor(data);
    if (!rgba) return null;

    return {
      rgba,
      meta: {
        x,
        y,
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        method: browser?.browsingContext?.currentWindowGlobal?.drawSnapshot ? 'content-snapshot' : 'chrome-snapshot',
        sample: { width: sampleWidth, height: sampleHeight },
        scroll: {
          x: browser?.browsingContext?.top?.scrollX,
          y: browser?.browsingContext?.top?.scrollY
        }
      }
    };
  }

  function stopSampling() {
    samplingActive = false;
    if (samplingTimer) clearTimeout(samplingTimer);
    samplingTimer = 0;
    samplingInFlight = false;
    if (DEBUG) console.info('[blended-addressbar:urlbar] Stop sampling');
  }

  function scheduleNext() {
    if (!samplingActive) return;
    samplingTimer = setTimeout(sampleTick, currentIntervalMs);
  }

  async function sampleTick() {
    if (!samplingActive || samplingInFlight) {
      scheduleNext();
      return;
    }

    const browser = gBrowser?.selectedBrowser || null;
    const expectedHref = getBrowserHref(browser);

    samplingInFlight = true;
    const pageTheme = await getBrowserPageTheme(browser);
    if ((pageTheme?.source === 'dark-reader' || pageTheme?.source === 'header' || pageTheme?.source === 'nav') && pageTheme.bg) {
      samplingInFlight = false;
      applyResolvedTheme(browser, pageTheme, 'semantic-priority', expectedHref);
      scheduleNext();
      return;
    }

    if (pageTheme?.bg) {
      samplingInFlight = false;
      applyResolvedTheme(browser, pageTheme, 'sampler-fallback', expectedHref);
      scheduleNext();
      return;
    }

    const result = await sampleTabPanelsPixel();
    samplingInFlight = false;

    const sampledTheme = getSampledTheme(result, browser);
    if (sampledTheme?.bg) {
      applyResolvedTheme(browser, sampledTheme, 'sampler', expectedHref);
      if (DEBUG) {
        const now = Date.now();
        if (now - lastLogAt > 1000) {
          lastLogAt = now;
          console.info('[blended-addressbar:urlbar] Apply sampled theme', {
            ...result.meta,
            bg: sampledTheme.bg,
            fg: sampledTheme.fg
          });
        }
      }
    }

    scheduleNext();
  }

  async function startSampling(browser = gBrowser?.selectedBrowser || null, options = {}) {
    const {
      enableSampler = false,
      fastOnly = false,
      reason = 'fallback',
      samplingInterval = samplingIntervalMs,
      skipToolbarFallback = false
    } = options;
    stopSampling();

    if (!browser) return;

    const expectedHref = getBrowserHref(browser);
    const cachedTheme = getCachedTheme(browser);
    if (cachedTheme) {
      applyResolvedTheme(browser, cachedTheme, 'cache', expectedHref);
    }

    const fastTheme = getBrowserPageThemeFromChrome(browser);
    if (fastTheme?.bg) {
      applyResolvedTheme(browser, fastTheme, reason === 'fallback' ? 'fast' : reason, expectedHref);
    } else if (fastOnly) {
      return;
    } else if (!cachedTheme && !skipToolbarFallback) {
      applyResolvedTheme(browser, getToolbarFallbackTheme(browser), 'toolbar-fallback', expectedHref);
    }

    if (!fastOnly) {
      const pageTheme = await getBrowserPageTheme(browser);
      if (pageTheme?.bg) {
        applyResolvedTheme(browser, pageTheme, reason, expectedHref);
      } else if (!skipToolbarFallback) {
        applyResolvedTheme(browser, getToolbarFallbackTheme(browser), reason, expectedHref);
      }
    }

    if (!samplingEnabled && !enableSampler) {
      if (DEBUG) console.info('[blended-addressbar:urlbar] Sampling disabled');
      return;
    }
    samplingActive = true;
    currentIntervalMs = samplingInterval;
    if (DEBUG) console.info('[blended-addressbar:urlbar] Start sampling');
    sampleTick();
  }

  function enterPostLoadSampling() {
    if (!postLoadSamplingEnabled) {
      stopSampling();
      return;
    }
    currentIntervalMs = postLoadSamplingIntervalMs;
    if (DEBUG) console.info('[blended-addressbar:urlbar] Post-load sampling');
  }

  async function updateActive(options = {}) {
    const browser = gBrowser?.selectedBrowser;
    if (!browser) return;

    if (activeThemeUpdateInFlight) {
      pendingActiveThemeUpdateOptions = options;
      return;
    }

    activeThemeUpdateInFlight = true;
    if (DEBUG) console.info('[blended-addressbar:urlbar] Update active tab');
    try {
      await startSampling(browser, options);
    } finally {
      activeThemeUpdateInFlight = false;
      if (pendingActiveThemeUpdateOptions) {
        const nextOptions = pendingActiveThemeUpdateOptions;
        pendingActiveThemeUpdateOptions = null;
        setTimeout(() => {
          void updateActive(nextOptions);
        }, 0);
      }
    }
  }

  function stopLoadingThemePolling() {
    if (loadingThemePollTimer) clearTimeout(loadingThemePollTimer);
    loadingThemePollTimer = 0;
    loadingThemePollStartedAt = 0;
    loadingThemePollBrowser = null;
    loadingThemePollHref = '';
    if (!samplingEnabled) stopSampling();
  }

  function scheduleLoadingThemePollTick() {
    if (!loadingThemePollBrowser || !loadingThemePollStartedAt) return;

    const browser = loadingThemePollBrowser;
    const elapsed = Date.now() - loadingThemePollStartedAt;
    const active = gBrowser?.selectedBrowser || null;
    if (browser !== active || getBrowserHref(browser) !== loadingThemePollHref || elapsed > loadingThemePollMaxMs) {
      stopLoadingThemePolling();
      return;
    }

    void updateActive({
      enableSampler: loadingSamplingEnabled,
      reason: elapsed < loadingThemePollAggressiveWindowMs ? 'loading-poll-fast' : 'loading-poll',
      samplingInterval: loadingSamplingIntervalMs,
      skipToolbarFallback: true
    }).finally(() => {
      if (!loadingThemePollBrowser || getBrowserHref(browser) !== loadingThemePollHref) return;

      const nextElapsed = Date.now() - loadingThemePollStartedAt;
      const interval = nextElapsed < loadingThemePollAggressiveWindowMs
        ? loadingThemePollFastIntervalMs
        : loadingThemePollSlowIntervalMs;
      loadingThemePollTimer = setTimeout(scheduleLoadingThemePollTick, interval);
    });
  }

  function startLoadingThemePolling(browser = gBrowser?.selectedBrowser || null) {
    if (!browser) return;

    const href = getBrowserHref(browser);
    const sameLoadingTarget = loadingThemePollBrowser === browser && loadingThemePollHref === href;
    stopLoadingThemePolling();
    if (!sameLoadingTarget) {
      resetThemeArbitration(href);
    }

    loadingThemePollBrowser = browser;
    loadingThemePollHref = href;
    loadingThemePollStartedAt = Date.now();
    loadingThemePollTimer = setTimeout(scheduleLoadingThemePollTick, 60);
  }

  function stopActiveThemeRefresh() {
    if (activeThemeRefreshTimer) clearTimeout(activeThemeRefreshTimer);
    activeThemeRefreshTimer = 0;
  }

  function runActiveThemeRefresh() {
    activeThemeRefreshTimer = 0;

    const browser = gBrowser?.selectedBrowser || null;
    if (!browser) {
      scheduleActiveThemeRefresh();
      return;
    }

    const expectedHref = getBrowserHref(browser);
    void updateActive({
      reason: 'active-refresh',
      skipToolbarFallback: true
    }).finally(() => {
      const selected = gBrowser?.selectedBrowser || null;
      if (!selected) return;
      if (selected === browser && getBrowserHref(selected) !== expectedHref) {
        void updateActive({ reason: 'active-refresh-navigation' });
      }
      scheduleActiveThemeRefresh();
    });
  }

  function scheduleActiveThemeRefresh() {
    stopActiveThemeRefresh();
    activeThemeRefreshTimer = setTimeout(runActiveThemeRefresh, activeThemeRefreshIntervalMs);
  }

  function clearScheduledThemeUpdates() {
    for (const timer of scheduledThemeTimers) {
      clearTimeout(timer);
    }
    scheduledThemeTimers = [];
  }

  function scheduleActiveUpdates(delays, options = {}, scheduleOptions = {}) {
    if (scheduleOptions.replace) {
      clearScheduledThemeUpdates();
    }

    for (const delay of delays) {
      const timer = setTimeout(() => {
        scheduledThemeTimers = scheduledThemeTimers.filter(item => item !== timer);
        void updateActive(options);
      }, delay);
      scheduledThemeTimers.push(timer);
    }
  }

  function scheduleViewportThemeUpdate() {
    if (viewportThemeUpdateTimer) clearTimeout(viewportThemeUpdateTimer);

    viewportThemeUpdateTimer = setTimeout(() => {
      viewportThemeUpdateTimer = 0;
      scheduleActiveUpdates(
        viewportThemeUpdateDelays,
        { reason: 'viewport-resize' },
        { replace: true }
      );
    }, 80);
  }

  function observeViewportThemeTarget() {
    try {
      if (typeof ResizeObserver === 'undefined') return;

      const target = gBrowser?.selectedBrowser || chromeDoc.getElementById('tabbrowser-tabpanels');
      if (!target) return;

      if (viewportResizeObserver) viewportResizeObserver.disconnect();
      viewportResizeObserver = new ResizeObserver(scheduleViewportThemeUpdate);
      viewportResizeObserver.observe(target);
    } catch {}
  }

  function initWhenReady() {
    if (typeof gBrowser === 'undefined' || !gBrowser) {
      setTimeout(initWhenReady, 500);
      return;
    }

    applyLoadbarPrefs();
    observeLoadbarPrefs();

    gBrowser.tabContainer.addEventListener('TabSelect', () => {
      observeViewportThemeTarget();
      scheduleActiveThemeRefresh();
      void updateActive({ reason: 'tab-select' });
    });

    try {
      window.addEventListener('resize', scheduleViewportThemeUpdate);
      if (typeof addUnloadListener === 'function') {
        addUnloadListener(() => {
          window.removeEventListener('resize', scheduleViewportThemeUpdate);
          if (viewportThemeUpdateTimer) clearTimeout(viewportThemeUpdateTimer);
          if (viewportResizeObserver) viewportResizeObserver.disconnect();
          stopLoadingThemePolling();
          stopActiveThemeRefresh();
          clearPendingThemeCandidate();
        });
      }
    } catch {}
    observeViewportThemeTarget();
    scheduleActiveThemeRefresh();

    const pl = {
      onLocationChange(browserArg, webProgress, req, location, flags) {
        try {
          const active = gBrowser.selectedBrowser;
          const isTop = webProgress && webProgress.isTopLevel;
          const matches = browserArg === active;
          if (isTop && matches) {
            scheduleActiveThemeRefresh();
            startLoadingThemePolling(browserArg);
            scheduleActiveUpdates(
              earlyThemeUpdateDelays,
              { fastOnly: true, reason: 'early-location' },
              { replace: true }
            );
          }
        } catch {}
      },
      onStateChange(browserArg, webProgress, req, flags) {
        try {
          const active = gBrowser.selectedBrowser;
          const isTop = webProgress && webProgress.isTopLevel;
          const matches = browserArg === active;
          if (!matches || !isTop) return;
          const listener = Ci && Ci.nsIWebProgressListener
            ? Ci.nsIWebProgressListener
            : null;
          const startFlag = listener ? listener.STATE_START : 0x00000001;
          const stopFlag = listener ? listener.STATE_STOP : 0x00000010;
          if (flags & startFlag) {
            scheduleActiveThemeRefresh();
            startLoadingThemePolling(browserArg);
            scheduleActiveUpdates(
              earlyThemeUpdateDelays,
              { fastOnly: true, reason: 'early-load' },
              { replace: true }
            );
          }
          if (flags & stopFlag) {
            if (samplingEnabled) {
              enterPostLoadSampling();
            }
            stopLoadingThemePolling();
            scheduleActiveUpdates(
              settledThemeUpdateDelays,
              { reason: 'settled-load' },
              { replace: true }
            );
          }
        } catch {}
      }
    };
    try { gBrowser.addTabsProgressListener(pl); } catch {}

    void updateActive({ reason: 'init' });
  }

  initWhenReady();
})();
