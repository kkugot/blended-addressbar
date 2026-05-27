var BlendedAddressbarModule = ((options) => {
  'use strict';

  options = options || {};
  const defaultPersistentMaxEntries = 40;
  const defaultPrefMaxBytes = 8192;
  const defaultTtlMs = 7 * 24 * 60 * 60 * 1000;

  function readPositiveInt(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
  }

  const hostThemeCachePersistentMaxEntries = readPositiveInt(
    options.hostThemeCachePersistentMaxEntries,
    defaultPersistentMaxEntries
  );
  const hostThemeCachePrefMaxBytes = readPositiveInt(
    options.hostThemeCachePrefMaxBytes,
    defaultPrefMaxBytes
  );
  const hostThemeCacheTtlMs = readPositiveInt(
    options.hostThemeCacheTtlMs,
    defaultTtlMs
  );

  function normalizeHostThemeCacheEntry(entry, now = Date.now()) {
    let savedAt = 0;
    let theme = null;

    if (Array.isArray(entry)) {
      savedAt = Number(entry[0] || 0);
      theme = {
        bg: entry[1],
        fg: entry[2] || null,
        bridge: 'cache',
        href: '',
        source: entry[3] || ''
      };
    } else {
      savedAt = Number(entry?.savedAt || 0);
      theme = entry?.theme || null;
    }

    if (!savedAt || now - savedAt > hostThemeCacheTtlMs || !theme?.bg) return null;

    return {
      savedAt,
      theme: {
        bg: String(theme.bg || ''),
        fg: theme.fg ? String(theme.fg) : null,
        bridge: theme.bridge ? String(theme.bridge) : 'cache',
        href: theme.href ? String(theme.href) : '',
        source: theme.source ? String(theme.source) : ''
      }
    };
  }

  function normalizeSerializedHostThemeCacheItem(item, now = Date.now()) {
    if (!Array.isArray(item)) return null;

    const host = String(item[0] || '').trim().toLowerCase();
    if (!host) return null;

    const entry = item.length > 2
      ? normalizeHostThemeCacheEntry(item.slice(1), now)
      : normalizeHostThemeCacheEntry(item[1], now);

    return entry ? [host, entry] : null;
  }

  function serializeHostThemeCacheEntry(host, entry, now = Date.now()) {
    const normalizedHost = String(host || '').trim().toLowerCase();
    const normalizedEntry = normalizeHostThemeCacheEntry(entry, now);
    if (!normalizedHost || !normalizedEntry) return null;

    const compact = [
      normalizedHost,
      normalizedEntry.savedAt,
      normalizedEntry.theme.bg
    ];

    if (normalizedEntry.theme.fg || normalizedEntry.theme.source) {
      compact.push(normalizedEntry.theme.fg || '');
    }
    if (normalizedEntry.theme.source) {
      compact.push(normalizedEntry.theme.source);
    }

    return compact;
  }

  function serializeHostThemeCacheEntries(hostThemeCache, now = Date.now()) {
    const entries = [];

    for (const [host, entry] of hostThemeCache.entries()) {
      const serializedEntry = serializeHostThemeCacheEntry(host, entry, now);
      if (serializedEntry) entries.push(serializedEntry);
    }

    const boundedEntries = entries.slice(-hostThemeCachePersistentMaxEntries);
    while (boundedEntries.length) {
      const serialized = JSON.stringify({
        version: 2,
        entries: boundedEntries
      });

      if (serialized.length <= hostThemeCachePrefMaxBytes) return serialized;
      boundedEntries.shift();
    }

    return '';
  }

  return Object.freeze({
    normalizeHostThemeCacheEntry,
    normalizeSerializedHostThemeCacheItem,
    serializeHostThemeCacheEntries
  });
})(BlendedAddressbarModuleOptions);
