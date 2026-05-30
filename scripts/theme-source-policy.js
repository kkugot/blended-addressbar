var BlendedAddressbarModule = (() => {
  'use strict';

  const colorSourcePolicies = Object.freeze({
    'selector-rule': Object.freeze({ sourceClass: 'explicit', rendered: true, confidence: 7, preferred: true }),
    'dark-reader': Object.freeze({ sourceClass: 'visual', rendered: true, confidence: 5, modifier: true }),
    'top-visible': Object.freeze({ sourceClass: 'visual', rendered: true, confidence: 6 }),
    'pixel-top-edge': Object.freeze({ sourceClass: 'visual', rendered: true, confidence: 6 }),
    pixel: Object.freeze({ sourceClass: 'visual', rendered: true, confidence: 6 }),
    'theme-color': Object.freeze({ sourceClass: 'semantic', rendered: false, confidence: 7, preferred: true }),
    body: Object.freeze({ sourceClass: 'semantic', rendered: false, confidence: 3 }),
    html: Object.freeze({ sourceClass: 'semantic', rendered: false, confidence: 3 }),
    'document-canvas': Object.freeze({ sourceClass: 'semantic', rendered: false, confidence: 2 }),
    sampler: Object.freeze({ sourceClass: 'visual', rendered: true, confidence: 1 }),
    'host-cache': Object.freeze({ sourceClass: 'cache', rendered: false, confidence: 4 }),
    'chrome-contrast-fallback': Object.freeze({ sourceClass: 'fallback', rendered: false, confidence: 1 }),
    'toolbar-fallback': Object.freeze({ sourceClass: 'fallback', rendered: false, confidence: 0 })
  });
  const pixelThemeSources = Object.freeze(new Set([
    'pixel-top-edge',
    'pixel',
    'sampler'
  ]));
  const unknownColorSourcePolicy = Object.freeze({
    sourceClass: 'unknown',
    rendered: false,
    confidence: 0
  });

  function getColorSourceName(themeOrSource) {
    return typeof themeOrSource === 'string'
      ? themeOrSource
      : (themeOrSource?.source || '');
  }

  function getCachedColorSourceName(themeOrSource) {
    return typeof themeOrSource === 'string'
      ? ''
      : (themeOrSource?.cachedSource || '');
  }

  function getColorSourcePolicy(themeOrSource) {
    return colorSourcePolicies[getColorSourceName(themeOrSource)] || unknownColorSourcePolicy;
  }

  function isRenderedThemeSource(source) {
    const sourceName = getColorSourceName(source);
    if (getColorSourcePolicy(sourceName).rendered) return true;

    return sourceName === 'host-cache' && getColorSourcePolicy(getCachedColorSourceName(source)).rendered;
  }

  function isPixelThemeSource(source) {
    const sourceName = getColorSourceName(source);
    if (pixelThemeSources.has(sourceName)) return true;

    return sourceName === 'host-cache' && isPixelThemeSource(getCachedColorSourceName(source));
  }

  function isPreferredSemanticThemeSource(source) {
    return getColorSourcePolicy(source).preferred === true;
  }

  function getThemeSourceConfidence(themeOrSource) {
    return getColorSourcePolicy(themeOrSource).confidence;
  }

  return Object.freeze({
    getCachedColorSourceName,
    getColorSourceName,
    getColorSourcePolicy,
    getThemeSourceConfidence,
    isPixelThemeSource,
    isPreferredSemanticThemeSource,
    isRenderedThemeSource
  });
})();
