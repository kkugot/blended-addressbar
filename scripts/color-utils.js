var BlendedAddressbarModule = ((options) => {
  'use strict';

  options = options || {};
  const cssSupports = typeof options.cssSupports === 'function'
    ? options.cssSupports
    : (() => false);
  const sampledColorMinAlpha = Number.isFinite(options.sampledColorMinAlpha)
    ? options.sampledColorMinAlpha
    : 0.08;

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

    const darkFallback = 'rgba(11, 13, 16, 0.92)';
    const lightFallback = 'rgba(245, 247, 251, 0.96)';
    const darkRatio = getContrastRatio(bgRgb, parseCssRgb(darkFallback));
    const lightRatio = getContrastRatio(bgRgb, parseCssRgb(lightFallback));
    return darkRatio >= lightRatio ? darkFallback : lightFallback;
  }

  return Object.freeze({
    chooseForeground,
    extractCssColor,
    getContrastRatio,
    getCssColorAlpha,
    getReadableForeground,
    getRelativeLuminance,
    hasVisibleColor,
    parseCssRgb
  });
})(BlendedAddressbarModuleOptions);
