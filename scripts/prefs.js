var BlendedAddressbarModule = ((options) => {
  'use strict';

  options = options || {};
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

  function writeStringPref(name, value) {
    const prefs = getPrefs();
    if (!prefs) return false;

    try {
      prefs.setStringPref(name, value);
      return true;
    } catch {}

    try {
      prefs.setCharPref(name, value);
      return true;
    } catch {}

    return false;
  }

  function clearUserPref(name) {
    const prefs = getPrefs();
    if (!prefs?.clearUserPref) return false;

    try {
      prefs.clearUserPref(name);
      return true;
    } catch {}

    return false;
  }

  function readBoolPref(name, fallback) {
    const prefs = getPrefs();
    if (!prefs) return fallback;

    try {
      return prefs.getBoolPref(name, fallback);
    } catch {}

    return fallback;
  }

  function prefHasUserValue(name) {
    const prefs = getPrefs();
    if (!prefs?.prefHasUserValue) return false;

    try {
      return prefs.prefHasUserValue(name);
    } catch {}

    return false;
  }

  function readIntPref(name, fallback) {
    const prefs = getPrefs();
    if (!prefs) return fallback;

    try {
      return prefs.getIntPref(name, fallback);
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
    return ['standard', 'minimal', 'medium', 'none'].includes(preset) ? preset : 'standard';
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
    clearUserPref,
    cssSupports,
    getPrefs,
    normalizeCssColor,
    normalizeCssLength,
    normalizeFrameShadowPreset,
    normalizeOpacity,
    normalizePercent,
    prefHasUserValue,
    readBoolPref,
    readIntPref,
    readStringPref,
    writeStringPref
  });
})(BlendedAddressbarModuleOptions);
