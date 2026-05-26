const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = join(__dirname, '..');

function read(name) {
  return readFileSync(join(root, name), 'utf8');
}

function cssRuleBlock(css, selector) {
  const selectorIndex = css.indexOf(selector);
  assert.notEqual(selectorIndex, -1, `missing selector: ${selector}`);
  const openIndex = css.indexOf('{', selectorIndex);
  assert.notEqual(openIndex, -1, `missing opening brace for selector: ${selector}`);
  const closeIndex = css.indexOf('}', openIndex);
  assert.notEqual(closeIndex, -1, `missing closing brace for selector: ${selector}`);
  return css.slice(openIndex + 1, closeIndex);
}

test('browser window tint bridges page colors through native Zen window theme variables', () => {
  const script = read('blended-bar.uc.js');
  const css = read('style.css');
  const prefs = read('preferences.json');
  const readme = read('README.md');

  assert.match(script, /const windowTintEnabledPref = `\$\{addressbarPrefBranch\}window-tint\.enabled`/);
  assert.match(script, /const windowTintStrengthPref = `\$\{addressbarPrefBranch\}window-tint\.strength`/);
  assert.match(script, /const legacySidebarEnabledPref = `\$\{addressbarPrefBranch\}sidebar\.enabled`/);
  assert.match(script, /function readWindowTintEnabled\(/);
  assert.match(script, /function migrateWindowTintPref\(/);
  assert.match(script, /changedPref !== windowTintEnabledPref/);
  assert.match(script, /changedPref !== windowTintStrengthPref/);
  assert.match(script, /changedPref !== legacySidebarEnabledPref/);
  assert.match(script, /const defaultWindowTintStrengthPercent = 25/);
  assert.match(script, /function readWindowTintStrengthPercent\(/);
  assert.match(script, /normalizePercent\(readStringPref\(windowTintStrengthPref,\s*String\(defaultWindowTintStrengthPercent\)\),\s*defaultWindowTintStrengthPercent,\s*0,\s*100\)/);
  assert.match(script, /--blended-addressbar-window-tint-background/);
  assert.match(script, /--blended-addressbar-frame-background/);
  assert.match(script, /const tintStrengthPercent = readWindowTintStrengthPercent\(\)/);
  assert.match(script, /const tintBackground = getWindowTintBackground\(bg,\s*tintStrengthPercent\)/);
  assert.match(script, /function getZenBrowserBackground\(/);
  assert.match(script, /function setWindowTintBackground\(/);
  assert.match(script, /function clearWindowTintBackground\(/);
  assert.match(script, /setStylePropertyIfChanged\(getZenBrowserBackground\(\)\?\.style,\s*'--blended-addressbar-window-tint-background',\s*tintBackground,\s*'important'\)/);
  assert.match(script, /getZenBrowserBackground\(\)\?\.style\.removeProperty\('--blended-addressbar-window-tint-background'\)/);
  assert.match(script, /setStylePropertyIfChanged\(root\.style,\s*'--blended-addressbar-frame-background',\s*tintBackground,\s*'important'\)/);
  assert.match(script, /data-blended-addressbar-native-theme-opacity', String\(tintStrengthPercent \/ 100\)/);
  assert.doesNotMatch(script, /setProperty\('--zen-primary-color'/);
  assert.doesNotMatch(script, /setProperty\('--zen-colors-primary'/);
  assert.doesNotMatch(script, /setProperty\('--zen-colors-secondary'/);
  assert.doesNotMatch(script, /setProperty\('--zen-colors-text-primary'/);
  assert.doesNotMatch(script, /setProperty\('--toolbox-textcolor'/);
  assert.doesNotMatch(script, /setAttribute\('zen-should-be-dark-mode'/);
  assert.doesNotMatch(script, /macosWindowMaterialPref/);
  assert.doesNotMatch(script, /getMacosWindowMaterialTheme/);
  assert.doesNotMatch(script, /--blended-addressbar-sidebar-page-color/);
  assert.match(css, /#zen-browser-background::before\s*\{[^}]*background:\s*linear-gradient\(var\(--blended-addressbar-window-tint-background,\s*transparent\),\s*var\(--blended-addressbar-window-tint-background,\s*transparent\)\),\s*var\(--zen-main-browser-background-old\)\s*!important/s);
  assert.match(css, /#zen-browser-background::after\s*\{[^}]*background:\s*linear-gradient\(var\(--blended-addressbar-window-tint-background,\s*transparent\),\s*var\(--blended-addressbar-window-tint-background,\s*transparent\)\),\s*var\(--zen-main-browser-background\)\s*!important/s);
  assert.doesNotMatch(css, /@media \(-moz-bool-pref: "uc\.blended-addressbar\.window-tint\.enabled"\)/);
  assert.doesNotMatch(css, /#zen-browser-background\s*\{[^}]*--zen-main-browser-background-old:/s);
  assert.doesNotMatch(css, /#zen-browser-background::before\s*\{[^}]*opacity:/s);
  assert.doesNotMatch(css, /#zen-browser-background::after\s*\{[^}]*opacity:/s);
  assert.match(css, /#zen-browser-background::before\s*\{[^}]*background-blend-mode:\s*normal\s*!important/s);
  assert.match(css, /#zen-browser-background::after\s*\{[^}]*background-blend-mode:\s*normal\s*!important/s);
  assert.match(css, /#zen-appcontent-wrapper\s*\{[^}]*background-color:\s*var\(--blended-addressbar-frame-background,\s*var\(--zen-main-browser-background\)\)/s);
  assert.match(prefs, /uc\.blended-addressbar\.window-tint\.enabled/);
  assert.match(prefs, /uc\.blended-addressbar\.window-tint\.strength/);
  assert.match(prefs, /Tint browser window with page colors/);
  assert.match(prefs, /Window tint strength \(%\)/);
  assert.match(prefs, /"defaultValue": "25"/);
  assert.doesNotMatch(prefs, /Custom Page Selector/);
  assert.doesNotMatch(prefs, /uc\.blended-addressbar\.selector-rule/);
  assert.doesNotMatch(prefs, /uc\.blended-addressbar\.sidebar\.enabled/);
  assert.doesNotMatch(prefs, /Blend sidebar with page colors/);
  assert.match(readme, /uc\.blended-addressbar\.window-tint\.enabled/);
  assert.match(readme, /uc\.blended-addressbar\.window-tint\.strength/);
  assert.match(readme, /tint the browser window with active page colors/);
});

test('adaptive header background and foreground use a short linear transition', () => {
  const css = read('style.css');

  assert.match(css, /--blended-addressbar-color-transition:\s*100ms linear/);
  assert.match(css, /#zen-appcontent-navbar-wrapper\s*\{[\s\S]*transition:\s*background-color var\(--blended-addressbar-color-transition\),\s*color var\(--blended-addressbar-color-transition\)/);
  assert.match(css, /transition:\s*color var\(--blended-addressbar-color-transition\),\s*fill var\(--blended-addressbar-color-transition\),\s*stroke var\(--blended-addressbar-color-transition\)/);
  assert.doesNotMatch(css, /\.tabbrowser-tab[\s\S]{0,160}transition:/);
});

test('split-pane and focus-ring treatments are absent from runtime and chrome CSS', () => {
  const script = read('blended-bar.uc.js');
  const css = read('style.css');

  assert.doesNotMatch(script, /splitPaneSelector/);
  assert.doesNotMatch(script, /updateSplitPaneTheme/);
  assert.doesNotMatch(script, /applySplitPaneTheme/);
  assert.doesNotMatch(css, /split-focus-ring/);
  assert.doesNotMatch(css, /outline:\s*var\(--blended-addressbar-split/);
  assert.doesNotMatch(css, /split-separator/);
  assert.doesNotMatch(css, /--blended-addressbar-split-pane-header-background/);
  assert.doesNotMatch(css, /--blended-addressbar-split-pane-header-foreground/);
  assert.doesNotMatch(css, /box-shadow:\s*var\(--blended-addressbar-frame-shadow\),\s*inset/);
});

test('browser panes round only corners that touch the outer browser frame', () => {
  const script = read('blended-bar.uc.js');
  const css = read('style.css');

  assert.match(script, /const paneCornerSelector = '#tabbrowser-tabpanels > \.browserSidebarContainer:not\(\.zen-glance-overlay\)'/);
  assert.match(script, /function updatePaneCornerRadii\(/);
  assert.match(script, /getBoundingClientRect\(\)/);
  assert.match(script, /const allowTopRadius = tabpanels\.getAttribute\('zen-split-view'\) === 'true'/);
  assert.match(script, /function hasPaneNeighborAtCorner\(/);
  assert.match(script, /const paneCornerNeighborSelector = `\$\{paneCornerSelector\}, #sidebar-box\[sidebar-panel-open\]:not\(\[hidden\]\)`/);
  assert.match(script, /const cornerNeighborRects = Array\.from\(chromeDoc\.querySelectorAll\(paneCornerNeighborSelector\)\)/);
  assert.match(script, /const sidebarBox = chromeDoc\.getElementById\('sidebar-box'\)/);
  assert.match(script, /const tabbox = chromeDoc\.getElementById\('tabbrowser-tabbox'\)/);
  assert.match(script, /const sidebarPanelOpen = !!sidebarBox\s+&& !sidebarBox\.hidden\s+&& sidebarBox\.hasAttribute\('sidebar-panel-open'\)/);
  assert.match(script, /const sidebarOnRight = sidebarPanelOpen\s+&& \(sidebarBox\.hasAttribute\('sidebar-positionend'\) \|\| tabbox\?\.hasAttribute\('sidebar-positionend'\)\)/);
  assert.match(script, /const sidebarBlocksLeftEdge = sidebarPanelOpen && !sidebarOnRight/);
  assert.match(script, /const sidebarBlocksRightEdge = sidebarPanelOpen && sidebarOnRight/);
  assert.match(script, /const paneCornerObserverRoot = chromeDoc\.getElementById\('tabbrowser-tabbox'\) \|\| tabpanels/);
  assert.match(script, /attributeFilter: \['class', 'style', 'zen-split-view', 'is-zen-split', 'zen-split', 'sidebar-panel-open', 'sidebar-positionend', 'checked'\]/);
  assert.match(script, /--blended-addressbar-split-radius-top-left/);
  assert.match(script, /--blended-addressbar-split-radius-top-right/);
  assert.match(script, /--blended-addressbar-split-radius-bottom-right/);
  assert.match(script, /--blended-addressbar-split-radius-bottom-left/);

  assert.match(css, /#tabbrowser-tabpanels\s*>\s*\.browserSidebarContainer:not\(\.zen-glance-overlay\)\s*\{/);
  assert.match(css, /--blended-addressbar-split-radius-top-left:\s*0px/);
  assert.match(css, /--blended-addressbar-split-radius-top-right:\s*0px/);
  assert.match(css, /--blended-addressbar-split-radius-bottom-right:\s*0px/);
  assert.match(css, /--blended-addressbar-split-radius-bottom-left:\s*0px/);
  assert.match(css, /--zen-native-inner-radius:\s*var\(--blended-addressbar-split-radius-top-left\)\s+var\(--blended-addressbar-split-radius-top-right\)\s+var\(--blended-addressbar-split-radius-bottom-right\)\s+var\(--blended-addressbar-split-radius-bottom-left\)\s*!important/);
  assert.doesNotMatch(css, /--zen-native-inner-radius:\s*0 0 var\(--blended-addressbar-inner-radius\) var\(--blended-addressbar-inner-radius\)/);

  assert.match(script, /--blended-addressbar-split-radius-top-left', allowTopRadius && touchesTop && touchesLeft && !sidebarBlocksLeftEdge && !hasPaneNeighborAtCorner\(cornerNeighborRects, pane, rect, 'top-left', tolerance\) \? radius : '0px'/);
  assert.match(script, /--blended-addressbar-split-radius-top-right', allowTopRadius && touchesTop && touchesRight && !sidebarBlocksRightEdge && !hasPaneNeighborAtCorner\(cornerNeighborRects, pane, rect, 'top-right', tolerance\) \? radius : '0px'/);
  assert.match(script, /--blended-addressbar-split-radius-bottom-right', touchesBottom && touchesRight && !sidebarBlocksRightEdge && !hasPaneNeighborAtCorner\(cornerNeighborRects, pane, rect, 'bottom-right', tolerance\) \? radius : '0px'/);
  assert.match(script, /--blended-addressbar-split-radius-bottom-left', touchesBottom && touchesLeft && !sidebarBlocksLeftEdge && !hasPaneNeighborAtCorner\(cornerNeighborRects, pane, rect, 'bottom-left', tolerance\) \? radius : '0px'/);
});

test('frame gap, remove-padding checkbox, and inner radius settings coexist', () => {
  const script = read('blended-bar.uc.js');
  const css = read('style.css');
  const prefs = read('preferences.json');

  assert.match(script, /const frameGapPref = `\$\{addressbarPrefBranch\}frame-gap`/);
  assert.match(script, /const framePaddingDisabledPref = `\$\{addressbarPrefBranch\}frame-padding\.disabled`/);
  assert.match(script, /readBoolPref\(framePaddingDisabledPref,\s*false\)\s*\?\s*'0px'\s*:\s*normalizeCssLength/);
  assert.match(css, /--blended-addressbar-inner-radius:\s*max\(0px,\s*calc\(var\(--blended-addressbar-frame-radius\) - var\(--blended-addressbar-frame-gap\)\)\)/);
  assert.match(prefs, /uc\.blended-addressbar\.frame-gap/);
  assert.match(prefs, /uc\.blended-addressbar\.frame-padding\.disabled/);
});

test('expanded sidebar toolbox keeps chrome icons vertically aligned', () => {
  const css = read('style.css');

  assert.match(css, /#navigator-toolbox\[zen-sidebar-expanded="true"\]\s*\{[^}]*padding-top:\s*2px\s*!important/s);
});

test('frame shadow is selected through constrained dropdown presets', () => {
  const css = read('style.css');
  const script = read('blended-bar.uc.js');
  const prefs = read('preferences.json');

  assert.match(script, /const frameShadowPref = `\$\{addressbarPrefBranch\}frame-shadow`/);
  assert.match(script, /function normalizeFrameShadowPreset\(/);
  assert.match(script, /data-blended-addressbar-frame-shadow/);
  assert.match(css, /--blended-addressbar-frame-shadow-standard:/);
  assert.match(css, /--blended-addressbar-frame-shadow-minimal:/);
  assert.match(css, /:root:not\(\[zen-should-be-dark-mode\]\)\s*\{[^}]*--blended-addressbar-frame-shadow-minimal:\s*0 0 0 1px rgba\(0,\s*0,\s*0,\s*0\.08\),\s*0 1px 2px rgba\(0,\s*0,\s*0,\s*0\.05\)/s);
  assert.match(css, /--blended-addressbar-frame-shadow-medium:/);
  assert.match(css, /\[data-blended-addressbar-frame-shadow="none"\]/);
  assert.match(css, /--blended-addressbar-frame-shadow:\s*none/);
  assert.match(prefs, /uc\.blended-addressbar\.frame-shadow/);
  assert.match(prefs, /"label": "No shadow"/);
  assert.match(prefs, /"label": "Standard"/);
  assert.match(prefs, /"label": "Minimal"/);
  assert.match(prefs, /"label": "Medium"/);
});

test('page color caching is always enabled while long-lived site colors remain optional', () => {
  const script = read('blended-bar.uc.js');
  const prefs = read('preferences.json');
  const readme = read('README.md');

  assert.doesNotMatch(script, /rememberPageColorsPref/);
  assert.match(script, /const rememberSiteColorsLongerPref = `\$\{addressbarPrefBranch\}remember-site-colors-longer`/);
  assert.match(script, /const siteThemeCachePref = `\$\{addressbarPrefBranch\}site-theme-cache`/);
  assert.match(script, /let themeCache = new WeakMap\(\)/);
  assert.match(script, /let pageThemeCache = new Map\(\)/);
  assert.match(script, /let hostThemeCache = new Map\(\)/);
  assert.doesNotMatch(script, /function readRememberPageColors\(\)/);
  assert.match(script, /function readRememberSiteColorsLonger\(\)/);
  assert.match(script, /return readBoolPref\(rememberSiteColorsLongerPref,\s*true\)/);
  assert.match(script, /function getThemeHostKey\(href\)/);
  assert.match(script, /function cachePageTheme\(theme,\s*href\)/);
  assert.match(script, /function getCachedPageTheme\(browser\)/);
  assert.match(script, /function getCachedTargetTheme\(browser\)/);
  assert.match(script, /return getCachedTargetTheme\(browser\) \|\| getCachedHostTheme\(browser\)/);
  assert.match(script, /function getCachedHostTheme\(browser\)/);
  assert.match(script, /source:\s*'host-cache'/);
  assert.match(script, /function persistHostThemeCache\(\)/);
  assert.match(script, /writeStringPref\(siteThemeCachePref/);
  assert.match(script, /function clearHostThemeCache\(reason = 'clear-cache'\)/);
  assert.match(script, /clearUserPref\(siteThemeCachePref\)/);
  assert.doesNotMatch(script, /page-cache-disabled/);
  assert.doesNotMatch(script, /page-cache-enabled/);
  assert.match(script, /if \(changedPref === rememberSiteColorsLongerPref && !readRememberSiteColorsLonger\(\)\)/);
  assert.doesNotMatch(script, /clearCacheRequestPref/);
  assert.doesNotMatch(script, /clear-cache-request/);
  assert.doesNotMatch(prefs, /uc\.blended-addressbar\.remember-page-colors/);
  assert.doesNotMatch(prefs, /Remember page colors while browsing/);
  assert.match(prefs, /uc\.blended-addressbar\.remember-site-colors-longer/);
  assert.match(prefs, /Remember site colors longer/);
  assert.match(prefs, /"defaultValue": true/);
  assert.doesNotMatch(prefs, /uc\.blended-addressbar\.clear-cache-request/);
  assert.doesNotMatch(prefs, /Clear cached page colors/);
  assert.doesNotMatch(readme, /uc\.blended-addressbar\.remember-page-colors/);
  assert.match(readme, /Page colors are always remembered in memory while browsing/);
  assert.match(readme, /uc\.blended-addressbar\.remember-site-colors-longer/);
  assert.match(readme, /defaults on/);
  assert.doesNotMatch(readme, /uc\.blended-addressbar\.clear-cache-request/);
});

test('long-lived host color cache is a fallback instead of the first tab-switch paint', () => {
  const script = read('blended-bar.uc.js');

  assert.match(script, /const targetCachedTheme = getCachedTargetTheme\(browser\)/);
  assert.match(script, /const cachedTheme = targetCachedTheme \|\| getCachedHostTheme\(browser\)/);
  assert.match(script, /const cachedThemeIsHost = cachedTheme\?\.source === 'host-cache'/);
  assert.match(script, /if \(targetCachedTheme\) \{\s*applyResolvedTheme\(browser,\s*targetCachedTheme,\s*'target-cache',\s*expectedHref,\s*\{[\s\S]*requireRendered:\s*zenBoostActive[\s\S]*\}\);\s*\}/s);
  assert.doesNotMatch(script, /if \(cachedTheme\) \{\s*applyResolvedTheme\(browser,\s*cachedTheme,\s*'cache',\s*expectedHref\);\s*\}\s*const fastTheme = getBrowserPageThemeFromChrome\(browser\)/s);
  assert.match(script, /if \(pageTheme\?\.bg\) \{\s*applyResolvedTheme\(browser,\s*pageTheme,\s*reason,\s*expectedHref,\s*\{[\s\S]*deferNonVisual:\s*true[\s\S]*requireRendered:\s*zenBoostActive[\s\S]*\}\);\s*\} else if \(cachedThemeIsHost\) \{\s*applyResolvedTheme\(browser,\s*cachedTheme,\s*'host-cache',\s*expectedHref,\s*\{[\s\S]*requireRendered:\s*zenBoostActive[\s\S]*\}\);\s*\}/s);
});

test('target tab cached colors apply before same-host retained fallbacks', () => {
  const script = read('blended-bar.uc.js');

  assert.match(script, /function getCachedTargetTheme\(browser\)/);
  assert.match(script, /return getCachedPageTheme\(browser\)/);
  assert.match(script, /const targetCachedTheme = getCachedTargetTheme\(browser\)/);
  assert.match(script, /const retainedHostTheme = targetCachedTheme \? null : getSameHostRetainedTheme\(cachedTheme,\s*expectedHref\)/);
  assert.match(script, /if \(targetCachedTheme\) \{\s*applyResolvedTheme\(browser,\s*targetCachedTheme,\s*'target-cache'/s);
  assert.match(script, /if \(targetCachedTheme\)[\s\S]*if \(retainedHostTheme\)/);
});

test('early tab-switch themes keep a stable foreground while samples catch up', () => {
  const script = read('blended-bar.uc.js');

  assert.match(script, /function withStableForeground\(theme,\s*fallbackTheme = lastAppliedTheme\)/);
  assert.match(script, /if \(hasVisibleColor\(theme\?\.fg\)\) return theme/);
  assert.match(script, /getReadableForeground\(theme\.bg,\s*\[\s*fallbackTheme\?\.fg/);
  assert.match(script, /const foregroundTheme = withStableForeground\(theme\)/);
  assert.match(script, /const visibleTheme = hasVisibleColor\(foregroundTheme\.bg\)\s*\?\s*foregroundTheme/);
  assert.doesNotMatch(script, /const visibleTheme = hasVisibleColor\(theme\.bg\)\s*\?\s*theme/);
});

test('same-host tab switches retain host color while unloaded tabs restore', () => {
  const script = read('blended-bar.uc.js');

  assert.match(script, /function getSameHostRetainedTheme\(cachedTheme,\s*expectedHref\)/);
  assert.match(script, /const expectedHost = getThemeHostKey\(expectedHref\)/);
  assert.match(script, /const previousHost = getThemeHostKey\(lastAppliedTheme\?\.href\)/);
  assert.match(script, /if \(previousHost !== expectedHost\) return null/);
  assert.match(script, /cachedSource:\s*retainedTheme\.source \|\| ''/);
  assert.match(script, /const retainedHostTheme = targetCachedTheme \? null : getSameHostRetainedTheme\(cachedTheme,\s*expectedHref\)/);
  assert.match(script, /if \(retainedHostTheme\) \{\s*applyResolvedTheme\(browser,\s*retainedHostTheme,\s*'same-host-retained',\s*expectedHref,\s*\{[\s\S]*requireRendered:\s*zenBoostActive[\s\S]*\}\);\s*\}/s);
  assert.match(script, /if \(isLoadingThemeFor\(browser\) && !cachedTheme && !retainedHostTheme\)/);
  assert.match(script, /else if \(!cachedTheme && !retainedHostTheme && !skipToolbarFallback\)/);
  assert.match(script, /else if \(!retainedHostTheme && !skipToolbarFallback\)/);
});

test('same effective tab theme updates are no-ops to avoid tab-switch blink', () => {
  const script = read('blended-bar.uc.js');

  assert.match(script, /function setStylePropertyIfChanged\(style,\s*name,\s*value,\s*priority = ''\)/);
  assert.match(script, /function removeStylePropertyIfChanged\(style,\s*name\)/);
  assert.match(script, /function normalizeThemeColorForKey\(value\)/);
  assert.match(script, /return `rgba\(\$\{rgb\.r\},\$\{rgb\.g\},\$\{rgb\.b\},\$\{alpha\}\)`/);
  assert.match(script, /function getThemeKey\(theme\) \{\s*return `\$\{normalizeThemeColorForKey\(theme\?\.bg\)\}\|\$\{normalizeThemeColorForKey\(theme\?\.fg\)\}`;\s*\}/);
  assert.match(script, /function setVar\(value,\s*foreground\)[\s\S]*setStylePropertyIfChanged\(rootStyle,\s*'--zen-tab-header-background'/);
  assert.match(script, /function setWindowTintBackground\(tintBackground,[\s\S]*setStylePropertyIfChanged\(root\.style,\s*'--blended-addressbar-window-tint-background'/);
  assert.match(script, /setStylePropertyIfChanged\(root\.style,\s*'--blended-addressbar-frame-background',\s*tintBackground,\s*'important'\)/);
  assert.match(script, /if \(key === lastThemeKey\) \{\s*lastAppliedTheme = theme;\s*return true;\s*\}/);
  assert.match(script, /if \(key === lastThemeKey && getCurrentFrameBackground\(\) === 'transparent'\) \{\s*lastAppliedTheme = theme;\s*return true;\s*\}/);
  assert.doesNotMatch(script, /const key = getThemeKey\(theme\);\s*chromeDoc\.documentElement\.style\.setProperty\('--blended-addressbar-frame-background',\s*'transparent',\s*'important'\);\s*if \(key === lastThemeKey\)/);
});

test('page theme cache uses bounded origin-path LRU entries before host fallback', () => {
  const script = read('blended-bar.uc.js');

  assert.match(script, /const pageThemeCacheMaxEntries = 500/);
  assert.match(script, /let pageThemeCache = new Map\(\)/);
  assert.match(script, /function getThemePageKey\(href\)/);
  assert.match(script, /return `\$\{url\.origin\}\$\{url\.pathname\}`/);
  assert.match(script, /function cachePageTheme\(theme,\s*href\)/);
  assert.match(script, /while \(pageThemeCache\.size > pageThemeCacheMaxEntries\)/);
  assert.match(script, /pageThemeCache\.delete\(pageThemeCache\.keys\(\)\.next\(\)\.value\)/);
  assert.match(script, /function getCachedPageTheme\(browser\)/);
  assert.match(script, /pageThemeCache\.delete\(key\);\s*pageThemeCache\.set\(key,\s*entry\)/s);
  assert.match(script, /function getCachedTargetTheme\(browser\)/);
  assert.match(script, /return getCachedTargetTheme\(browser\) \|\| getCachedHostTheme\(browser\)/);
  assert.match(script, /pageThemeCache = new Map\(\)/);
});

test('active page theme updates are coalesced before sampling work runs', () => {
  const script = read('blended-bar.uc.js');

  assert.match(script, /const scheduleSafetyMs = 100/);
  assert.match(script, /let scheduledActiveUpdate = false/);
  assert.match(script, /function mergeActiveUpdateOptions\(/);
  assert.match(script, /function scheduleActiveUpdate\(options = \{\}\)/);
  assert.match(script, /requestAnimationFrame\(run\)/);
  assert.match(script, /setTimeout\(run,\s*scheduleSafetyMs\)/);
  assert.match(script, /cancelAnimationFrame\(scheduledActiveUpdateRaf\)/);
  assert.match(script, /gBrowser\.tabContainer\.addEventListener\('TabSelect', \(\) => \{[^}]*scheduleActiveUpdate\(\{ reason: 'tab-select', keepCachedTheme: true \}\)/s);
  assert.match(script, /scheduleActiveUpdate\(options\)/);
});

test('persistent frame bridge samples rendered page pixels and observes theme mutations', () => {
  const script = read('blended-bar.uc.js');
  const frame = read('frame.js');

  assert.match(script, /const themeFrameScriptUrl = 'chrome:\/\/sine\/content\/blended-addressbar\/frame\.js'/);
  assert.match(script, /const persistentThemeMessageName = 'blended-addressbar:persistent-theme'/);
  assert.match(script, /let persistentThemeListeners = new WeakMap\(\)/);
  assert.match(script, /function attachPersistentThemeListener\(browser\)/);
  assert.match(script, /function detachPersistentThemeListener\(browser\)/);
  assert.match(script, /function requestPersistentFrameTheme\(browser,\s*forceFresh = false\)/);
  assert.match(script, /messageManager\.loadFrameScript\(themeFrameScriptUrl,\s*false\)/);
  assert.match(script, /requestPersistentFrameTheme\(browser,\s*zenBoostActive \|\| !cachedTheme\)/);
  assert.match(script, /gBrowser\.tabContainer\.addEventListener\('TabClose'/);

  assert.match(frame, /const MESSAGE_NAME = 'blended-addressbar:persistent-theme'/);
  assert.match(frame, /content\.__blended_addressbar_frame_inited/);
  assert.match(frame, /const PIXEL_SAMPLE_SIZE = 3/);
  assert.match(frame, /function normalizeColor\(color\)/);
  assert.match(frame, /function readTopEdgePixel\(/);
  assert.match(frame, /pixelCtx\.drawWindow\(/);
  assert.match(frame, /sendAsyncMessage\(MESSAGE_NAME/);
  assert.match(frame, /const THEME_ATTRS = \[/);
  assert.match(frame, /new content\.MutationObserver\(debouncedSample\)/);
  assert.match(frame, /content\.addEventListener\('pageshow',\s*rescheduleLoad/);
});

test('persistent frame bridge does not resample colors while scrolling', () => {
  const frame = read('frame.js');

  assert.doesNotMatch(frame, /SCROLL_SAMPLE_MIN_MS/);
  assert.doesNotMatch(frame, /SCROLL_SETTLE_MS/);
  assert.doesNotMatch(frame, /scrollSampleRaf/);
  assert.doesNotMatch(frame, /scrollSettleTimer/);
  assert.doesNotMatch(frame, /lastScrollSampleAt/);
  assert.doesNotMatch(frame, /function scheduleScrollSample\(\)/);
  assert.doesNotMatch(frame, /addEventListener\('scroll'/);
});

test('cached tab switches do not force a fresh page sample immediately', () => {
  const script = read('blended-bar.uc.js');

  assert.match(script, /gBrowser\.tabContainer\.addEventListener\('TabSelect', \(\) => \{[^}]*scheduleActiveUpdate\(\{ reason: 'tab-select', keepCachedTheme: true \}\)/s);
  assert.match(script, /keepCachedTheme = false/);
  assert.match(script, /const hasStableCachedTabTheme = keepCachedTheme\s+&& !zenBoostActive\s+&& !!\(targetCachedTheme \|\| retainedHostTheme\)/);
  assert.match(script, /if \(hasStableCachedTabTheme\) return/);
  assert.match(script, /if \(zenBoostActive\) requestPersistentFrameTheme\(browser,\s*true\)/);
  assert.match(script, /requestPersistentFrameTheme\(browser,\s*zenBoostActive \|\| !cachedTheme\)/);
});

test('color source policies are centralized before candidate arbitration', () => {
  const script = read('blended-bar.uc.js');

  assert.match(script, /const colorSourcePolicies = Object\.freeze\(\{/);
  assert.match(script, /'theme-color': Object\.freeze\(\{ sourceClass: 'semantic', rendered: false, confidence: 7, preferred: true \}\)/);
  assert.match(script, /'dark-reader': Object\.freeze\(\{ sourceClass: 'visual', rendered: true, confidence: 5, modifier: true \}\)/);
  assert.match(script, /function getColorSourcePolicy\(themeOrSource\)/);
  assert.match(script, /function createResolveContext\(browser,\s*options = \{\}\)/);
  assert.match(script, /boostActive: options\.boostActive \?\? isZenBoostActive\(\)/);
  assert.match(script, /phase: options\.phase \|\| \(loading \? 'loading' : 'settled'\)/);
  assert.match(script, /const resolveContext = createResolveContext\(browser,\s*options\)/);
  assert.match(script, /shouldApplyThemeCandidate\(visibleTheme,\s*resolveContext\)/);
  assert.match(script, /function shouldSkipFastLoadingTheme\(theme,\s*resolveContext\)/);
  assert.match(script, /shouldSkipFastLoadingTheme\(fastTheme,\s*createResolveContext\(browser,\s*\{/);
});

test('post-load semantic fallbacks wait for rendered samples to avoid Zen Boost color flicker', () => {
  const script = read('blended-bar.uc.js');

  assert.match(script, /const visualThemeSettleDelayMs = 180/);
  assert.match(script, /function isRenderedThemeSource\(source\)/);
  assert.match(script, /function isPreferredSemanticThemeSource\(source\)/);
  assert.match(script, /getColorSourcePolicy\(sourceName\)\.rendered/);
  assert.match(script, /return getColorSourcePolicy\(source\)\.preferred === true/);
  assert.match(script, /'theme-color': Object\.freeze\(\{ sourceClass: 'semantic', rendered: false, confidence: 7, preferred: true \}\)/);
  assert.match(script, /deferNonVisual = false/);
  assert.match(script, /const deferForVisualSample = deferNonVisual\s+&& !replacingHostCache\s+&& !isRenderedThemeSource\(source\)/);
  assert.match(script, /queueStableThemeCandidate\(browser,\s*visibleTheme,\s*reason,\s*expectedHref,\s*decision,\s*resolveContext\)/);
  assert.match(script, /stableDelay:\s*visualThemeSettleDelayMs/);
  assert.match(script, /const skipLoadingSemanticFastTheme = shouldSkipFastLoadingTheme\(fastTheme,\s*createResolveContext\(browser,\s*\{/);
  assert.match(script, /function shouldSkipFastLoadingTheme\(theme,\s*resolveContext\)[\s\S]*!isRenderedThemeSource\(theme\.source\)[\s\S]*!isPreferredSemanticThemeSource\(theme\.source\)/);
  assert.doesNotMatch(script, /const skipLoadingSemanticFastTheme = fastOnly\s*&& isLoadingThemeFor\(browser\)\s*&& !isRenderedThemeSource\(fastTheme\.source\);/);
  assert.match(script, /if \(!skipLoadingSemanticFastTheme\) \{\s*applyResolvedTheme\(browser,\s*fastTheme,/);
  assert.match(script, /applyResolvedTheme\(browser,\s*fastTheme,[\s\S]*deferNonVisual:\s*zenBoostActive \|\| !fastOnly[\s\S]*stableDelay:\s*visualThemeSettleDelayMs/s);
  assert.match(script, /applyResolvedTheme\(browser,\s*pageTheme,[\s\S]*deferNonVisual:\s*true[\s\S]*requireRendered:\s*zenBoostActive[\s\S]*stableDelay:\s*visualThemeSettleDelayMs/s);
});

test('Zen Boost active state requires rendered color sources and fresh samples', () => {
  const script = read('blended-bar.uc.js');

  assert.match(script, /let zenBoostMutationObserver = null/);
  assert.match(script, /let lastZenBoostActive = false/);
  assert.match(script, /function isZenBoostActive\(\)/);
  assert.match(script, /getElementById\('zen-site-data-icon-button'\)\?\.hasAttribute\('boosting'\)/);
  assert.match(script, /function clearActivePageThemeCache\(browser = gBrowser\?\.selectedBrowser \|\| null\)/);
  assert.match(script, /themeCache\.delete\(browser\)/);
  assert.match(script, /pageThemeCache\.delete\(pageKey\)/);
  assert.match(script, /hostThemeCache\.delete\(hostKey\)/);
  assert.match(script, /persistHostThemeCache\(\)/);
  assert.match(script, /function handleZenBoostStateChange\(\)/);
  assert.match(script, /requestPersistentFrameTheme\(browser,\s*true\)/);
  assert.match(script, /scheduleActiveUpdate\(\{ reason: 'zen-boost-change', skipToolbarFallback: true \}\)/);
  assert.match(script, /function observeZenBoostState\(\)/);
  assert.match(script, /zenBoostMutationObserver = new MutationObserver\(handleZenBoostStateChange\)/);
  assert.match(script, /attributeFilter:\s*\['boosting'\]/);
  assert.match(script, /observeZenBoostState\(\)/);
  assert.match(script, /if \(zenBoostMutationObserver\) zenBoostMutationObserver\.disconnect\(\)/);
  assert.match(script, /requireRendered = false/);
  assert.match(script, /const requireRenderedTheme = requireRendered\s+&& !isRenderedThemeSource\(theme\)/);
  assert.match(script, /if \(requireRenderedTheme\) \{\s*return \{ action: 'ignore', confidence, key \};\s*\}/);
  assert.match(script, /requireRendered:\s*options\.requireRendered \?\? \(options\.boostActive \?\? isZenBoostActive\(\)\)/);
  assert.match(script, /return sourceName === 'host-cache' && getColorSourcePolicy\(getCachedColorSourceName\(source\)\)\.rendered/);
  assert.match(script, /const zenBoostActive = isZenBoostActive\(\)/);
  assert.match(script, /if \(zenBoostActive\) requestPersistentFrameTheme\(browser,\s*true\)/);
  assert.match(script, /requestPersistentFrameTheme\(browser,\s*zenBoostActive \|\| !cachedTheme\)/);
});

test('navigation and color-scheme hooks avoid stale or redundant page samples', () => {
  const script = read('blended-bar.uc.js');

  assert.match(script, /LOCATION_CHANGE_SAME_DOCUMENT/);
  assert.match(script, /if \(flags & sameDocumentFlag\) return/);
  assert.match(script, /window\.matchMedia\('\(prefers-color-scheme: dark\)'\)/);
  assert.match(script, /clearThemeCache\('color-scheme-change'\)/);
  assert.match(script, /scheduleActiveUpdate\(\{ reason: 'color-scheme-change' \}\)/);
});

test('README credits zen-page-tint for borrowed implementation ideas', () => {
  const readme = read('README.md');

  assert.match(readme, /caezium\/zen-page-tint/);
  assert.match(readme, /requestAnimationFrame/);
  assert.match(readme, /persistent content sampler/);
});

test('internal browser pages use a translucent page-canvas header instead of stale web colors', () => {
  const script = read('blended-bar.uc.js');

  assert.match(script, /function isPageThemeEligibleHref\(href\)/);
  assert.match(script, /return \/\^\(https\?\|file\):\/i\.test\(String\(href \|\| ''\)\)/);
  assert.match(script, /const internalPageHeaderOpacity = 0\.72/);
  assert.match(script, /function isInternalPageThemeHref\(href\)/);
  assert.match(script, /return \/\^\(about\|chrome\):\/i\.test\(String\(href \|\| ''\)\)/);
  assert.match(script, /function getInternalPageTheme\(browser\)/);
  assert.match(script, /getDocumentCanvasTheme\(doc,\s*view\)/);
  assert.match(script, /source:\s*'internal-page'/);
  assert.match(script, /function applyInternalPageTheme\(browser,\s*reason = 'internal-page'\)/);
  assert.match(script, /lastAppliedTheme\?\.source === 'internal-page' && lastAppliedTheme\?\.href === href \? lastAppliedTheme : null/);
  assert.match(script, /const key = getThemeKey\(theme\);\s*if \(key === lastThemeKey\) \{\s*lastAppliedTheme = theme;\s*return true;\s*\}/);
  assert.match(script, /setVar\(theme\.bg,\s*theme\.fg\)/);
  assert.match(script, /if \(!isPageThemeEligibleHref\(expectedHref\)\) \{\s*if \(applyInternalPageTheme\(browser,\s*'internal-page'\)\) return;\s*clearAdaptivePageTheme\('ineligible-url'\);\s*return;\s*\}/s);
  assert.match(script, /function clearAdaptivePageTheme\(reason = 'ineligible-url'\)/);
  assert.match(script, /clearTabHeaderTheme\(\)/);
  assert.match(script, /restoreNativeZenTheme\(\)/);
  assert.match(script, /clearWindowTintBackground\(\)/);
  assert.match(script, /removeProperty\('--blended-addressbar-frame-background'\)/);
  assert.match(script, /setPageLoadbarColors\(null\)/);
});

test('unknown page colors use a translucent neutral header without native window tint', () => {
  const script = read('blended-bar.uc.js');

  assert.match(script, /const unknownPageHeaderOpacity = 0\.1/);
  assert.match(script, /function getNeutralHeaderShade\(browser,\s*source = 'unknown-page'\)/);
  assert.match(script, /rgbaToCss\(shade\)/);
  assert.match(script, /fg:\s*normalizedScheme === 'light' \? 'rgba\(11,\s*13,\s*16,\s*0\.82\)' : 'rgba\(245,\s*247,\s*251,\s*0\.90\)'/);
  assert.match(script, /function applyHeaderOnlyTheme\(browser,\s*theme,\s*reason = 'header-only'\)/);
  assert.match(script, /function applyHeaderOnlyTheme\(browser,\s*theme,\s*reason = 'header-only'\)[\s\S]*const key = getThemeKey\(theme\);\s*if \(key === lastThemeKey && getCurrentFrameBackground\(\) === 'transparent'\) \{\s*lastAppliedTheme = theme;\s*return true;\s*\}/);
  assert.match(script, /setVar\(theme\.bg,\s*theme\.fg\)/);
  assert.match(script, /clearWindowTintBackground\(\)/);
  assert.match(script, /setStylePropertyIfChanged\(chromeDoc\.documentElement\.style,\s*'--blended-addressbar-frame-background',\s*'transparent',\s*'important'\)/);
  assert.match(script, /if \(isLoadingThemeFor\(browser\) && !cachedTheme && !retainedHostTheme\) \{\s*applyHeaderOnlyTheme\(browser,\s*getNeutralHeaderShade\(browser,\s*'loading-unknown'\),\s*'loading-unknown'\);\s*return;\s*\}/s);
  assert.match(script, /applyHeaderOnlyTheme\(browser,\s*getNeutralHeaderShade\(browser,\s*'unknown-page'\),\s*'unknown-page'\)/);
  assert.match(script, /applyHeaderOnlyTheme\(browser,\s*getNeutralHeaderShade\(browser,\s*'unknown-page'\),\s*reason\)/);
});

test('adaptive foreground feeds only Zen omnibox input text color', () => {
  const css = read('style.css');
  const inputBoxBlock = cssRuleBlock(css, '#urlbar:not([zen-floating-urlbar="true"]) .urlbar-input-box');

  assert.match(css, /#urlbar:not\(\[zen-floating-urlbar="true"\]\)\s*\{[^}]*--toolbar-field-color:\s*var\(--zen-tab-header-foreground,\s*currentColor\)/s);
  assert.match(css, /#urlbar:not\(\[zen-floating-urlbar="true"\]\)\s*\{[^}]*--input-color:\s*var\(--zen-tab-header-foreground,\s*currentColor\)/s);
  assert.match(inputBoxBlock, /--input-color:\s*var\(--zen-tab-header-foreground,\s*currentColor\)/);
  assert.match(inputBoxBlock, /color:\s*var\(--zen-tab-header-foreground,\s*inherit\)/);
  assert.match(css, /#urlbar:not\(\[zen-floating-urlbar="true"\]\):is\(\[focused\],\s*\[open\],\s*\[breakout-extend="true"\]\) #urlbar-input\s*\{[^}]*color:\s*FieldText\s*!important[^}]*--input-color:\s*FieldText/s);
  assert.match(css, /#urlbar:not\(\[zen-floating-urlbar="true"\]\)\[breakout\]\[breakout-extend\]\s*\{[^}]*top:\s*2px\s*!important/s);
  assert.match(css, /#urlbar:not\(\[zen-floating-urlbar="true"\]\)\[breakout\]\[breakout-extend\]\s*>\s*\.urlbar-input-container\s*\{[^}]*height:\s*calc\(var\(--urlbar-container-height\) - 10px\)\s*!important/s);
  assert.match(css, /#urlbar:not\(\[zen-floating-urlbar="true"\]\) #urlbar-input::selection\s*\{[^}]*background-color:\s*SelectedItem\s*!important[^}]*color:\s*SelectedItemText\s*!important/s);
  assert.match(css, /--blended-addressbar-header-muted-foreground:\s*color-mix\(in srgb,\s*var\(--zen-tab-header-foreground,\s*currentColor\)\s*42%,\s*transparent\)/);
  assert.match(css, /#urlbar:not\(\[zen-floating-urlbar="true"\]\) #urlbar-input-container :is\(\.urlbar-page-action,\s*\.identity-box-button,\s*\.urlbar-icon\)/);
  assert.match(css, /#urlbar:not\(\[zen-floating-urlbar="true"\]\) #zen-site-data-icon-button\[boosting\] image\s*\{[^}]*color:\s*var\(--zen-tab-header-foreground,\s*currentColor\)\s*!important/s);
  assert.match(css, /#urlbar:not\(\[zen-floating-urlbar="true"\]\) #zen-site-data-icon-button\[boosting\] image\s*\{[^}]*--toolbarbutton-icon-fill:\s*currentColor/s);
  assert.doesNotMatch(css, /#urlbar\[zen-floating-urlbar="true"\]\s+#urlbar-input/);
  assert.match(css, /\.titlebar-buttonbox-container :is\(toolbarbutton,\s*\.toolbarbutton-1,\s*\.toolbarbutton-icon,\s*\.titlebar-button\)/);
  assert.match(css, /#personal-bookmarks,\s*[\r\n]+\s*#personal-bookmarks\.browser-toolbar/);
  assert.match(css, /#PersonalToolbar :is\(#personal-bookmarks,\s*\.browser-toolbar\)/);
  assert.match(css, /#PersonalToolbar :is\(toolbarbutton,\s*\.toolbarbutton-1,\s*\.toolbarbutton-icon,\s*\.toolbarbutton-text,\s*\.bookmark-item\)/);
  assert.match(css, /--toolbar-color:\s*var\(--zen-tab-header-foreground,\s*currentColor\)/);
  assert.match(css, /#nav-bar-customization-target > :not\(#urlbar-container\):not\(#urlbar\[zen-floating-urlbar="true"\]\)/);
  assert.match(css, /#nav-bar-customization-target > :not\(#urlbar-container\):not\(#urlbar\[zen-floating-urlbar="true"\]\) :is\(\[disabled\],\s*\[disabled="true"\],\s*\[muted\],\s*\[soundplaying\],\s*\.toolbarbutton-icon\[disabled\]\)/);
  assert.doesNotMatch(css, /#nav-bar-customization-target,\s*[\r\n]+\s*#PersonalToolbar/);
  assert.doesNotMatch(css, /#urlbar-input-container\s*\{[^}]*--input-color:\s*var\(--zen-tab-header-foreground/s);
  assert.doesNotMatch(css, /#urlbar\s*\{[^}]*--input-color:\s*var\(--zen-tab-header-foreground/s);
  assert.doesNotMatch(css, /#nav-bar-customization-target > :not\(#urlbar-container\),/);
});
