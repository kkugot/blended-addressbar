const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function read(name) {
  return fs.readFileSync(path.join(root, name), 'utf8');
}

test('page colors are bridged through native Zen theme variables', () => {
  const script = read('blended-bar.uc.js');

  assert.match(script, /--zen-main-browser-background/);
  assert.match(script, /--zen-main-browser-background-toolbar/);
  assert.match(script, /--zen-primary-color/);
  assert.match(script, /--zen-colors-primary/);
  assert.match(script, /--zen-colors-secondary/);
  assert.match(script, /--zen-colors-text-primary/);
  assert.match(script, /zen\.widget\.macos\.window-material/);
  assert.match(script, /function getMacosWindowMaterialTheme\(/);
  assert.match(script, /color-mix\(in srgb, \$\{bg\} \$\{Math\.round\(opacity \* 100\)\}%, transparent\)/);
  assert.match(script, /setProperty\('--zen-main-browser-background', materialTheme\.background, 'important'\)/);
  assert.match(script, /setProperty\('--zen-main-browser-background-toolbar', materialTheme\.toolbarBackground, 'important'\)/);
  assert.match(script, /function applyNativeZenTheme\(/);
  assert.match(script, /applyNativeZenTheme\(theme, reason\)/);
  assert.match(script, /data-blended-addressbar-native-theme/);
  assert.match(script, /data-blended-addressbar-native-theme-material/);
  assert.match(script, /data-blended-addressbar-native-theme-opacity/);
});

test('theme cache can be cleared through a momentary preference action', () => {
  const script = read('blended-bar.uc.js');
  const prefs = read('preferences.json');

  assert.match(script, /let themeCache = new WeakMap\(\)/);
  assert.match(script, /clearCacheRequestPref/);
  assert.match(script, /function clearThemeCache\(/);
  assert.match(script, /themeCache = new WeakMap\(\)/);
  assert.match(script, /prefs\.setBoolPref\(clearCacheRequestPref, false\)/);
  assert.match(script, /void updateActive\(\{ reason: 'clear-cache' \}\)/);
  assert.match(prefs, /uc\.blended-addressbar\.clear-cache-request/);
  assert.match(prefs, /Clear cached page colors/);
});

test('sidebar blending no longer force-paints sidebar backgrounds', () => {
  const css = read('style.css');
  const sidebarMediaIndex = css.indexOf('@media (-moz-bool-pref: "uc.blended-addressbar.sidebar.enabled")');

  assert.notEqual(sidebarMediaIndex, -1, 'sidebar preference block should exist');
  const sidebarBlock = css.slice(sidebarMediaIndex);
  assert.doesNotMatch(sidebarBlock, /background-color:\s*var\(--zen-tab-header-background/);
  assert.doesNotMatch(sidebarBlock, /#sidebar-main/);
  assert.doesNotMatch(sidebarBlock, /#zen-sidebar-splitter/);
});

test('adaptive foreground feeds Zen omnibox input text color', () => {
  const css = read('style.css');

  assert.match(css, /--input-color:\s*var\(--zen-tab-header-foreground,\s*currentColor\)/);
});

test('changelog documents the native Zen theme bridge', () => {
  const changelog = read('CHANGELOG.md');

  assert.match(changelog, /native Zen theme/i);
  assert.match(changelog, /sidebar/i);
});
