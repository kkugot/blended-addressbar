// ==UserScript==
// @name           Blended Addressbar
// @description    Adaptive header color for Zen URL bar
// @version        1.5.0
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
  const earlyThemeUpdateDelays = [0];
  const settledThemeUpdateDelays = [50];
  const viewportThemeUpdateDelays = [0, 100, 300, 700];
  const sampledColorMinAlpha = 0.08;
  const fallbackThemeStableDelayMs = 350;
  const visualThemeSettleDelayMs = 180;
  const rememberedThemeFallbackDelayMs = 220;
  const immediateThemeConfidenceMin = 4;
  const internalPageHeaderOpacity = 0.72;
  const unknownPageHeaderOpacity = 0.1;
  const themeBridgeTimeoutMs = 250;
  const themeMessageName = 'blended-addressbar:theme-response';
  const persistentThemeMessageName = 'blended-addressbar:persistent-theme';
  const themeFrameScriptUrl = 'chrome://sine/content/blended-addressbar/frame.js';
  const scriptModuleBaseUrl = 'chrome://sine/content/blended-addressbar/scripts/';
  const pageThemeCacheMaxEntries = 500;
  const scheduleSafetyMs = 100;
  const loadbarPrefBranch = 'uc.loadbar.';
  const loadbarHeightPref = `${loadbarPrefBranch}height`;
  const loadbarOpacityPref = `${loadbarPrefBranch}opacity`;
  const loadbarColorPref = `${loadbarPrefBranch}color`;
  const loadbarModePref = `${loadbarPrefBranch}mode`;
  const loadbarFocusColorPref = `${loadbarPrefBranch}focus-color`;
  const defaultLoadbarMode = 'glow';
  const addressbarPrefBranch = 'uc.blended-addressbar.';
  const frameRadiusPref = `${addressbarPrefBranch}frame-radius`;
  const frameRadiusDisabledPref = `${addressbarPrefBranch}frame-radius.disabled`;
  const frameGapPref = `${addressbarPrefBranch}frame-gap`;
  const framePaddingDisabledPref = `${addressbarPrefBranch}frame-padding.disabled`;
  const frameShadowPref = `${addressbarPrefBranch}frame-shadow`;
  const framePrefNames = Object.freeze(new Set([
    frameRadiusPref,
    frameRadiusDisabledPref,
    frameGapPref,
    framePaddingDisabledPref,
    frameShadowPref
  ]));
  const windowTintEnabledPref = `${addressbarPrefBranch}window-tint.enabled`;
  const windowTintStrengthPref = `${addressbarPrefBranch}window-tint.strength`;
  const defaultWindowTintStrengthPercent = 25;
  const nativeZenThemeProperties = [
    '--zen-main-browser-background',
    '--zen-main-browser-background-toolbar'
  ];
  const nativeZenThemeDebugAttributes = Object.freeze([
    'data-blended-addressbar-native-theme-bg',
    'data-blended-addressbar-native-theme-fg',
    'data-blended-addressbar-native-theme-accent',
    'data-blended-addressbar-native-theme-tint',
    'data-blended-addressbar-native-theme-material',
    'data-blended-addressbar-native-theme-opacity',
    'data-blended-addressbar-native-theme-reason'
  ]);
  const chromeDoc = document;
  let themeCache = new WeakMap();
  let pageThemeCache = new Map();
  let persistentThemeListeners = new WeakMap();
  let themeRequestSeq = 0;
  let servicesModule = null;
  let lastThemeKey = null;
  let lastAppliedTheme = null;
  let nativeZenThemeOriginals = null;
  const themeApplyState = {
    href: '',
    applied: null,
    pending: null,
    pendingTimer: 0
  };
  let delayedThemeFallbackTimer = 0;
  let samplingActive = false;
  let samplingTimer = 0;
  let samplingInFlight = false;
  let lastCss = null;
  let lastLogAt = 0;
  let currentIntervalMs = samplingIntervalMs;
  let scheduledThemeTimers = [];
  let viewportThemeUpdateTimer = 0;
  let viewportResizeObserver = null;
  let loadingThemeStartedAt = 0;
  let loadingThemeBrowser = null;
  let loadingThemeHref = '';
  let activeThemeUpdateInFlight = false;
  let pendingActiveThemeUpdateOptions = null;
  let scheduledActiveUpdate = false;
  let scheduledActiveUpdateOptions = null;
  let scheduledActiveUpdateAt = 0;
  let scheduledActiveUpdateRaf = 0;
  let scheduledActiveUpdateTimer = 0;
  let zenBoostMutationObserver = null;
  let lastZenBoostActive = false;

  function getServices() {
    try {
      if (typeof Services !== 'undefined') return Services;
    } catch {}

    try {
      if (!servicesModule && typeof ChromeUtils !== 'undefined') {
        servicesModule = ChromeUtils.importESModule('resource://gre/modules/Services.sys.mjs').Services;
      }
      return servicesModule || null;
    } catch {}

    return null;
  }

  function loadBlendedAddressbarModule(filename, options = {}) {
    const target = {
      BlendedAddressbarModuleOptions: options,
      console
    };
    const scriptLoader = getServices()?.scriptloader;
    if (!scriptLoader?.loadSubScript) {
      throw new Error(`[blended-addressbar:urlbar] Unable to load ${filename}: scriptloader unavailable`);
    }

    scriptLoader.loadSubScript(`${scriptModuleBaseUrl}${filename}`, target, 'UTF-8');
    if (!target.BlendedAddressbarModule) {
      throw new Error(`[blended-addressbar:urlbar] Unable to load ${filename}: module export missing`);
    }

    return target.BlendedAddressbarModule;
  }

  const {
    removeStylePropertyIfChanged,
    setStylePropertyIfChanged
  } = loadBlendedAddressbarModule('style-state.js');

  const {
    cleanupPaneCornerRadii,
    observePaneCornerRadii,
    schedulePaneCornerRadiiUpdate
  } = loadBlendedAddressbarModule('pane-layout.js', {
    chromeDoc,
    removeStylePropertyIfChanged,
    setStylePropertyIfChanged
  });

  const {
    getCachedColorSourceName,
    getColorSourceName,
    getColorSourcePolicy,
    getThemeSourceConfidence,
    isPixelThemeSource,
    isPreferredSemanticThemeSource,
    isRenderedThemeSource
  } = loadBlendedAddressbarModule('theme-source-policy.js');

  const {
    cssSupports,
    getPrefs,
    normalizeCssColor,
    normalizeCssLength,
    normalizeFrameShadowPreset,
    normalizeLoadbarMode,
    normalizeOpacity,
    normalizePercent,
    readBoolPref,
    readStringPref
  } = loadBlendedAddressbarModule('prefs.js', {
    getServices,
    window
  });

  const {
    chooseForeground,
    extractCssColor,
    getContrastRatio,
    getCssColorAlpha,
    getReadableForeground,
    getRelativeLuminance,
    hasVisibleColor,
    parseCssRgb
  } = loadBlendedAddressbarModule('color-utils.js', {
    cssSupports: (property, value) => cssSupports(property, value),
    sampledColorMinAlpha
  });

  function setVar(value, foreground) {
    const rootStyle = chromeDoc.documentElement.style;
    setStylePropertyIfChanged(rootStyle, '--zen-tab-header-background', value || 'transparent');
    if (foreground) {
      setStylePropertyIfChanged(rootStyle, '--zen-tab-header-foreground', foreground);
    } else {
      removeStylePropertyIfChanged(rootStyle, '--zen-tab-header-foreground');
    }
  }

  function clearTabHeaderTheme() {
    const rootStyle = chromeDoc.documentElement.style;
    removeStylePropertyIfChanged(rootStyle, '--zen-tab-header-background');
    removeStylePropertyIfChanged(rootStyle, '--zen-tab-header-foreground');
  }

  function getThemeColorTransition(theme, reason = '') {
    const uncertainSources = new Set([
      'host-cache',
      'target-cache',
      'same-host-retained',
      'unknown-page',
      'loading-unknown',
      'toolbar-fallback'
    ]);
    const source = uncertainSources.has(reason) ? reason : (theme?.source || reason || '');
    return source === 'host-cache'
      || source === 'target-cache'
      || source === 'same-host-retained'
      || source === 'unknown-page'
      || source === 'loading-unknown'
      || source === 'toolbar-fallback'
      ? '180ms ease-out'
      : '100ms linear';
  }

  function setThemeColorTransition(theme, reason = '') {
    setStylePropertyIfChanged(
      chromeDoc.documentElement.style,
      '--blended-addressbar-color-transition',
      getThemeColorTransition(theme, reason)
    );
  }

  function setThemeDebugAttributes(reason = '', theme = null, href = '') {
    if (!DEBUG_THEME) return;

    const root = chromeDoc.documentElement;
    root.setAttribute('data-blended-addressbar-theme-reason', reason || '');
    root.setAttribute('data-blended-addressbar-theme-bridge', theme?.bridge || '');
    root.setAttribute('data-blended-addressbar-theme-source', theme?.source || '');
    root.setAttribute('data-blended-addressbar-theme-bg', theme?.bg || '');
    root.setAttribute('data-blended-addressbar-theme-fg', theme?.fg || '');
    root.setAttribute('data-blended-addressbar-theme-href', href || theme?.href || '');
  }

  function isPageThemeEligibleHref(href) {
    return /^(https?|file):/i.test(String(href || ''));
  }

  function isInternalPageThemeHref(href) {
    return /^(about|chrome):/i.test(String(href || ''));
  }

  function getTranslucentHeaderColor(bg, opacity = internalPageHeaderOpacity) {
    const rgb = parseCssRgb(bg);
    if (rgb) return rgbaToCss({ ...rgb, a: opacity });
    return `color-mix(in srgb, ${bg} ${Math.round(opacity * 100)}%, transparent)`;
  }

  function getNeutralHeaderShade(browser, source = 'unknown-page') {
    const normalizedScheme = getCurrentThemeColorScheme();
    const shade = normalizedScheme === 'light'
      ? { r: 255, g: 255, b: 255, a: unknownPageHeaderOpacity }
      : { r: 0, g: 0, b: 0, a: unknownPageHeaderOpacity };

    return {
      bg: rgbaToCss(shade),
      fg: normalizedScheme === 'light' ? 'rgba(11, 13, 16, 0.82)' : 'rgba(245, 247, 251, 0.90)',
      bridge: 'chrome',
      href: getBrowserHref(browser),
      source
    };
  }

  function getCurrentThemeColorScheme() {
    const rootStyle = getComputedStyle(chromeDoc.documentElement);
    const colorScheme = rootStyle.getPropertyValue('--toolbar-color-scheme') || rootStyle.colorScheme;
    const normalizedScheme = String(colorScheme || '').trim().toLowerCase();
    if (normalizedScheme === 'light' || normalizedScheme === 'dark') return normalizedScheme;

    try {
      return window.matchMedia?.('(prefers-color-scheme: light)')?.matches ? 'light' : 'dark';
    } catch {}

    return chromeDoc.documentElement.hasAttribute('zen-should-be-dark-mode') ? 'dark' : 'light';
  }

  function getInternalPageTheme(browser) {
    const href = getBrowserHref(browser);
    if (!isInternalPageThemeHref(href)) return null;

    const doc = browser?.contentDocument || null;
    const view = doc?.defaultView || null;
    const canvasTheme = doc && view ? getDocumentCanvasTheme(doc, view) : null;
    const fallbackTheme = canvasTheme?.bg ? canvasTheme : getChromeContrastFallbackTheme(browser, 'internal-page-fallback');
    if (!fallbackTheme?.bg) return null;

    const bgRgb = parseCssRgb(fallbackTheme.bg);
    const fg = getReadableForeground(fallbackTheme.bg, [
      fallbackTheme.fg || null,
      bgRgb ? chooseForeground(bgRgb) : null
    ]);

    return {
      bg: getTranslucentHeaderColor(fallbackTheme.bg),
      fg,
      bridge: fallbackTheme.bridge || 'chrome',
      href,
      source: 'internal-page'
    };
  }

  function clearAdaptivePageTheme(reason = 'ineligible-url') {
    const href = getBrowserHref(gBrowser?.selectedBrowser || null);
    clearPendingThemeCandidate();
    resetThemeArbitration(href);
    lastAppliedTheme = null;
    lastThemeKey = null;
    lastCss = null;
    clearTabHeaderTheme();
    restoreNativeZenTheme();
    clearWindowTintBackground();
    chromeDoc.documentElement.style.removeProperty('--blended-addressbar-frame-background');
    setPageLoadbarColors(null);
    setThemeDebugAttributes(reason, null, href);
  }

  function applyInternalPageTheme(browser, reason = 'internal-page') {
    const href = getBrowserHref(browser);
    const resolvedTheme = getInternalPageTheme(browser);
    const theme = resolvedTheme?.bg
      ? resolvedTheme
      : (lastAppliedTheme?.source === 'internal-page' && lastAppliedTheme?.href === href ? lastAppliedTheme : null);
    if (!theme?.bg) {
      clearAdaptivePageTheme(reason);
      return false;
    }

    const key = getThemeKey(theme);
    if (key === lastThemeKey) {
      lastAppliedTheme = theme;
      return true;
    }

    clearPendingThemeCandidate();
    resetThemeArbitration(href);
    restoreNativeZenTheme();
    clearWindowTintBackground();
    chromeDoc.documentElement.style.removeProperty('--blended-addressbar-frame-background');

    lastAppliedTheme = theme;
    lastThemeKey = key;
    lastCss = theme.bg;
    setThemeColorTransition(theme, reason);
    setVar(theme.bg, theme.fg);
    setPageLoadbarColors(theme);
    setThemeDebugAttributes(reason, theme, href);

    return true;
  }

  function applyHeaderOnlyTheme(browser, theme, reason = 'header-only', expectedHref = null) {
    if (!theme?.bg || !browser || browser !== gBrowser?.selectedBrowser) return false;
    if (expectedHref && getBrowserHref(browser) !== expectedHref) return false;

    const href = getBrowserHref(browser);
    const key = getThemeKey(theme);
    if (key === lastThemeKey && getCurrentFrameBackground() === 'transparent') {
      lastAppliedTheme = theme;
      return true;
    }

    clearPendingThemeCandidate();
    resetThemeArbitration(href);
    restoreNativeZenTheme();
    clearWindowTintBackground();
    setStylePropertyIfChanged(chromeDoc.documentElement.style, '--blended-addressbar-frame-background', 'transparent', 'important');

    lastAppliedTheme = theme;
    lastThemeKey = key;
    lastCss = theme.bg;
    setThemeColorTransition(theme, reason);
    setVar(theme.bg, theme.fg);
    setPageLoadbarColors(theme);
    setThemeDebugAttributes(reason, theme, href);

    return true;
  }

  function applyTheme(theme, reason) {
    if (!theme) return;

    lastAppliedTheme = theme;
    setThemeColorTransition(theme, reason);
    setVar(theme.bg, theme.fg);
    applyNativeZenTheme(theme, reason);
    setPageLoadbarColors(theme);

    if (!DEBUG_THEME) return;

    setThemeDebugAttributes(reason, theme, theme.href || '');

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

  function rememberNativeZenThemeOriginals(root) {
    if (nativeZenThemeOriginals) return;

    nativeZenThemeOriginals = {
      attributes: {
        'zen-should-be-dark-mode': {
          hadValue: root.hasAttribute('zen-should-be-dark-mode'),
          value: root.getAttribute('zen-should-be-dark-mode')
        }
      },
      properties: nativeZenThemeProperties.map(name => ({
        name,
        priority: root.style.getPropertyPriority(name),
        value: root.style.getPropertyValue(name)
      }))
    };
  }

  function restoreNativeZenTheme() {
    if (!nativeZenThemeOriginals) return;

    const root = chromeDoc.documentElement;
    for (const property of nativeZenThemeOriginals.properties) {
      if (property.value) {
        root.style.setProperty(property.name, property.value, property.priority);
      } else {
        root.style.removeProperty(property.name);
      }
    }

    for (const [name, attribute] of Object.entries(nativeZenThemeOriginals.attributes)) {
      if (attribute.hadValue) {
        root.setAttribute(name, attribute.value);
      } else {
        root.removeAttribute(name);
      }
    }

    nativeZenThemeOriginals = null;
    clearWindowTintBackground(root);
    root.style.removeProperty('--blended-addressbar-frame-background');
    root.setAttribute('data-blended-addressbar-native-theme', 'restored');
    for (const attribute of nativeZenThemeDebugAttributes) {
      root.removeAttribute(attribute);
    }
  }

  function getWindowTintBackground(bg, tintStrengthPercent) {
    return `color-mix(in srgb, ${bg} ${tintStrengthPercent}%, transparent)`;
  }

  function getZenBrowserBackground() {
    return chromeDoc.getElementById('zen-browser-background');
  }

  function clearWindowTintBackground(root = chromeDoc.documentElement) {
    root.style.removeProperty('--blended-addressbar-window-tint-background');
    getZenBrowserBackground()?.style.removeProperty('--blended-addressbar-window-tint-background');
  }

  function setWindowTintBackground(tintBackground, root = chromeDoc.documentElement) {
    setStylePropertyIfChanged(root.style, '--blended-addressbar-window-tint-background', tintBackground, 'important');
    setStylePropertyIfChanged(getZenBrowserBackground()?.style, '--blended-addressbar-window-tint-background', tintBackground, 'important');
  }

  function getCurrentFrameBackground(root = chromeDoc.documentElement) {
    return String(root.style.getPropertyValue('--blended-addressbar-frame-background') || '').trim();
  }

  function applyNativeZenTheme(theme, reason = '') {
    const root = chromeDoc.documentElement;

    if (!readWindowTintEnabled()) {
      restoreNativeZenTheme();
      root.setAttribute('data-blended-addressbar-native-theme', 'disabled');
      return;
    }

    if (!hasVisibleColor(theme?.bg)) {
      restoreNativeZenTheme();
      root.setAttribute('data-blended-addressbar-native-theme', 'no-background');
      return;
    }

    const bg = theme.bg;
    const tintStrengthPercent = readWindowTintStrengthPercent();
    const tintBackground = getWindowTintBackground(bg, tintStrengthPercent);

    rememberNativeZenThemeOriginals(root);
    setWindowTintBackground(tintBackground, root);
    setStylePropertyIfChanged(root.style, '--blended-addressbar-frame-background', tintBackground, 'important');
    root.setAttribute('data-blended-addressbar-native-theme', 'applied');
    root.setAttribute('data-blended-addressbar-native-theme-bg', bg);
    root.setAttribute('data-blended-addressbar-native-theme-tint', tintBackground);
    root.setAttribute('data-blended-addressbar-native-theme-opacity', String(tintStrengthPercent / 100));
    root.setAttribute('data-blended-addressbar-native-theme-reason', reason || '');
  }

  function getBrowserHref(browser) {
    return browser?.currentURI?.spec || '';
  }

  function normalizeAlphaForKey(alpha) {
    const value = Number(alpha);
    if (!Number.isFinite(value)) return '1';

    const clamped = Math.max(0, Math.min(1, value));
    return String(Math.round(clamped * 1000) / 1000);
  }

  function getHexColorAlphaForKey(value) {
    const hex = String(value || '').trim().match(/^#([0-9a-f]{4}|[0-9a-f]{8})$/i);
    if (!hex) return null;

    const raw = hex[1];
    const alpha = raw.length === 4
      ? parseInt(`${raw[3]}${raw[3]}`, 16)
      : parseInt(raw.slice(6, 8), 16);
    return Number.isFinite(alpha) ? alpha / 255 : null;
  }

  function normalizeThemeColorForKey(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const rgb = parseCssRgb(raw);
    if (!rgb) return raw.toLowerCase().replace(/\s+/g, ' ');

    const alpha = normalizeAlphaForKey(getHexColorAlphaForKey(raw) ?? getCssColorAlpha(raw) ?? 1);
    return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
  }

  function getThemeKey(theme) {
    return `${normalizeThemeColorForKey(theme?.bg)}|${normalizeThemeColorForKey(theme?.fg)}`;
  }

  function withStableForeground(theme, fallbackTheme = lastAppliedTheme) {
    if (!theme?.bg) return theme;
    if (hasVisibleColor(theme?.fg)) return theme;

    const bgRgb = parseCssRgb(theme.bg);
    const foreground = getReadableForeground(theme.bg, [
      fallbackTheme?.fg || null,
      bgRgb ? chooseForeground(bgRgb) : null
    ]);
    if (!foreground) return theme;

    return {
      ...theme,
      fg: foreground
    };
  }

  function clearPendingThemeCandidate() {
    if (themeApplyState.pendingTimer) clearTimeout(themeApplyState.pendingTimer);
    themeApplyState.pendingTimer = 0;
    themeApplyState.pending = null;
  }

  function clearDelayedThemeFallback() {
    if (delayedThemeFallbackTimer) clearTimeout(delayedThemeFallbackTimer);
    delayedThemeFallbackTimer = 0;
  }

  function resetThemeArbitration(href = '') {
    clearPendingThemeCandidate();
    clearDelayedThemeFallback();
    themeApplyState.href = href;
    themeApplyState.applied = null;
  }

  function ensureThemeArbitrationHref(href) {
    if (themeApplyState.href !== href) {
      resetThemeArbitration(href);
    }
  }

  function createResolveContext(browser, options = {}) {
    const loading = options.loading ?? isLoadingThemeFor(browser);

    return {
      appliedConfidence: options.appliedConfidence ?? themeApplyState.applied?.confidence ?? -1,
      browser,
      boostActive: options.boostActive ?? isZenBoostActive(),
      deferNonVisual: Boolean(options.deferNonVisual),
      fastOnly: Boolean(options.fastOnly),
      loading,
      now: options.now ?? Date.now(),
      pendingKey: options.pendingKey ?? (themeApplyState.pending?.key || ''),
      pendingSince: options.pendingSince ?? (themeApplyState.pending?.since || 0),
      phase: options.phase || (loading ? 'loading' : 'settled'),
      requirePixel: options.requirePixel ?? (options.boostActive ?? isZenBoostActive()),
      requireRendered: options.requireRendered ?? (options.boostActive ?? isZenBoostActive()),
      stableDelay: options.stableDelay ?? fallbackThemeStableDelayMs
    };
  }

  function shouldSkipFastLoadingTheme(theme, resolveContext) {
    if (resolveContext.requirePixel && !isPixelThemeSource(theme)) return true;

    return resolveContext.fastOnly
      && resolveContext.loading
      && !isRenderedThemeSource(theme.source)
      && !isPreferredSemanticThemeSource(theme.source);
  }

  function shouldApplyThemeCandidate(theme, options = {}) {
    if (!theme?.bg) return { action: 'ignore', confidence: 0, key: '' };

    const {
      appliedConfidence = themeApplyState.applied?.confidence ?? -1,
      deferNonVisual = false,
      loading = false,
      now = Date.now(),
      pendingKey = themeApplyState.pending?.key || '',
      pendingSince = themeApplyState.pending?.since || 0,
      requirePixel = false,
      requireRendered = false,
      stableDelay = fallbackThemeStableDelayMs
    } = options;
    const confidence = getThemeSourceConfidence(theme);
    const key = `${getThemeKey(theme)}|${theme.source || ''}`;
    const source = theme.source || '';
    const replacingHostCache = themeApplyState.applied?.source === 'host-cache'
      && source !== 'host-cache'
      && confidence > 0;
    const requirePixelTheme = requirePixel && !isPixelThemeSource(theme);
    if (requirePixelTheme) {
      return { action: 'ignore', confidence, key };
    }

    const requireRenderedTheme = requireRendered && !isRenderedThemeSource(theme);
    if (requireRenderedTheme) {
      return { action: 'ignore', confidence, key };
    }

    const deferForVisualSample = deferNonVisual
      && !replacingHostCache
      && !isRenderedThemeSource(source);

    if (deferForVisualSample) {
      if (!loading && appliedConfidence >= 0 && confidence < appliedConfidence) {
        return { action: 'ignore', confidence, key };
      }

      if (pendingKey === key && pendingSince && now - pendingSince >= stableDelay) {
        return { action: 'apply', confidence, key };
      }

      return { action: 'defer', confidence, key };
    }

    if (!loading) {
      return replacingHostCache || confidence >= appliedConfidence
        ? { action: 'apply', confidence, key }
        : { action: 'ignore', confidence, key };
    }

    if (!replacingHostCache && appliedConfidence >= 0 && confidence <= appliedConfidence) {
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

  function getThemeHostKey(href) {
    try {
      const url = new URL(String(href || ''));
      return /^(https?):$/i.test(url.protocol) && url.hostname
        ? url.hostname.toLowerCase()
        : null;
    } catch {}

    return null;
  }

  function getThemePageKey(href) {
    try {
      const url = new URL(String(href || ''));
      if (/^(https?|file):$/i.test(url.protocol)) return `${url.origin}${url.pathname}`;
    } catch {}

    return String(href || '');
  }

  function sanitizePageTheme(theme, href) {
    if (!theme?.bg || !isPageThemeEligibleHref(href)) return null;
    if (theme.source === 'host-cache' || theme.source === 'page-cache') return null;
    if (getThemeSourceConfidence(theme) < 2) return null;

    return {
      bg: theme.bg,
      fg: theme.fg || null,
      bridge: theme.bridge || 'cache',
      href,
      source: theme.source || ''
    };
  }

  function cachePageTheme(theme, href) {
    const key = getThemePageKey(href);
    const cachedTheme = sanitizePageTheme(theme, href);
    if (!key || !cachedTheme) return;

    if (pageThemeCache.has(key)) pageThemeCache.delete(key);
    pageThemeCache.set(key, {
      savedAt: Date.now(),
      theme: cachedTheme
    });

    while (pageThemeCache.size > pageThemeCacheMaxEntries) {
      pageThemeCache.delete(pageThemeCache.keys().next().value);
    }
  }

  function getCachedPageTheme(browser) {
    const href = getBrowserHref(browser);
    const key = getThemePageKey(href);
    if (!key) return null;

    const entry = pageThemeCache.get(key);
    if (!entry?.theme?.bg) return null;

    pageThemeCache.delete(key);
    pageThemeCache.set(key, entry);
    return {
      ...entry.theme,
      href,
      cachedAt: entry.savedAt
    };
  }

  function cacheTheme(browser, theme) {
    if (!browser || !theme?.bg) return;

    const href = theme.href || getBrowserHref(browser);

    themeCache.set(browser, {
      href,
      theme
    });
    cachePageTheme(theme, href);
  }

  function getCachedTargetTheme(browser) {
    const cached = browser ? themeCache.get(browser) : null;
    if (cached
      && cached.href === getBrowserHref(browser)
      && cached.theme?.bg
      && cached.theme.source !== 'host-cache') {
      return cached.theme;
    }

    return getCachedPageTheme(browser);
  }

  function getSameHostRetainedTheme(expectedHref) {
    const expectedHost = getThemeHostKey(expectedHref);
    const previousHost = getThemeHostKey(lastAppliedTheme?.href);
    if (!expectedHost) return null;
    if (previousHost !== expectedHost) return null;

    if (!lastAppliedTheme?.bg || !isPageThemeEligibleHref(expectedHref)) return null;
    if (lastAppliedTheme.source === 'host-cache' || getThemeSourceConfidence(lastAppliedTheme) < 2) return null;

    return {
      bg: lastAppliedTheme.bg,
      fg: lastAppliedTheme.fg || null,
      bridge: lastAppliedTheme.bridge || 'cache',
      href: expectedHref,
      source: 'host-cache',
      cachedSource: lastAppliedTheme.source || ''
    };
  }

  function isZenBoostActive() {
    return chromeDoc.getElementById('zen-site-data-icon-button')?.hasAttribute('boosting') || false;
  }

  function clearActivePageThemeCache(browser = gBrowser?.selectedBrowser || null) {
    if (!browser) return;

    const href = getBrowserHref(browser);
    themeCache.delete(browser);

    const pageKey = getThemePageKey(href);
    if (pageKey) pageThemeCache.delete(pageKey);

    clearPendingThemeCandidate();
  }

  function handleZenBoostStateChange() {
    const nextBoostActive = isZenBoostActive();
    if (nextBoostActive === lastZenBoostActive) return;

    lastZenBoostActive = nextBoostActive;
    const browser = gBrowser?.selectedBrowser || null;
    clearActivePageThemeCache(browser);
    requestPersistentFrameTheme(browser, true);
    scheduleActiveUpdate({ reason: 'zen-boost-change', skipToolbarFallback: true });
  }

  function observeZenBoostState() {
    const button = chromeDoc.getElementById('zen-site-data-icon-button');
    if (!button || typeof MutationObserver === 'undefined') {
      setTimeout(observeZenBoostState, 500);
      return;
    }

    lastZenBoostActive = isZenBoostActive();
    if (zenBoostMutationObserver) zenBoostMutationObserver.disconnect();
    zenBoostMutationObserver = new MutationObserver(handleZenBoostStateChange);
    zenBoostMutationObserver.observe(button, {
      attributes: true,
      attributeFilter: ['boosting']
    });
  }

  function clearThemeCache(reason = 'clear-cache') {
    themeCache = new WeakMap();
    pageThemeCache = new Map();
    lastThemeKey = null;
    lastCss = null;
    clearPendingThemeCandidate();
    resetThemeArbitration(getBrowserHref(gBrowser?.selectedBrowser || null));

    const root = chromeDoc.documentElement;
    root.setAttribute('data-blended-addressbar-cache-cleared-at', String(Date.now()));
    root.setAttribute('data-blended-addressbar-cache-clear-reason', reason);
  }

  function isLoadingThemeFor(browser) {
    return !!browser
      && browser === loadingThemeBrowser
      && !!loadingThemeStartedAt
      && getBrowserHref(browser) === loadingThemeHref;
  }

  function applyThemeCandidateNow(browser, theme, reason, expectedHref, decision) {
    cacheTheme(browser, theme);
    clearPendingThemeCandidate();
    clearDelayedThemeFallback();

    const key = getThemeKey(theme);
    themeApplyState.applied = {
      confidence: decision.confidence,
      href: getBrowserHref(browser),
      key,
      source: theme.source || ''
    };

    if (key === lastThemeKey) {
      lastAppliedTheme = theme;
      return true;
    }

    lastThemeKey = key;
    lastCss = theme.bg;
    applyTheme(theme, reason);

    return true;
  }

  function queueStableThemeCandidate(browser, theme, reason, expectedHref, decision, options = {}) {
    const href = getBrowserHref(browser);
    const now = Date.now();
    const resolveContext = createResolveContext(browser, options);
    const loading = resolveContext.loading;
    const requirePixel = resolveContext.requirePixel;
    const requireRendered = resolveContext.requireRendered;
    const stableDelay = resolveContext.stableDelay;
    const pending = themeApplyState.pending;
    const sameCandidate = pending?.href === href && pending.key === decision.key;
    const since = sameCandidate ? pending.since : now;

    if (themeApplyState.pendingTimer) clearTimeout(themeApplyState.pendingTimer);
    themeApplyState.pending = {
      confidence: decision.confidence,
      expectedHref,
      href,
      key: decision.key,
      options: {
        deferNonVisual: Boolean(options.deferNonVisual),
        loading,
        requirePixel,
        requireRendered,
        stableDelay
      },
      reason,
      since,
      theme
    };

    const elapsed = now - since;
    const remaining = Math.max(0, stableDelay - elapsed);
    themeApplyState.pendingTimer = setTimeout(() => {
      const queued = themeApplyState.pending;
      if (!queued || queued.key !== decision.key || queued.href !== getBrowserHref(browser)) return;
      void applyResolvedTheme(browser, queued.theme, queued.reason, queued.expectedHref, {
        deferNonVisual: queued.options?.deferNonVisual ?? false,
        loading: queued.options?.loading ?? true,
        requirePixel: queued.options?.requirePixel ?? false,
        requireRendered: queued.options?.requireRendered ?? false,
        stableDelay: queued.options?.stableDelay ?? fallbackThemeStableDelayMs,
        now: Date.now()
      });
    }, remaining);
  }

  function applyResolvedTheme(browser, theme, reason, expectedHref = null, options = {}) {
    if (!theme?.bg || !browser || browser !== gBrowser?.selectedBrowser) return false;
    if (expectedHref && getBrowserHref(browser) !== expectedHref) return false;
    if (expectedHref && theme.href && theme.href !== expectedHref) return false;

    const foregroundTheme = withStableForeground(theme);
    const visibleTheme = hasVisibleColor(foregroundTheme.bg)
      ? foregroundTheme
      : getChromeContrastFallbackTheme(browser, 'chrome-contrast-fallback');

    const href = getBrowserHref(browser);
    ensureThemeArbitrationHref(href);

    const resolveContext = createResolveContext(browser, options);
    const decision = shouldApplyThemeCandidate(visibleTheme, resolveContext);

    if (decision.action === 'ignore') return false;
    if (decision.action === 'defer') {
      queueStableThemeCandidate(browser, visibleTheme, reason, expectedHref, decision, resolveContext);
      return false;
    }

    return applyThemeCandidateNow(browser, visibleTheme, reason, expectedHref, decision);
  }

  function hasFreshAppliedTheme(expectedHref) {
    const applied = themeApplyState.applied;
    return !!applied
      && applied.href === expectedHref
      && applied.source !== 'host-cache';
  }

  function scheduleDelayedThemeFallback(browser, theme, reason, expectedHref, options = {}) {
    if (!theme?.bg || !browser) return false;

    clearDelayedThemeFallback();
    delayedThemeFallbackTimer = setTimeout(() => {
      delayedThemeFallbackTimer = 0;
      if (browser !== gBrowser?.selectedBrowser) return;
      if (expectedHref && getBrowserHref(browser) !== expectedHref) return;
      if (hasFreshAppliedTheme(expectedHref)) return;

      if (options.headerOnly) {
        applyHeaderOnlyTheme(browser, theme, reason, expectedHref);
        return;
      }

      applyResolvedTheme(browser, theme, reason, expectedHref, {
        ...options,
        loading: isLoadingThemeFor(browser)
      });
    }, options.delay ?? rememberedThemeFallbackDelayMs);

    return true;
  }

  function readWindowTintEnabled() {
    return readBoolPref(windowTintEnabledPref, false);
  }

  function readWindowTintStrengthPercent() {
    return normalizePercent(readStringPref(windowTintStrengthPref, String(defaultWindowTintStrengthPercent)), defaultWindowTintStrengthPercent, 0, 100);
  }

  function setPageLoadbarColors(theme) {
    const rootStyle = chromeDoc.documentElement.style;
    if (hasVisibleColor(theme?.bg)) {
      setStylePropertyIfChanged(rootStyle, '--blended-addressbar-page-loadbar-background', theme.bg);
    } else {
      removeStylePropertyIfChanged(rootStyle, '--blended-addressbar-page-loadbar-background');
    }

    if (hasVisibleColor(theme?.fg)) {
      setStylePropertyIfChanged(rootStyle, '--blended-addressbar-page-loadbar-foreground', theme.fg);
      return;
    }

    const bgRgb = parseCssRgb(theme?.bg);
    if (bgRgb) {
      setStylePropertyIfChanged(rootStyle, '--blended-addressbar-page-loadbar-foreground', chooseForeground(bgRgb));
    } else {
      removeStylePropertyIfChanged(rootStyle, '--blended-addressbar-page-loadbar-foreground');
    }
  }

  function applyFramePrefs() {
    const root = chromeDoc.documentElement;
    const rootStyle = root.style;
    const radius = readBoolPref(frameRadiusDisabledPref, false)
      ? '0px'
      : normalizeCssLength(readStringPref(frameRadiusPref, '14px'), '14px');
    const gap = readBoolPref(framePaddingDisabledPref, false) ? '0px' : normalizeCssLength(readStringPref(frameGapPref, '5px'), '5px');
    const shadowPreset = normalizeFrameShadowPreset(readStringPref(frameShadowPref, 'standard'));

    setStylePropertyIfChanged(rootStyle, '--blended-addressbar-frame-radius', radius);
    setStylePropertyIfChanged(rootStyle, '--blended-addressbar-frame-gap', gap);
    root.setAttribute('data-blended-addressbar-frame-shadow', shadowPreset);

    if (DEBUG_THEME) {
      root.setAttribute('data-blended-addressbar-frame-radius', radius);
      root.setAttribute('data-blended-addressbar-frame-gap', gap);
    }
  }

  function observeFramePrefs() {
    const prefs = getPrefs();
    if (!prefs?.addObserver) return;

    const observer = {
      observe(_subject, topic, prefName) {
        if (topic === 'nsPref:changed' && framePrefNames.has(String(prefName || ''))) {
          applyFramePrefs();
        }
      }
    };

    try {
      prefs.addObserver(addressbarPrefBranch, observer);
      if (typeof addUnloadListener === 'function') {
        addUnloadListener(() => {
          try {
            prefs.removeObserver(addressbarPrefBranch, observer);
          } catch {}
        });
      }
    } catch {}
  }

  function observeNativeZenThemePrefs() {
    const prefs = getPrefs();
    if (!prefs?.addObserver) return;

    const observer = {
      observe(_subject, topic, prefName) {
        const changedPref = String(prefName || '');
        if (topic !== 'nsPref:changed'
          || (changedPref !== windowTintEnabledPref
            && changedPref !== windowTintStrengthPref)) {
          return;
        }

        if (readWindowTintEnabled()) {
          if (lastAppliedTheme) {
            applyNativeZenTheme(lastAppliedTheme, 'window-tint-pref-enabled');
          } else {
            void updateActive({ reason: 'window-tint-enabled' });
          }
        } else {
          restoreNativeZenTheme();
        }
      }
    };

    try {
      prefs.addObserver(addressbarPrefBranch, observer);
      if (typeof addUnloadListener === 'function') {
        addUnloadListener(() => {
          try {
            prefs.removeObserver(addressbarPrefBranch, observer);
          } catch {}
        });
      }
    } catch {}
  }

  function getLoadbarGlowMix(opacity, percent) {
    const alpha = Number(opacity);
    const clamped = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
    return `${Math.round(clamped * percent * 1000) / 1000}%`;
  }

  function applyLoadbarPrefs() {
    const root = chromeDoc.documentElement;
    const rootStyle = root.style;
    const height = normalizeCssLength(readStringPref(loadbarHeightPref, '2px'), '2px');
    const opacity = normalizeOpacity(readStringPref(loadbarOpacityPref, '100'), '1');
    const customColor = normalizeCssColor(readStringPref(loadbarColorPref, 'var(--zen-primary-color)'), 'var(--zen-primary-color)');
    const mode = readStringPref(loadbarModePref, defaultLoadbarMode);
    const normalizedMode = normalizeLoadbarMode(mode);
    const useFocusColor = readBoolPref(loadbarFocusColorPref, true);

    setStylePropertyIfChanged(rootStyle, '--blended-addressbar-loadbar-height', height);
    setStylePropertyIfChanged(rootStyle, '--blended-addressbar-loadbar-opacity', opacity);
    setStylePropertyIfChanged(rootStyle, '--blended-addressbar-loadbar-static-color', customColor);
    setStylePropertyIfChanged(rootStyle, '--blended-addressbar-loadbar-glow-strong-mix', getLoadbarGlowMix(opacity, 34));
    setStylePropertyIfChanged(rootStyle, '--blended-addressbar-loadbar-glow-medium-mix', getLoadbarGlowMix(opacity, 18));
    setStylePropertyIfChanged(rootStyle, '--blended-addressbar-loadbar-glow-weak-mix', getLoadbarGlowMix(opacity, 7));
    root.setAttribute('data-blended-addressbar-loadbar-mode', normalizedMode);
    root.setAttribute('data-blended-addressbar-loadbar-focus-color', String(useFocusColor));

    if (DEBUG_THEME) {
      root.setAttribute('data-blended-addressbar-loadbar-height', height);
      root.setAttribute('data-blended-addressbar-loadbar-opacity', opacity);
      root.setAttribute('data-blended-addressbar-loadbar-custom-color', customColor);
      root.setAttribute('data-blended-addressbar-loadbar-focus-color-enabled', String(useFocusColor));
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

      return withMeta(getDarkReaderTheme(doc, view))
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

  function getPersistentFrameTheme(data, browser) {
    const href = data?.href || getBrowserHref(browser);
    if (!data?.bg || !isPageThemeEligibleHref(href)) return null;

    return {
      bg: data.bg,
      fg: data.fg || null,
      bridge: 'persistent-frame',
      href,
      source: data.source || 'pixel-top-edge'
    };
  }

  function attachPersistentThemeListener(browser) {
    if (!browser || persistentThemeListeners.has(browser)) return;

    const messageManager = getBrowserMessageManager(browser);
    if (!messageManager?.addMessageListener) return;

    const listener = {
      receiveMessage(message) {
        const data = message?.data || null;
        const href = getBrowserHref(browser);
        if (!href || !isPageThemeEligibleHref(href)) return;
        if (data?.href && data.href !== href) return;

        const theme = getPersistentFrameTheme(data, browser);
        if (!theme?.bg) return;

        cacheTheme(browser, theme);
        if (browser === gBrowser?.selectedBrowser) {
          applyResolvedTheme(browser, theme, 'persistent-frame', href, {
            loading: isLoadingThemeFor(browser),
            requireRendered: isZenBoostActive()
          });
        }
      }
    };

    try {
      messageManager.addMessageListener(persistentThemeMessageName, listener);
      persistentThemeListeners.set(browser, listener);
    } catch {}
  }

  function detachPersistentThemeListener(browser) {
    if (!browser) return;

    const messageManager = getBrowserMessageManager(browser);
    const listener = persistentThemeListeners.get(browser);
    if (messageManager && listener) {
      try {
        messageManager.removeMessageListener(persistentThemeMessageName, listener);
      } catch {}
    }
    persistentThemeListeners.delete(browser);
  }

  function requestPersistentFrameTheme(browser, forceFresh = false) {
    const messageManager = getBrowserMessageManager(browser);
    if (!browser || !messageManager?.loadFrameScript || !messageManager?.addMessageListener) return false;

    attachPersistentThemeListener(browser);
    if (forceFresh) {
      const key = getThemePageKey(getBrowserHref(browser));
      if (key) pageThemeCache.delete(key);
    }

    try {
      messageManager.loadFrameScript(themeFrameScriptUrl, false);
      return true;
    } catch (error) {
      if (DEBUG_THEME) {
        console.info('[blended-addressbar:urlbar] Persistent frame bridge load failed', {
          error: error?.message || String(error),
          href: getBrowserHref(browser)
        });
      }
      return false;
    }
  }

  function getThemeFrameScript(requestId) {
    return `
      (() => {
        const requestId = ${JSON.stringify(requestId)};
        const messageName = ${JSON.stringify(themeMessageName)};

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
          const theme = withMeta(getDarkReaderTheme(doc, view), href, candidates)
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

    try {
      return await ContentTask.spawn(browser, null, () => {
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
          return withMeta(getDarkReaderTheme(doc, view), href, candidates)
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
    const probeStyle = getComputedStyle(probe);
    const toolbarBg = probeStyle.backgroundColor;
    const toolbarFg = probeStyle.color;
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
      keepCachedTheme = false,
      reason = 'fallback',
      samplingInterval = samplingIntervalMs,
      skipToolbarFallback = false
    } = options;
    stopSampling();

    if (!browser) return;

    const expectedHref = getBrowserHref(browser);
    if (!isPageThemeEligibleHref(expectedHref)) {
      if (applyInternalPageTheme(browser, 'internal-page')) return;
      clearAdaptivePageTheme('ineligible-url');
      return;
    }
    attachPersistentThemeListener(browser);

    const zenBoostActive = isZenBoostActive();
    if (zenBoostActive) requestPersistentFrameTheme(browser, true);

    const targetCachedTheme = getCachedTargetTheme(browser);
    const cachedTheme = targetCachedTheme;
    const deferRememberedFallback = keepCachedTheme && !zenBoostActive;
    const retainedHostTheme = targetCachedTheme ? null : getSameHostRetainedTheme(expectedHref);
    const targetCachedThemeApplied = !deferRememberedFallback && targetCachedTheme
      ? applyResolvedTheme(browser, targetCachedTheme, 'target-cache', expectedHref, {
        requireRendered: zenBoostActive
      })
      : false;
    const retainedHostThemeApplied = !deferRememberedFallback && retainedHostTheme
      ? applyResolvedTheme(browser, retainedHostTheme, 'same-host-retained', expectedHref, {
        requireRendered: zenBoostActive
      })
      : false;

    const hasStableCachedTabTheme = keepCachedTheme
      && !zenBoostActive
      && !deferRememberedFallback
      && (targetCachedThemeApplied || retainedHostThemeApplied);
    const deferUnknownFallback = keepCachedTheme && !zenBoostActive;
    if (hasStableCachedTabTheme) return;

    if (isLoadingThemeFor(browser) && !cachedTheme && !retainedHostTheme && !deferUnknownFallback) {
      requestPersistentFrameTheme(browser, true);
      applyHeaderOnlyTheme(browser, getNeutralHeaderShade(browser, 'loading-unknown'), 'loading-unknown', expectedHref);
      return;
    }

    const fastTheme = getBrowserPageThemeFromChrome(browser);
    if (fastTheme?.bg) {
      const skipLoadingSemanticFastTheme = shouldSkipFastLoadingTheme(fastTheme, createResolveContext(browser, {
        fastOnly,
        loading: isLoadingThemeFor(browser),
        requireRendered: zenBoostActive
      }));

      if (!skipLoadingSemanticFastTheme) {
        applyResolvedTheme(browser, fastTheme, reason === 'fallback' ? 'fast' : reason, expectedHref, {
          deferNonVisual: zenBoostActive || !fastOnly,
          requireRendered: zenBoostActive,
          stableDelay: visualThemeSettleDelayMs
        });
      }
    } else if (fastOnly) {
      return;
    } else if (!cachedTheme && !retainedHostTheme && !skipToolbarFallback && !deferUnknownFallback) {
      applyHeaderOnlyTheme(browser, getNeutralHeaderShade(browser, 'unknown-page'), 'unknown-page', expectedHref);
    }

    if (!fastOnly) {
      requestPersistentFrameTheme(browser, zenBoostActive || deferRememberedFallback || !cachedTheme);
      const pageTheme = await getBrowserPageTheme(browser);
      if (pageTheme?.bg) {
        applyResolvedTheme(browser, pageTheme, reason, expectedHref, {
          deferNonVisual: true,
          requireRendered: zenBoostActive,
          stableDelay: visualThemeSettleDelayMs
        });
      } else if (deferRememberedFallback) {
        const rememberedFallbackTheme = targetCachedTheme || retainedHostTheme;
        if (rememberedFallbackTheme?.bg) {
          scheduleDelayedThemeFallback(browser, rememberedFallbackTheme, rememberedFallbackTheme.source === 'host-cache' ? 'host-cache' : 'target-cache', expectedHref, {
            requireRendered: zenBoostActive
          });
        } else if (!skipToolbarFallback) {
          scheduleDelayedThemeFallback(browser, getNeutralHeaderShade(browser, 'unknown-page'), reason, expectedHref, { headerOnly: true });
        }
      } else if (!cachedTheme && !retainedHostTheme && !skipToolbarFallback) {
        applyHeaderOnlyTheme(browser, getNeutralHeaderShade(browser, 'unknown-page'), reason, expectedHref);
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

  function mergeActiveUpdateOptions(current = {}, next = {}) {
    if (!current) return next || {};
    if (!next) return current || {};

    return {
      ...current,
      ...next,
      enableSampler: Boolean(current.enableSampler || next.enableSampler),
      fastOnly: Boolean(current.fastOnly && next.fastOnly),
      keepCachedTheme: Boolean(current.keepCachedTheme && next.keepCachedTheme),
      skipToolbarFallback: Boolean(current.skipToolbarFallback && next.skipToolbarFallback),
      reason: next.reason || current.reason
    };
  }

  function scheduleActiveUpdate(options = {}) {
    scheduledActiveUpdateOptions = mergeActiveUpdateOptions(scheduledActiveUpdateOptions, options);

    if (scheduledActiveUpdate && Date.now() - scheduledActiveUpdateAt > scheduleSafetyMs * 4) {
      scheduledActiveUpdate = false;
    }
    if (scheduledActiveUpdate) return;

    scheduledActiveUpdate = true;
    scheduledActiveUpdateAt = Date.now();
    const run = () => {
      if (!scheduledActiveUpdate) return;

      scheduledActiveUpdate = false;
      try {
        if (scheduledActiveUpdateRaf) cancelAnimationFrame(scheduledActiveUpdateRaf);
      } catch {}
      if (scheduledActiveUpdateTimer) clearTimeout(scheduledActiveUpdateTimer);
      scheduledActiveUpdateRaf = 0;
      scheduledActiveUpdateTimer = 0;

      const nextOptions = scheduledActiveUpdateOptions || {};
      scheduledActiveUpdateOptions = null;
      void updateActive(nextOptions);
    };

    try {
      scheduledActiveUpdateRaf = requestAnimationFrame(run);
    } catch {
      scheduledActiveUpdateRaf = 0;
    }
    scheduledActiveUpdateTimer = setTimeout(run, scheduleSafetyMs);
  }

  function stopLoadingThemeTracking() {
    loadingThemeStartedAt = 0;
    loadingThemeBrowser = null;
    loadingThemeHref = '';
    if (!samplingEnabled) stopSampling();
  }

  function startLoadingThemeTracking(browser = gBrowser?.selectedBrowser || null) {
    if (!browser) return;

    const href = getBrowserHref(browser);
    const sameLoadingTarget = loadingThemeBrowser === browser && loadingThemeHref === href;
    stopLoadingThemeTracking();
    if (!sameLoadingTarget) {
      resetThemeArbitration(href);
    }

    loadingThemeBrowser = browser;
    loadingThemeHref = href;
    loadingThemeStartedAt = Date.now();
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
        scheduleActiveUpdate(options);
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

    applyFramePrefs();
    observeFramePrefs();
    applyLoadbarPrefs();
    observeLoadbarPrefs();
    observeNativeZenThemePrefs();

    gBrowser.tabContainer.addEventListener('TabSelect', () => {
      observeViewportThemeTarget();
      schedulePaneCornerRadiiUpdate();
      handleZenBoostStateChange();
      scheduleActiveUpdate({ reason: 'tab-select', keepCachedTheme: true });
    });

    gBrowser.tabContainer.addEventListener('TabClose', (event) => {
      detachPersistentThemeListener(event.target?.linkedBrowser || null);
    });

    try {
      let colorSchemeQuery = null;
      const onColorSchemeChange = () => {
        clearThemeCache('color-scheme-change');
        scheduleActiveUpdate({ reason: 'color-scheme-change' });
      };
      try {
        colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        colorSchemeQuery.addEventListener('change', onColorSchemeChange);
      } catch {}

      window.addEventListener('resize', scheduleViewportThemeUpdate);
      window.addEventListener('resize', schedulePaneCornerRadiiUpdate);
      if (typeof addUnloadListener === 'function') {
        addUnloadListener(() => {
          try {
            colorSchemeQuery?.removeEventListener?.('change', onColorSchemeChange);
          } catch {}
          window.removeEventListener('resize', scheduleViewportThemeUpdate);
          window.removeEventListener('resize', schedulePaneCornerRadiiUpdate);
          if (viewportThemeUpdateTimer) clearTimeout(viewportThemeUpdateTimer);
          if (scheduledActiveUpdateTimer) clearTimeout(scheduledActiveUpdateTimer);
          try {
            if (scheduledActiveUpdateRaf) cancelAnimationFrame(scheduledActiveUpdateRaf);
          } catch {}
          if (viewportResizeObserver) viewportResizeObserver.disconnect();
          cleanupPaneCornerRadii();
          if (zenBoostMutationObserver) zenBoostMutationObserver.disconnect();
          stopLoadingThemeTracking();
          clearPendingThemeCandidate();
          restoreNativeZenTheme();
        });
      }
    } catch {}
    observeViewportThemeTarget();
    observePaneCornerRadii();
    observeZenBoostState();

    const pl = {
      onLocationChange(browserArg, webProgress, req, location, flags) {
        try {
          const sameDocumentFlag = Ci?.nsIWebProgressListener?.LOCATION_CHANGE_SAME_DOCUMENT || 0;
          if (flags & sameDocumentFlag) return;
          const active = gBrowser.selectedBrowser;
          const isTop = webProgress && webProgress.isTopLevel;
          if (isTop) schedulePaneCornerRadiiUpdate();
          const matches = browserArg === active;
          if (isTop && matches) {
            startLoadingThemeTracking(browserArg);
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
          if (isTop) schedulePaneCornerRadiiUpdate();
          const matches = browserArg === active;
          if (!matches || !isTop) return;
          const listener = Ci && Ci.nsIWebProgressListener
            ? Ci.nsIWebProgressListener
            : null;
          const startFlag = listener ? listener.STATE_START : 0x00000001;
          const stopFlag = listener ? listener.STATE_STOP : 0x00000010;
          if (flags & startFlag) {
            startLoadingThemeTracking(browserArg);
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
            stopLoadingThemeTracking();
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

    schedulePaneCornerRadiiUpdate();
    void updateActive({ reason: 'init' });
  }

  initWhenReady();
})();
