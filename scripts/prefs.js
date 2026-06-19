var BlendedAddressbarModule = ((options) => {
  'use strict';

  options = options || {};
  const loadbarModeFallback = 'glow';
  const loadbarModeValues = Object.freeze(new Set(['default', 'progress', 'glow', 'edge']));
  const getServices = typeof options.getServices === 'function'
    ? options.getServices
    : (() => null);
  const browserWindow = options.window || null;

  function getPrefs() {
    try {
      return getServices()?.prefs || null;
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

  function readBoolPref(name, fallback) {
    const prefs = getPrefs();
    if (!prefs) return fallback;

    try {
      return prefs.getBoolPref(name, fallback);
    } catch {}

    return fallback;
  }

  function cssSupports(property, value) {
    try {
      return !!browserWindow?.CSS?.supports?.(property, value);
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

  function normalizeFrameShadowPreset(value) {
    const preset = String(value || '').trim();
    return ['standard', 'minimal', 'medium'].includes(preset) ? preset : 'standard';
  }

  function normalizeLoadbarMode(value) {
    const mode = String(value || '').trim();
    if (mode === 'none') return 'default';
    return loadbarModeValues.has(mode) ? mode : loadbarModeFallback;
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

  function normalizePercent(value, fallback, min = 0, max = 100) {
    const raw = String(value || '').trim();
    if (!raw) return fallback;

    const match = raw.match(/^(\d+(?:\.\d+)?)\s*%?$/);
    if (!match) return fallback;

    const amount = Number(match[1]);
    if (!Number.isFinite(amount)) return fallback;

    const clamped = Math.max(min, Math.min(max, amount));
    return Math.round(clamped * 1000) / 1000;
  }

  return Object.freeze({
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
  });
})(BlendedAddressbarModuleOptions);
