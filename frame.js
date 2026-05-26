// Blended Addressbar content sampler.
// Loaded by blended-bar.uc.js into the active content process on demand.

(() => {
  'use strict';

  try {
    if (content.__blended_addressbar_frame_inited) {
      const sample = content.__blended_addressbar_sample;
      if (typeof sample === 'function') sample(true);
      return;
    }
    content.__blended_addressbar_frame_inited = true;

    const MESSAGE_NAME = 'blended-addressbar:persistent-theme';
    const PIXEL_SAMPLE_SIZE = 3;
    const SAMPLE_TOP_Y = 3;
    let lastKey = '';
    let debounceTimer = 0;
    let lastRescheduleAt = 0;
    let pixelCanvas = null;
    let pixelCtx = null;

    function ensureCanvas() {
      if (pixelCanvas && pixelCtx) return true;

      try {
        pixelCanvas = content.document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
        pixelCanvas.width = PIXEL_SAMPLE_SIZE;
        pixelCanvas.height = PIXEL_SAMPLE_SIZE;
        pixelCtx = pixelCanvas.getContext('2d', { willReadFrequently: true });
        return !!pixelCtx;
      } catch {
        pixelCanvas = null;
        pixelCtx = null;
        return false;
      }
    }

    function normalizeColor(color) {
      if (!color || typeof color !== 'string' || !ensureCanvas()) return null;

      try {
        pixelCtx.clearRect(0, 0, 1, 1);
        pixelCtx.fillStyle = 'rgba(0, 0, 0, 0)';
        pixelCtx.fillStyle = color.trim();
        pixelCtx.fillRect(0, 0, 1, 1);
        const data = pixelCtx.getImageData(0, 0, 1, 1).data;
        if (data[3] === 0) return null;
        return `rgb(${data[0]}, ${data[1]}, ${data[2]})`;
      } catch {
        return null;
      }
    }

    function parseRgb(color) {
      const match = String(color || '').match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
      return match ? { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) } : null;
    }

    function readableForeground(bg) {
      const rgb = parseRgb(bg);
      if (!rgb) return null;
      const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
      return luminance > 0.55 ? 'rgba(11, 13, 16, 0.92)' : 'rgba(245, 247, 251, 0.96)';
    }

    function isBlankBackground(color) {
      if (!color || color === 'transparent') return true;

      const match = String(color).match(/rgba\(([^)]+)\)/);
      if (!match) return false;

      const parts = match[1].split(',').map(part => parseFloat(part.trim()));
      return parts.length === 4 && parts[3] === 0;
    }

    function pickMetaThemeColor(doc) {
      const metas = doc.querySelectorAll('meta[name="theme-color" i]');
      let fallback = null;

      for (const meta of metas) {
        const value = meta.getAttribute('content');
        if (!value) continue;

        const media = meta.getAttribute('media');
        if (!media) {
          fallback ||= value;
          continue;
        }

        try {
          if (content.matchMedia(media).matches) return value;
        } catch {}
      }

      return fallback;
    }

    function readTopEdgePixel() {
      try {
        const width = content.innerWidth | 0;
        const height = content.innerHeight | 0;
        if (width <= 0 || height <= 0 || !ensureCanvas() || !pixelCtx.drawWindow) return null;

        const half = Math.floor(PIXEL_SAMPLE_SIZE / 2);
        const x = Math.max(0, Math.floor(width / 2) - half);
        const y = Math.max(0, Math.min(SAMPLE_TOP_Y, height - PIXEL_SAMPLE_SIZE));
        pixelCtx.clearRect(0, 0, PIXEL_SAMPLE_SIZE, PIXEL_SAMPLE_SIZE);
        pixelCtx.drawWindow(
          content,
          x,
          y,
          PIXEL_SAMPLE_SIZE,
          PIXEL_SAMPLE_SIZE,
          'rgba(0, 0, 0, 0)'
        );

        const data = pixelCtx.getImageData(0, 0, PIXEL_SAMPLE_SIZE, PIXEL_SAMPLE_SIZE).data;
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;

        for (let i = 0; i < PIXEL_SAMPLE_SIZE * PIXEL_SAMPLE_SIZE; i++) {
          const offset = i * 4;
          if (data[offset + 3] === 0) continue;
          r += data[offset];
          g += data[offset + 1];
          b += data[offset + 2];
          n++;
        }

        if (!n) return null;
        return `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
      } catch {
        return null;
      }
    }

    function readElementBackground(view, element) {
      if (!view || !element) return null;
      const style = view.getComputedStyle(element);
      if (!isBlankBackground(style.backgroundColor)) return style.backgroundColor;
      return null;
    }

    function readAncestorBackground(doc, view) {
      try {
        const width = content.innerWidth | 0;
        if (width <= 0 || content.innerHeight <= 0) return null;

        let element = doc.elementFromPoint(Math.floor(width / 2), SAMPLE_TOP_Y);
        for (let step = 0; element && step < 12; step++) {
          const bg = readElementBackground(view, element);
          if (bg) return bg;
          element = element.parentElement;
        }
      } catch {}

      return null;
    }

    function readTheme() {
      const doc = content.document;
      const view = doc?.defaultView;
      const body = doc?.body || null;
      const root = doc?.documentElement || null;
      if (!doc || !view || !root) return { bg: null, fg: null, source: 'unavailable' };

      const bodyStyle = body ? view.getComputedStyle(body) : null;
      const rootStyle = view.getComputedStyle(root);
      let bg = readTopEdgePixel();
      let source = bg ? 'pixel-top-edge' : '';

      if (!bg) {
        bg = normalizeColor(pickMetaThemeColor(doc));
        source = bg ? 'theme-color' : source;
      }

      if (!bg && bodyStyle && !isBlankBackground(bodyStyle.backgroundColor)) {
        bg = bodyStyle.backgroundColor;
        source = 'body';
      }

      if (!bg && rootStyle && !isBlankBackground(rootStyle.backgroundColor)) {
        bg = rootStyle.backgroundColor;
        source = 'html';
      }

      if (!bg) {
        bg = readAncestorBackground(doc, view);
        source = bg ? 'top-visible' : source;
      }

      const fg = readableForeground(bg);

      return { bg, fg, source: source || 'empty' };
    }

    function sample(force = false) {
      const theme = readTheme();
      const href = content.location?.href || '';
      const key = `${href}|${theme.bg || ''}|${theme.fg || ''}|${theme.source || ''}`;
      if (!force && key === lastKey) return;

      lastKey = key;
      sendAsyncMessage(MESSAGE_NAME, {
        bg: theme.bg,
        fg: theme.fg,
        href,
        source: theme.source
      });
    }
    content.__blended_addressbar_sample = sample;

    function debouncedSample() {
      if (debounceTimer) return;
      debounceTimer = content.setTimeout(() => {
        debounceTimer = 0;
        sample(false);
      }, 250);
    }

    function startObserving() {
      const doc = content.document;
      if (!doc?.documentElement || !doc.body) {
        content.setTimeout(startObserving, 150);
        return;
      }

      const THEME_ATTRS = [
        'class',
        'style',
        'theme',
        'color-scheme',
        'data-theme',
        'data-mode',
        'data-bs-theme',
        'data-color-scheme',
        'data-color-mode',
        'data-dark-mode',
        'data-prefers-color-scheme'
      ];

      const observer = new content.MutationObserver(debouncedSample);
      observer.observe(doc.documentElement, { attributes: true, attributeFilter: THEME_ATTRS });
      observer.observe(doc.body, { attributes: true, attributeFilter: THEME_ATTRS });
      content.__blended_addressbar_observer = observer;

      if (doc.head) {
        const headObserver = new content.MutationObserver(debouncedSample);
        headObserver.observe(doc.head, {
          attributes: true,
          attributeFilter: ['href', 'content', 'media', 'disabled'],
          characterData: true,
          childList: true,
          subtree: true
        });
        content.__blended_addressbar_head_observer = headObserver;
      }
    }

    function rescheduleLoad() {
      const now = Date.now();
      if (now - lastRescheduleAt < 500) return;

      lastRescheduleAt = now;
      content.setTimeout(() => sample(true), 300);
      content.setTimeout(() => sample(true), 2000);
    }

    if (content.document.readyState === 'loading') {
      content.document.addEventListener('DOMContentLoaded', () => sample(true), {
        capture: true,
        once: true
      });
    } else {
      sample(true);
    }

    startObserving();
    content.addEventListener('load', rescheduleLoad, { capture: true });
    content.addEventListener('pageshow', rescheduleLoad, { capture: true });
  } catch (error) {
    try {
      console.error('[blended-addressbar frame] init failed:', error);
    } catch {}
  }
})();
