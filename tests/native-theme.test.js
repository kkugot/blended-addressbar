const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = join(__dirname, '..');

function read(name) {
  return readFileSync(join(root, name), 'utf8');
}

function readStyleWithImports(name = 'style.css') {
  return read(name).replace(/^@import "([^"]+)";\s*$/gm, (_, path) => read(path));
}

function loadScriptModule(name, options = {}) {
  const context = {
    BlendedAddressbarModuleOptions: options,
    URL,
    console
  };
  vm.createContext(context);
  vm.runInContext(read(`scripts/${name}`), context, {
    filename: join(root, 'scripts', name)
  });
  return context.BlendedAddressbarModule;
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

function cssRuleBlockOccurrence(css, selector, occurrence) {
  let selectorIndex = -1;
  let searchStart = 0;
  for (let index = 0; index <= occurrence; index += 1) {
    selectorIndex = css.indexOf(selector, searchStart);
    assert.notEqual(selectorIndex, -1, `missing selector occurrence ${occurrence}: ${selector}`);
    searchStart = selectorIndex + selector.length;
  }
  const openIndex = css.indexOf('{', selectorIndex);
  assert.notEqual(openIndex, -1, `missing opening brace for selector occurrence ${occurrence}: ${selector}`);
  const closeIndex = css.indexOf('}', openIndex);
  assert.notEqual(closeIndex, -1, `missing closing brace for selector occurrence ${occurrence}: ${selector}`);
  return css.slice(openIndex + 1, closeIndex);
}

function cssSelectorPrelude(css, selectorStart) {
  const selectorIndex = css.indexOf(selectorStart);
  assert.notEqual(selectorIndex, -1, `missing selector start: ${selectorStart}`);
  const openIndex = css.indexOf('{', selectorIndex);
  assert.notEqual(openIndex, -1, `missing opening brace after selector start: ${selectorStart}`);
  return css.slice(selectorIndex, openIndex);
}

function countOccurrences(value, needle) {
  return value.split(needle).length - 1;
}

test('release metadata stays synchronized at version 1.7.18', () => {
  const theme = JSON.parse(read('theme.json'));
  const script = read('blended-bar.uc.js');
  const marketplace = read('MARKETPLACE.md');
  const changelog = read('CHANGELOG.md');

  assert.equal(theme.version, '1.7.18');
  assert.equal(theme.updatedAt, '2026-09-25');
  assert.equal(theme.image, 'https://raw.githubusercontent.com/kkugot/blended-addressbar/main/marketplace-preview.png');
  assert.match(script, /\/\/ @version\s+1\.7\.18/);
  assert.match(marketplace, /Version: `1\.7\.18`/);
  assert.match(marketplace, /"version": "1\.7\.18"/);
  assert.match(marketplace, /"updatedAt": "2026-09-25"/);
  assert.match(changelog, /## 1\.7\.18 - 2026-09-25/);
});

test('browser window tint bridges page colors through native Zen window theme variables', () => {
  const script = read('blended-bar.uc.js');
  const css = read('style.css');
  const prefs = read('preferences.json');
  const readme = read('README.md');

  assert.match(script, /const windowTintEnabledPref = `\$\{addressbarPrefBranch\}window-tint\.enabled`/);
  assert.match(script, /const windowTintStrengthPref = `\$\{addressbarPrefBranch\}window-tint\.strength`/);
  assert.match(script, /function readWindowTintEnabled\(/);
  assert.doesNotMatch(script, /legacySidebarEnabledPref/);
  assert.doesNotMatch(script, /sidebar\.enabled/);
  assert.doesNotMatch(script, /function migrateWindowTintPref\(/);
  assert.match(script, /changedPref !== windowTintEnabledPref/);
  assert.match(script, /changedPref !== windowTintStrengthPref/);
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
  assert.doesNotMatch(script, /selectorRulePref/);
  assert.doesNotMatch(script, /selector-rule/);
  assert.doesNotMatch(script, /getSelectorRuleTheme/);
  assert.doesNotMatch(script, /parseSelectorRule/);
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

test('chrome script loads focused helper modules from one manifest entrypoint', () => {
  const script = read('blended-bar.uc.js');
  const theme = read('theme.json');
  const styleState = read('scripts/style-state.js');
  const colorUtils = read('scripts/color-utils.js');
  const prefs = read('scripts/prefs.js');
  const paneLayout = read('scripts/pane-layout.js');
  const sourcePolicy = read('scripts/theme-source-policy.js');

  assert.match(theme, /"scripts":\s*\{\s*"blended-bar\.uc\.js"/);
  assert.match(script, /const scriptModuleBaseUrl = 'chrome:\/\/sine\/content\/blended-addressbar\/scripts\/'/);
  assert.match(script, /function loadBlendedAddressbarModule\(filename,\s*options = \{\}\)/);
  assert.match(script, /loadBlendedAddressbarModule\('style-state\.js'\)/);
  assert.match(script, /loadBlendedAddressbarModule\('color-utils\.js'/);
  assert.match(script, /loadBlendedAddressbarModule\('prefs\.js'/);
  assert.match(script, /loadBlendedAddressbarModule\('pane-layout\.js'/);
  assert.match(script, /loadBlendedAddressbarModule\('theme-source-policy\.js'\)/);
  assert.match(styleState, /function setStylePropertyIfChanged\(style,\s*name,\s*value,\s*priority = ''\)/);
  assert.match(styleState, /function removeStylePropertyIfChanged\(style,\s*name\)/);
  assert.match(colorUtils, /function parseCssRgb\(input\)/);
  assert.match(colorUtils, /function getReadableForeground\(bg,\s*candidates = \[\]\)/);
  assert.match(prefs, /function readStringPref\(name,\s*fallback\)/);
  assert.match(prefs, /function normalizeCssLength\(value,\s*fallback\)/);
  assert.match(paneLayout, /function updatePaneCornerRadii\(\)/);
  assert.match(paneLayout, /function cleanupPaneCornerRadii\(\)/);
  assert.match(sourcePolicy, /const colorSourcePolicies = Object\.freeze\(\{/);
  assert.match(sourcePolicy, /function getThemeSourceConfidence\(themeOrSource\)/);
  assert.doesNotMatch(script, /function parseCssRgb\(input\)/);
  assert.doesNotMatch(script, /function setStylePropertyIfChanged\(style,\s*name,\s*value,\s*priority = ''\)/);
  assert.doesNotMatch(script, /function readStringPref\(name,\s*fallback\)/);
  assert.doesNotMatch(script, /function updatePaneCornerRadii\(\)/);
  assert.doesNotMatch(script, /const colorSourcePolicies = Object\.freeze\(\{/);
});

test('focused helper modules expose the expected subscript contract', () => {
  const styleState = loadScriptModule('style-state.js');
  assert.equal(typeof styleState.setStylePropertyIfChanged, 'function');
  assert.equal(typeof styleState.removeStylePropertyIfChanged, 'function');

  const paneLayout = loadScriptModule('pane-layout.js', {
    chromeDoc: { getElementById: () => null, querySelectorAll: () => [] },
    removeStylePropertyIfChanged: () => false,
    setStylePropertyIfChanged: () => false
  });
  assert.equal(typeof paneLayout.cleanupPaneCornerRadii, 'function');
  assert.equal(typeof paneLayout.observePaneCornerRadii, 'function');
  assert.equal(typeof paneLayout.schedulePaneCornerRadiiUpdate, 'function');
  assert.equal(typeof paneLayout.updatePaneCornerRadii, 'function');

  const sourcePolicy = loadScriptModule('theme-source-policy.js');
  assert.equal(typeof sourcePolicy.getCachedColorSourceName, 'function');
  assert.equal(typeof sourcePolicy.getColorSourceName, 'function');
  assert.equal(typeof sourcePolicy.getColorSourcePolicy, 'function');
  assert.equal(typeof sourcePolicy.getThemeSourceConfidence, 'function');
  assert.equal(typeof sourcePolicy.isPixelThemeSource, 'function');
  assert.equal(typeof sourcePolicy.isPreferredSemanticThemeSource, 'function');
  assert.equal(typeof sourcePolicy.isRenderedThemeSource, 'function');
  assert.equal(sourcePolicy.isRenderedThemeSource({ source: 'host-cache', cachedSource: 'pixel-top-edge' }), true);
  assert.equal(sourcePolicy.isPixelThemeSource('pixel-top-edge'), true);
  assert.equal(sourcePolicy.isPixelThemeSource('pixel'), true);
  assert.equal(sourcePolicy.isPixelThemeSource('sampler'), true);
  assert.equal(sourcePolicy.isPixelThemeSource('top-visible'), false);
  assert.equal(sourcePolicy.isPixelThemeSource({ source: 'host-cache', cachedSource: 'pixel-top-edge' }), true);
  assert.equal(sourcePolicy.isPixelThemeSource({ source: 'host-cache', cachedSource: 'top-visible' }), false);
  assert.equal(sourcePolicy.getColorSourcePolicy('selector-rule').sourceClass, 'unknown');
  assert.equal(sourcePolicy.isPreferredSemanticThemeSource('selector-rule'), false);

  const prefs = loadScriptModule('prefs.js', {
    getServices: () => null,
    window: { CSS: { supports: () => true } }
  });
  assert.equal(typeof prefs.readStringPref, 'function');
  assert.equal(prefs.writeStringPref, undefined);
  assert.equal(prefs.clearUserPref, undefined);
  assert.equal(prefs.prefHasUserValue, undefined);
  assert.equal(prefs.readIntPref, undefined);
  assert.equal(typeof prefs.normalizeCssLength, 'function');
  assert.equal(typeof prefs.normalizeFrameShadowPreset, 'function');
  assert.equal(typeof prefs.normalizeLoadbarMode, 'function');
  assert.equal(prefs.normalizeFrameShadowPreset('unexpected'), 'standard');
  assert.equal(prefs.normalizeLoadbarMode('default'), 'default');
  assert.equal(prefs.normalizeLoadbarMode('none'), 'default');
  assert.equal(prefs.normalizeLoadbarMode('progress'), 'progress');
  assert.equal(prefs.normalizeLoadbarMode('unexpected'), 'glow');

  const colorUtils = loadScriptModule('color-utils.js', {
    cssSupports: () => true,
    sampledColorMinAlpha: 0.08
  });
  assert.equal(typeof colorUtils.parseCssRgb, 'function');
  assert.equal(typeof colorUtils.getReadableForeground, 'function');
  const rgb = colorUtils.parseCssRgb('rgb(1, 2, 3)');
  assert.equal(rgb.r, 1);
  assert.equal(rgb.g, 2);
  assert.equal(rgb.b, 3);
});

test('native theme debug metadata is cleared from one property list', () => {
  const script = read('blended-bar.uc.js');

  assert.match(script, /const nativeZenThemeDebugAttributes = Object\.freeze\(\[/);
  assert.match(script, /'data-blended-addressbar-native-theme-bg'/);
  assert.match(script, /'data-blended-addressbar-native-theme-fg'/);
  assert.match(script, /'data-blended-addressbar-native-theme-accent'/);
  assert.match(script, /'data-blended-addressbar-native-theme-tint'/);
  assert.match(script, /'data-blended-addressbar-native-theme-material'/);
  assert.match(script, /'data-blended-addressbar-native-theme-opacity'/);
  assert.match(script, /'data-blended-addressbar-native-theme-reason'/);
  assert.match(script, /for \(const attribute of nativeZenThemeDebugAttributes\) \{\s*root\.removeAttribute\(attribute\);\s*\}/);
  assert.equal(countOccurrences(script, "root.removeAttribute('data-blended-addressbar-native-theme-"), 0);
});

test('adaptive header background and foreground keep short confirmed transitions and calmer fallback transitions', () => {
  const css = read('style.css');
  const script = read('blended-bar.uc.js');

  assert.match(css, /--blended-addressbar-color-transition:\s*100ms linear/);
  assert.match(script, /const uncertainSources = new Set\(\[/);
  assert.match(script, /\? '180ms ease-out'\s*: '100ms linear'/);
  assert.match(script, /setStylePropertyIfChanged\(\s*chromeDoc\.documentElement\.style,\s*'--blended-addressbar-color-transition',\s*getThemeColorTransition\(theme,\s*reason\)\s*\)/);
  assert.match(css, /#zen-appcontent-navbar-wrapper\s*\{[\s\S]*transition:\s*background-color var\(--blended-addressbar-color-transition\),\s*color var\(--blended-addressbar-color-transition\)/);
  assert.match(css, /transition:\s*color var\(--blended-addressbar-color-transition\),\s*fill var\(--blended-addressbar-color-transition\),\s*stroke var\(--blended-addressbar-color-transition\)/);
  assert.doesNotMatch(css, /\.tabbrowser-tab[\s\S]{0,160}transition:/);
});

test('interactive navigation controls stay outside the browser window drag region', () => {
  const css = readStyleWithImports();
  const noDragRule = cssRuleBlock(
    css,
    '#nav-bar-customization-target > :not(#urlbar-container):not(#urlbar[zen-floating-urlbar="true"]):is(toolbarbutton, toolbaritem)'
  );

  assert.match(noDragRule, /-moz-window-dragging:\s*no-drag/);
});

test('navigation color refreshes avoid repeated loading poll work', () => {
  const script = read('blended-bar.uc.js');

  assert.match(script, /const earlyThemeUpdateDelays = \[0\];/);
  assert.match(script, /const settledThemeUpdateDelays = \[50\];/);
  assert.doesNotMatch(script, /loadingThemePollFastIntervalMs/);
  assert.doesNotMatch(script, /loadingThemePollSlowIntervalMs/);
  assert.doesNotMatch(script, /loadingThemePollAggressiveWindowMs/);
  assert.doesNotMatch(script, /loadingThemePollMaxMs/);
  assert.doesNotMatch(script, /function scheduleLoadingThemePollTick\(/);
  assert.doesNotMatch(script, /setTimeout\(scheduleLoadingThemePollTick/);
  assert.match(script, /function startLoadingThemeTracking\(/);
  assert.match(script, /requestPersistentFrameTheme\(browser,\s*true\);\s*applyHeaderOnlyTheme\(browser,\s*getNeutralHeaderShade\(browser,\s*'loading-unknown'\),\s*'loading-unknown',\s*expectedHref\);/);
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
  const script = `${read('blended-bar.uc.js')}\n${read('scripts/pane-layout.js')}`;
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

  assert.match(script, /setPaneCornerRadius\(pane,\s*'--blended-addressbar-split-radius-top-left',\s*allowTopRadius && touchesTop && touchesLeft && !sidebarBlocksLeftEdge && !hasPaneNeighborAtCorner\(cornerNeighborRects,\s*pane,\s*rect,\s*'top-left',\s*tolerance\),\s*radius\)/);
  assert.match(script, /setPaneCornerRadius\(pane,\s*'--blended-addressbar-split-radius-top-right',\s*allowTopRadius && touchesTop && touchesRight && !sidebarBlocksRightEdge && !hasPaneNeighborAtCorner\(cornerNeighborRects,\s*pane,\s*rect,\s*'top-right',\s*tolerance\),\s*radius\)/);
  assert.match(script, /setPaneCornerRadius\(pane,\s*'--blended-addressbar-split-radius-bottom-right',\s*touchesBottom && touchesRight && !sidebarBlocksRightEdge && !hasPaneNeighborAtCorner\(cornerNeighborRects,\s*pane,\s*rect,\s*'bottom-right',\s*tolerance\),\s*radius\)/);
  assert.match(script, /setPaneCornerRadius\(pane,\s*'--blended-addressbar-split-radius-bottom-left',\s*touchesBottom && touchesLeft && !sidebarBlocksLeftEdge && !hasPaneNeighborAtCorner\(cornerNeighborRects,\s*pane,\s*rect,\s*'bottom-left',\s*tolerance\),\s*radius\)/);
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

test('remove frame rounding overrides the effective radius without erasing its configured value', () => {
  const script = read('blended-bar.uc.js');
  const prefsJson = JSON.parse(read('preferences.json'));
  const readme = read('README.md');
  const preference = prefsJson.find((pref) => pref.property === 'uc.blended-addressbar.frame-radius.disabled');

  assert.deepEqual(preference, {
    property: 'uc.blended-addressbar.frame-radius.disabled',
    label: 'Remove browser frame rounding',
    type: 'checkbox',
    defaultValue: false
  });
  assert.match(script, /const frameRadiusDisabledPref = `\$\{addressbarPrefBranch\}frame-radius\.disabled`/);
  assert.match(script, /const framePrefNames = Object\.freeze\(new Set\(\[[\s\S]*frameRadiusDisabledPref/);
  assert.match(script, /const radius = readBoolPref\(frameRadiusDisabledPref,\s*false\)\s*\?\s*'0px'\s*:\s*normalizeCssLength\(readStringPref\(frameRadiusPref,\s*'14px'\),\s*'14px'\)/);
  assert.match(readme, /uc\.blended-addressbar\.frame-radius\.disabled`: remove browser frame rounding without changing the configured radius/);
});

test('single-toolbar mode frames page content while leaving the sidebar addressbar native', () => {
  const css = read('style.css');
  const readme = read('README.md');
  const preferences = JSON.parse(read('preferences.json'));
  const alwaysVisible = preferences.find(
    (pref) => pref.property === 'uc.blended-addressbar.single-toolbar.bookmarks-always-visible'
  );
  const singleStart = css.indexOf('/* Single-toolbar mode keeps Zen\'s sidebar addressbar native. */');
  const singleEnd = css.indexOf('\n@media (-moz-platform: macos)', singleStart);

  assert.notEqual(singleStart, -1, 'missing single-toolbar frame styles');
  assert.notEqual(singleEnd, -1, 'missing end of single-toolbar frame styles');
  const singleCss = css.slice(singleStart, singleEnd);

  assert.deepEqual(alwaysVisible, {
    property: 'uc.blended-addressbar.single-toolbar.bookmarks-always-visible',
    label: 'Always show bookmarks in Only Sidebar',
    type: 'checkbox',
    defaultValue: false
  });
  assert.match(singleCss, /:root\[zen-single-toolbar="true"\]/);
  assert.match(singleCss, /--blended-addressbar-bookmarks-height:\s*var\(--zen-toolbar-height,\s*38px\)/);
  assert.match(singleCss, /--blended-addressbar-bookmarks-hide-delay:\s*600ms/);
  assert.match(singleCss, /:root\[zen-single-toolbar="true"\]:not\(\[customizing\]\)\s+#zen-appcontent-navbar-wrapper:has\(#PersonalToolbar\[collapsed\]\)\s*\{[^}]*min-height:\s*0\s*!important[^}]*height:\s*0\s*!important/s);
  assert.doesNotMatch(singleCss, /zen-has-bookmarks/);
  assert.match(singleCss, /#zen-appcontent-wrapper\s*\{[^}]*position:\s*relative/s);
  assert.match(singleCss, /&:not\(\[customizing\]\) #zen-appcontent-navbar-wrapper\s*\{[^}]*position:\s*absolute\s*!important[^}]*inset:\s*var\(--blended-addressbar-frame-gap\) 0 auto 0[^}]*background:\s*transparent\s*!important/s);
  assert.match(singleCss, /#PersonalToolbar:not\(\[hidden\]\):not\(\[collapsed\]\)\s*\{[^}]*margin:\s*0 var\(--blended-addressbar-frame-gap\) 0 0\s*!important[^}]*height:\s*var\(--blended-addressbar-bookmarks-height\)\s*!important[^}]*min-height:\s*var\(--blended-addressbar-bookmarks-height\)\s*!important[^}]*padding-inline:\s*clamp\(8px,\s*var\(--blended-addressbar-frame-radius\),\s*16px\)\s*!important[^}]*background:\s*var\(--zen-tab-header-background,\s*var\(--blended-addressbar-frame-background,\s*var\(--zen-main-browser-background\)\)\)\s*!important[^}]*border-bottom:\s*0\s*!important[^}]*box-shadow:\s*none\s*!important[^}]*border-radius:\s*var\(--blended-addressbar-frame-radius\) var\(--blended-addressbar-frame-radius\) 0 0[^}]*color:\s*var\(--zen-tab-header-foreground,\s*inherit\)\s*!important/s);
  assert.match(singleCss, /#PersonalToolbar\[collapsed\]\s*\{[^}]*display:\s*none\s*!important/s);
  assert.match(singleCss, /&:has\(#PersonalToolbar:not\(\[hidden\]\):not\(\[collapsed\]\)\)\s+#tabbrowser-tabpanels\[has-toolbar-hovered\] \.browserContainer\s*\{[^}]*--margin-top-fix:\s*0px\s*!important/s);
  assert.match(singleCss, /@media -moz-pref\("zen\.view\.hide-window-controls"\)[\s\S]*#zen-tabbox-wrapper\s*\{[^}]*transition:\s*padding-top var\(--zen-hidden-toolbar-transition\)[^}]*transition-delay:\s*0\.2s/s);
  assert.match(singleCss, /@media -moz-pref\("zen\.view\.hide-window-controls"\)[\s\S]*#zen-appcontent-navbar-wrapper:is\(\[zen-has-hover\],\s*\[has-popup-menu\],\s*\[zen-compact-mode-active\]\):has\(#PersonalToolbar:not\(\[hidden\]\):not\(\[collapsed\]\)\)\s*\+ #zen-tabbox-wrapper\s*\{[^}]*padding-top:\s*var\(--blended-addressbar-bookmarks-height\)\s*!important/s);
  assert.match(singleCss, /#zen-appcontent-navbar-wrapper:not\(\[zen-has-hover\]\):not\(\[has-popup-menu\]\):not\(\[zen-compact-mode-active\]\):has\(#PersonalToolbar:not\(\[hidden\]\):not\(\[collapsed\]\)\),[\s\S]*\+ #zen-tabbox-wrapper\s*\{[^}]*transition-delay:\s*var\(--blended-addressbar-bookmarks-hide-delay\)\s*!important/s);
  assert.doesNotMatch(singleCss, /padding-top:\s*30px\s*!important/);
  assert.doesNotMatch(singleCss, /#PersonalToolbar[^\n]*collapsed="true"/);
  assert.doesNotMatch(singleCss, /padding-top:\s*var\(--zen-toolbar-height/);
  assert.match(singleCss, /#zen-tabbox-wrapper\s*\{[^}]*margin:\s*var\(--blended-addressbar-frame-gap\) var\(--blended-addressbar-frame-gap\) var\(--blended-addressbar-frame-gap\) 0\s*!important[^}]*background-color:\s*var\(--blended-addressbar-frame-background,\s*var\(--zen-main-browser-background\)\)[^}]*box-shadow:\s*var\(--blended-addressbar-frame-shadow\)[^}]*border-radius:\s*var\(--blended-addressbar-frame-radius\)[^}]*overflow:\s*hidden/s);
  assert.match(singleCss, /#zen-tabbox-wrapper\s*\{[^}]*z-index:\s*auto\s*!important[^}]*isolation:\s*auto/s);
  assert.match(singleCss, /@media -moz-pref\("zen\.tabs\.vertical\.right-side"\)[\s\S]*#zen-tabbox-wrapper\s*\{[^}]*margin:\s*var\(--blended-addressbar-frame-gap\) 0 var\(--blended-addressbar-frame-gap\) var\(--blended-addressbar-frame-gap\)\s*!important/s);
  assert.match(singleCss, /&:has\(\[zen-compact-mode="true"\]\) #zen-tabbox-wrapper\s*\{[^}]*margin:\s*var\(--blended-addressbar-frame-gap\) var\(--blended-addressbar-frame-gap\) var\(--blended-addressbar-frame-gap\) var\(--blended-addressbar-frame-gap\)\s*!important/s);
  assert.doesNotMatch(singleCss, /#zen-appcontent-wrapper\s*\{[^}]*border-radius:/s);
  assert.match(css, /@media \(-moz-bool-pref:\s*"uc\.blended-addressbar\.single-toolbar\.bookmarks-always-visible"\)[\s\S]*#zen-appcontent-navbar-wrapper:has\(#PersonalToolbar:not\(\[hidden\]\):not\(\[collapsed\]\)\)\s*\{[^}]*height:\s*var\(--blended-addressbar-bookmarks-height\)\s*!important[^}]*opacity:\s*1\s*!important[^}]*pointer-events:\s*auto\s*!important/s);
  assert.match(css, /@media \(-moz-bool-pref:\s*"uc\.blended-addressbar\.single-toolbar\.bookmarks-always-visible"\)[\s\S]*#zen-appcontent-navbar-wrapper:has\(#PersonalToolbar:not\(\[hidden\]\):not\(\[collapsed\]\)\)\s*\+ #zen-tabbox-wrapper\s*\{[^}]*padding-top:\s*var\(--blended-addressbar-bookmarks-height\)\s*!important/s);
  assert.match(singleCss, /&:is\(\[inDOMFullscreen="true"\],\s*\[inFullscreen="true"\],\s*\[macOSNativeFullscreen\],\s*\[zen-no-padding="true"\]\)[\s\S]*#zen-appcontent-navbar-wrapper\s*\{[^}]*min-height:\s*0\s*!important[^}]*height:\s*0\s*!important[\s\S]*#zen-tabbox-wrapper\s*\{[^}]*margin:\s*0\s*!important[^}]*border-radius:\s*var\(--blended-addressbar-frame-radius\)\s*!important[^}]*box-shadow:\s*none\s*!important/s);
  assert.doesNotMatch(singleCss, /#urlbar/);
  assert.match(readme, /Only Sidebar keeps Zen's native sidebar addressbar/);
  assert.match(readme, /uc\.blended-addressbar\.single-toolbar\.bookmarks-always-visible/);
});

test('DOM fullscreen removes the framed browser surface', () => {
  const css = read('style.css');

  assert.match(css, /&:is\(\[inDOMFullscreen="true"\],\s*\[inFullscreen="true"\],\s*\[macOSNativeFullscreen\],\s*\[zen-no-padding="true"\]\)/);
  assert.match(css, /&:is\([^)]*\)\s*\{[\s\S]*#zen-appcontent-wrapper\s*\{[^}]*margin:\s*0\s*!important[^}]*border-radius:\s*0\s*!important[^}]*box-shadow:\s*none\s*!important/s);
  assert.match(css, /&:is\([^)]*\)\s*\{[\s\S]*#nav-bar,\s*[\r\n]+\s*#nav-bar:not\(\[hidden\]\):not\(\[collapsed="true"\]\) \+ #PersonalToolbar:not\(\[hidden\]\):not\(\[collapsed="true"\]\)\s*\{[^}]*box-shadow:\s*none\s*!important/s);
  assert.match(css, /&:is\([^)]*\)\s*\{[\s\S]*#tabbrowser-tabpanels > \.browserSidebarContainer:not\(\.zen-glance-overlay\)\s*\{[^}]*--zen-native-inner-radius:\s*0 0 0 0\s*!important/s);
});

test('expanded sidebar toolbox keeps chrome icons vertically aligned', () => {
  const css = read('style.css');

  assert.match(css, /#navigator-toolbox\[zen-sidebar-expanded="true"\]\s*\{[^}]*padding-top:\s*2px\s*!important/s);
});

test('hidden tab sidebar toolbar icons use the softer addressbar chrome foreground', () => {
  const css = readStyleWithImports();
  const headerCss = read('styles/header-chrome.css');

  assert.match(css, /#navigator-toolbox\[tabs-hidden\]/);
  assert.match(css, /--blended-addressbar-header-chrome-foreground:\s*var\(--zen-tab-header-foreground,\s*currentColor\)/);
  assert.match(css, /--blended-addressbar-header-chrome-icon-fill:\s*color-mix\(in srgb,\s*var\(--blended-addressbar-header-chrome-foreground\)\s*60%,\s*transparent\)/);
  assert.match(css, /#navigator-toolbox\[tabs-hidden\][^{]*\{[^}]*--toolbarbutton-icon-fill:\s*var\(--blended-addressbar-header-chrome-icon-fill\)\s*!important/s);
  assert.match(css, /#navigator-toolbox\[tabs-hidden\][\s\S]*color:\s*var\(--blended-addressbar-header-chrome-icon-fill\)\s*!important/);
  assert.match(css, /#navigator-toolbox\[tabs-hidden\][\s\S]*--toolbarbutton-icon-fill:\s*currentColor\s*!important/);
  assert.match(css, /#navigator-toolbox\[tabs-hidden\][\s\S]*:is\([^)]*(?:\[disabled\]|\[disabled="true"\]|\[muted\]|\[soundplaying\])/);
  assert.match(css, /color:\s*var\(--blended-addressbar-header-muted-foreground\)\s*!important/);
  assert.match(headerCss, /\.urlbar-icon/);
  assert.match(headerCss, /\.identity-box-button/);
  assert.match(headerCss, /\.urlbar-page-action/);
  assert.match(headerCss, /#zen-site-data-icon-button/);
  assert.match(headerCss, /#zen-site-data-icon-button\s+image/);
  assert.match(headerCss, /fill-opacity:\s*0\.6\s*!important/);
  assert.match(headerCss, /--urlbar-icon-fill-opacity:\s*0\.6/);
  const compactSelector = '&:has([zen-compact-mode="true"]):not(:has(#navigator-toolbox[tabs-hidden])) #zen-appcontent-navbar-wrapper';
  const compactIndex = headerCss.indexOf(compactSelector);
  assert.notEqual(compactIndex, -1, `missing selector: ${compactSelector}`);
  const compactBlock = headerCss.slice(compactIndex, headerCss.indexOf('\n    }', compactIndex));
  assert.match(compactBlock, /color:\s*inherit\s*!important/);
  assert.match(compactBlock, /fill:\s*currentColor\s*!important/);
  assert.match(compactBlock, /--toolbarbutton-icon-fill:\s*currentColor/);
  assert.doesNotMatch(headerCss, /&:has\(\[zen-compact-mode="true"\]\)\s+#zen-appcontent-navbar-wrapper/);
});

test('adaptive chrome colors cover Zen moved sidebar toolbar and copy URL icons', () => {
  const css = readStyleWithImports();

  const titlebarSidebarSelector = cssSelectorPrelude(css, '#titlebar > #zen-sidebar-top-buttons');
  const navBarSidebarSelector = cssSelectorPrelude(css, '#nav-bar > #zen-sidebar-top-buttons');
  const copyUrlIconBlock = cssRuleBlock(css, '#zen-copy-url-button image');

  assert.match(titlebarSidebarSelector, /#zen-sidebar-top-buttons\)\s*:is\(/);
  assert.match(navBarSidebarSelector, /#zen-sidebar-top-buttons\)\s*:is\(/);
  for (const buttonId of ['#zen-toggle-compact-mode', '#history-panelmenu', '#bookmarks-menu-button']) {
    assert.match(titlebarSidebarSelector, new RegExp(buttonId.slice(1)));
    assert.match(navBarSidebarSelector, new RegExp(buttonId.slice(1)));
  }
  assert.match(copyUrlIconBlock, /color:\s*var\(--zen-tab-header-foreground,\s*(?:inherit|currentColor)\)\s*!important/);
  assert.match(copyUrlIconBlock, /fill:\s*currentColor\s*!important/);
  assert.match(copyUrlIconBlock, /fill-opacity:\s*1\s*!important/);
  assert.match(copyUrlIconBlock, /--toolbarbutton-icon-fill:\s*currentColor\s*!important/);
});

test('window controls follow adaptive header colors in sidebar and addressbar placements', () => {
  const css = readStyleWithImports();
  const addressbarTrafficSelector = cssSelectorPrelude(css, '#zen-appcontent-navbar-wrapper .titlebar-buttonbox-container');
  const sidebarTrafficSelector = cssSelectorPrelude(css, '#zen-sidebar-top-buttons .titlebar-buttonbox-container');

  for (const selector of [addressbarTrafficSelector, sidebarTrafficSelector]) {
    assert.match(selector, /\.titlebar-buttonbox-container/);
  }

  const addressbarTrafficBlock = cssRuleBlock(css, '#zen-appcontent-navbar-wrapper .titlebar-buttonbox-container');
  const sidebarTrafficBlock = cssRuleBlock(css, '#zen-sidebar-top-buttons .titlebar-buttonbox-container');
  assert.match(addressbarTrafficBlock, /color:\s*var\(--zen-tab-header-foreground,\s*inherit\)\s*!important/);
  assert.match(addressbarTrafficBlock, /--toolbox-textcolor:\s*var\(--zen-tab-header-foreground,\s*currentColor\)/);
  assert.match(addressbarTrafficBlock, /--zen-toolbar-element-bg:\s*color-mix\(in srgb,\s*currentColor\s*14%,\s*transparent\)\s*!important/);
  assert.match(sidebarTrafficBlock, /color:\s*var\(--zen-sidebar-themed-icon-fill,\s*var\(--toolbox-textcolor,\s*currentColor\)\)\s*!important/);
  assert.doesNotMatch(sidebarTrafficBlock, /--zen-tab-header-foreground/);
  assert.match(sidebarTrafficBlock, /--zen-toolbar-element-bg:\s*color-mix\(in srgb,\s*currentColor\s*14%,\s*transparent\)\s*!important/);
});

test('visible collapsed macOS sidebar fits compact horizontal window controls above tabs', () => {
  const css = read('style.css');
  const collapsedControls = /:root:not\(\[zen-single-toolbar="true"\]\):not\(\[zen-sidebar-expanded="true"\]\):not\(\[zen-compact-mode="true"\]\)\s*#nav-bar > \.titlebar-buttonbox-container\s*\{[^}]*position:\s*fixed;[^}]*inset-inline-start:\s*0;[^}]*top:\s*0;[^}]*z-index:\s*10;[^}]*width:\s*var\(--zen-toolbox-max-width,\s*60px\)\s*!important;[^}]*height:\s*42px;[^}]*overflow:\s*visible/s;

  assert.match(css, collapsedControls);
  assert.match(css, /> \.titlebar-buttonbox\s*\{[^}]*appearance:\s*none\s*!important;[^}]*flex-direction:\s*row;[^}]*gap:\s*6px;[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*margin:\s*0\s*!important/s);
  assert.match(css, /> \.titlebar-button\s*\{[^}]*appearance:\s*none\s*!important;[^}]*display:\s*flex\s*!important;[^}]*flex:\s*0 0 10px;[^}]*width:\s*10px;[^}]*height:\s*10px;[^}]*border-radius:\s*50%\s*!important/s);
  assert.match(css, /> \.titlebar-close\s*\{[^}]*order:\s*0;[^}]*background-color:\s*#ff5f57\s*!important/s);
  assert.match(css, /> \.titlebar-min\s*\{[^}]*order:\s*1;[^}]*background-color:\s*#febc2e\s*!important/s);
  assert.match(css, /> :is\(\.titlebar-max,\s*\.titlebar-restore\)\s*\{[^}]*order:\s*2;[^}]*background-color:\s*#28c840\s*!important/s);
  assert.match(css, /:not\(\[sizemode="maximized"\],\s*\[sizemode="fullscreen"\]\)[\s\S]*\.titlebar-restore,[\s\S]*:is\(\[sizemode="maximized"\],\s*\[sizemode="fullscreen"\]\)[\s\S]*\.titlebar-max\s*\{\s*display:\s*none\s*!important/s);
  assert.doesNotMatch(css, /#navigator-toolbox\s*\{[^}]*padding-top:\s*calc\(var\(--zen-element-separation\) \* 3\)\s*!important/s);
  assert.match(css, /@media -moz-pref\("zen\.widget\.mac\.mono-window-controls"\)[\s\S]*#nav-bar > \.titlebar-buttonbox-container\s*\{[^}]*background-image:\s*none\s*!important;[\s\S]*> \.titlebar-buttonbox\s*\{[^}]*opacity:\s*1\s*!important;[\s\S]*> \.titlebar-button\s*\{[^}]*background-color:\s*var\(--zen-toolbar-element-bg\)\s*!important/s);
  assert.doesNotMatch(css, /:root\[zen-compact-mode="true"\][^{]*#nav-bar > \.titlebar-buttonbox-container[^{]*\{[^}]*flex-direction:\s*column/s);
});

test('hidden tab chrome styling lives in a focused imported stylesheet', () => {
  const css = read('style.css');
  const headerCss = read('styles/header-chrome.css');

  assert.match(css, /@import "styles\/header-chrome\.css";/);
  assert.match(headerCss, /#navigator-toolbox\[tabs-hidden\]/);
  assert.match(headerCss, /--blended-addressbar-header-chrome-icon-fill/);
  const compactSelector = '&:has([zen-compact-mode="true"]):not(:has(#navigator-toolbox[tabs-hidden])) #zen-appcontent-navbar-wrapper';
  const compactIndex = headerCss.indexOf(compactSelector);
  assert.notEqual(compactIndex, -1, `missing selector: ${compactSelector}`);
  const compactBlock = headerCss.slice(compactIndex, headerCss.indexOf('\n    }', compactIndex));
  assert.match(compactBlock, /color:\s*inherit\s*!important/);
  assert.match(compactBlock, /fill:\s*currentColor\s*!important/);
  assert.match(compactBlock, /--toolbarbutton-icon-fill:\s*currentColor/);
  assert.doesNotMatch(css, /--blended-addressbar-header-chrome-icon-fill/);
});

test('frame shadow is selected through constrained dropdown presets', () => {
  const css = read('style.css');
  const script = `${read('blended-bar.uc.js')}\n${read('scripts/prefs.js')}`;
  const prefs = read('preferences.json');
  const prefsJson = JSON.parse(prefs);
  const frameShadowPreference = prefsJson.find((pref) => pref.property === 'uc.blended-addressbar.frame-shadow');
  const prefsModule = loadScriptModule('prefs.js');

  assert.match(script, /const frameShadowPref = `\$\{addressbarPrefBranch\}frame-shadow`/);
  assert.match(script, /function normalizeFrameShadowPreset\(/);
  assert.match(script, /data-blended-addressbar-frame-shadow/);
  assert.match(css, /--blended-addressbar-frame-shadow-standard:/);
  assert.match(css, /--blended-addressbar-frame-shadow-minimal:/);
  assert.deepEqual([...css.matchAll(/--blended-addressbar-frame-shadow-minimal:\s*([^;]+);/g)].map(match => match[1].replace(/\s+/g, ' ')), ['0 0 0 0.5pt rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.15)']);
  assert.match(css, /--blended-addressbar-frame-shadow-medium:/);
  assert.doesNotMatch(css, /\[data-blended-addressbar-frame-shadow="none"\]/);
  assert.doesNotMatch(css, /--blended-addressbar-frame-shadow:\s*none/);
  assert.match(prefs, /uc\.blended-addressbar\.frame-shadow/);
  assert.equal(frameShadowPreference.defaultValue, 'standard');
  assert.deepEqual(frameShadowPreference.options.map((option) => option.value), ['standard', 'minimal', 'medium']);
  assert.deepEqual(frameShadowPreference.options.map((option) => option.label), ['Standard', 'Minimal', 'Medium']);
  assert.equal(prefsModule.normalizeFrameShadowPreset('none'), 'standard');
});

test('page color caching is in-memory only and has no long-lived site color preference', () => {
  const script = read('blended-bar.uc.js');
  const prefs = read('preferences.json');
  const readme = read('README.md');
  const architecture = read('docs/color-architecture.md');

  assert.doesNotMatch(script, /rememberPageColorsPref/);
  assert.doesNotMatch(script, /rememberSiteColorsLongerPref/);
  assert.doesNotMatch(script, /siteThemeCachePref/);
  assert.match(script, /let themeCache = new WeakMap\(\)/);
  assert.match(script, /let pageThemeCache = new Map\(\)/);
  assert.doesNotMatch(script, /let hostThemeCache = new Map\(\)/);
  assert.doesNotMatch(script, /function readRememberPageColors\(\)/);
  assert.doesNotMatch(script, /function readRememberSiteColorsLonger\(\)/);
  assert.match(script, /function getThemeHostKey\(href\)/);
  assert.match(script, /function cachePageTheme\(theme,\s*href\)/);
  assert.match(script, /function getCachedPageTheme\(browser\)/);
  assert.match(script, /function getCachedTargetTheme\(browser\)/);
  assert.doesNotMatch(script, /return getCachedTargetTheme\(browser\) \|\| getCachedHostTheme\(browser\)/);
  assert.doesNotMatch(script, /function getCachedHostTheme\(browser\)/);
  assert.match(script, /source:\s*'host-cache'/);
  assert.doesNotMatch(script, /function persistHostThemeCache\(\)/);
  assert.doesNotMatch(script, /writeStringPref\(siteThemeCachePref/);
  assert.doesNotMatch(script, /function clearHostThemeCache\(reason = 'clear-cache'\)/);
  assert.doesNotMatch(script, /page-cache-disabled/);
  assert.doesNotMatch(script, /page-cache-enabled/);
  assert.doesNotMatch(script, /clearCacheRequestPref/);
  assert.doesNotMatch(script, /clear-cache-request/);
  assert.doesNotMatch(prefs, /uc\.blended-addressbar\.remember-page-colors/);
  assert.doesNotMatch(prefs, /Remember page colors while browsing/);
  assert.doesNotMatch(prefs, /uc\.blended-addressbar\.remember-site-colors-longer/);
  assert.doesNotMatch(prefs, /Remember site colors longer/);
  assert.doesNotMatch(prefs, /uc\.blended-addressbar\.clear-cache-request/);
  assert.doesNotMatch(prefs, /Clear cached page colors/);
  assert.doesNotMatch(readme, /uc\.blended-addressbar\.remember-page-colors/);
  assert.match(readme, /Page colors are always remembered in memory while browsing/);
  assert.doesNotMatch(readme, /uc\.blended-addressbar\.remember-site-colors-longer/);
  assert.doesNotMatch(readme, /remembered site colors across browser restarts/);
  assert.doesNotMatch(readme, /uc\.blended-addressbar\.clear-cache-request/);
  assert.doesNotMatch(architecture, /uc\.blended-addressbar\.remember-site-colors-longer/);
  assert.doesNotMatch(architecture, /remember-site-colors-longer/);
  assert.doesNotMatch(architecture, /site-theme-cache/);
  assert.doesNotMatch(architecture, /selector-rule/);
});

test('remembered tab colors are delayed in-session fallbacks instead of the first tab-switch paint', () => {
  const script = read('blended-bar.uc.js');

  assert.match(script, /const targetCachedTheme = getCachedTargetTheme\(browser\)/);
  assert.match(script, /const cachedTheme = targetCachedTheme/);
  assert.doesNotMatch(script, /hostCachedTheme/);
  assert.doesNotMatch(script, /cachedThemeIsHost/);
  assert.match(script, /const deferRememberedFallback = keepCachedTheme\s+&& !zenBoostActive/);
  assert.match(script, /const targetCachedThemeApplied = !deferRememberedFallback && targetCachedTheme\s*\?\s*applyResolvedTheme\(browser,\s*targetCachedTheme,\s*'target-cache',\s*expectedHref,\s*\{[\s\S]*requireRendered:\s*zenBoostActive[\s\S]*\}\)\s*:\s*false/);
  assert.doesNotMatch(script, /if \(cachedTheme\) \{\s*applyResolvedTheme\(browser,\s*cachedTheme,\s*'cache',\s*expectedHref\);\s*\}\s*const fastTheme = getBrowserPageThemeFromChrome\(browser\)/s);
  assert.match(script, /const rememberedFallbackTheme = targetCachedTheme \|\| retainedHostTheme/);
  assert.match(script, /scheduleDelayedThemeFallback\(browser,\s*rememberedFallbackTheme,\s*rememberedFallbackTheme\.source === 'host-cache' \? 'host-cache' : 'target-cache',\s*expectedHref,\s*\{[\s\S]*requireRendered:\s*zenBoostActive[\s\S]*\}\)/s);
  assert.doesNotMatch(script, /else if \(cachedThemeIsHost\)/);
});

test('target tab cached colors apply before same-host retained fallbacks', () => {
  const script = read('blended-bar.uc.js');

  assert.match(script, /function getCachedTargetTheme\(browser\)/);
  assert.match(script, /return getCachedPageTheme\(browser\)/);
  assert.match(script, /const targetCachedTheme = getCachedTargetTheme\(browser\)/);
  assert.match(script, /const retainedHostTheme = targetCachedTheme \? null : getSameHostRetainedTheme\(expectedHref\)/);
  assert.match(script, /const rememberedFallbackTheme = targetCachedTheme \|\| retainedHostTheme/);
  assert.match(script, /const targetCachedThemeApplied = !deferRememberedFallback && targetCachedTheme\s*\?\s*applyResolvedTheme\(browser,\s*targetCachedTheme,\s*'target-cache'/s);
  assert.match(script, /const targetCachedThemeApplied[\s\S]*const retainedHostThemeApplied/);
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

test('same-host tab switches delay retained in-session color while uncached tab switches delay neutral fallbacks', () => {
  const script = read('blended-bar.uc.js');

  assert.match(script, /function getSameHostRetainedTheme\(expectedHref\)/);
  assert.match(script, /const expectedHost = getThemeHostKey\(expectedHref\)/);
  assert.match(script, /const previousHost = getThemeHostKey\(lastAppliedTheme\?\.href\)/);
  assert.match(script, /if \(previousHost !== expectedHost\) return null/);
  assert.match(script, /cachedSource:\s*lastAppliedTheme\.source \|\| ''/);
  assert.match(script, /const retainedHostTheme = targetCachedTheme \? null : getSameHostRetainedTheme\(expectedHref\)/);
  assert.match(script, /const retainedHostThemeApplied = !deferRememberedFallback && retainedHostTheme\s*\?\s*applyResolvedTheme\(browser,\s*retainedHostTheme,\s*'same-host-retained',\s*expectedHref,\s*\{[\s\S]*requireRendered:\s*zenBoostActive[\s\S]*\}\)\s*:\s*false/);
  assert.match(script, /const deferUnknownFallback = keepCachedTheme\s+&& !zenBoostActive/);
  assert.match(script, /if \(isLoadingThemeFor\(browser\) && !cachedTheme && !retainedHostTheme && !deferUnknownFallback\)/);
  assert.match(script, /else if \(!cachedTheme && !retainedHostTheme && !skipToolbarFallback && !deferUnknownFallback\)/);
  assert.match(script, /scheduleDelayedThemeFallback\(browser,\s*getNeutralHeaderShade\(browser,\s*'unknown-page'\),\s*reason,\s*expectedHref,\s*\{ headerOnly: true \}\)/);
  assert.doesNotMatch(script, /else if \(!retainedHostTheme && !skipToolbarFallback\)/);
});

test('same effective tab theme updates are no-ops to avoid tab-switch blink', () => {
  const script = `${read('blended-bar.uc.js')}\n${read('scripts/style-state.js')}`;

  assert.match(script, /function setStylePropertyIfChanged\(style,\s*name,\s*value,\s*priority = ''\)/);
  assert.match(script, /function removeStylePropertyIfChanged\(style,\s*name\)/);
  assert.match(script, /function normalizeThemeColorForKey\(value\)/);
  assert.match(script, /return `rgba\(\$\{rgb\.r\},\$\{rgb\.g\},\$\{rgb\.b\},\$\{alpha\}\)`/);
  assert.match(script, /function getThemeKey\(theme\) \{\s*return `\$\{normalizeThemeColorForKey\(theme\?\.bg\)\}\|\$\{normalizeThemeColorForKey\(theme\?\.fg\)\}`;\s*\}/);
  assert.match(script, /function setVar\(value,\s*foreground\)[\s\S]*setStylePropertyIfChanged\(rootStyle,\s*'--zen-tab-header-background'/);
  assert.match(script, /function setWindowTintBackground\(tintBackground,[\s\S]*setStylePropertyIfChanged\(root\.style,\s*'--blended-addressbar-window-tint-background'/);
  assert.match(script, /setStylePropertyIfChanged\(root\.style,\s*'--blended-addressbar-frame-background',\s*tintBackground,\s*'important'\)/);
  assert.match(script, /function setPageLoadbarColors\(theme\)[\s\S]*const rootStyle = chromeDoc\.documentElement\.style/);
  assert.match(script, /setStylePropertyIfChanged\(rootStyle,\s*'--blended-addressbar-page-loadbar-background',\s*theme\.bg\)/);
  assert.match(script, /removeStylePropertyIfChanged\(rootStyle,\s*'--blended-addressbar-page-loadbar-background'\)/);
  assert.match(script, /setStylePropertyIfChanged\(rootStyle,\s*'--blended-addressbar-page-loadbar-foreground',\s*theme\.fg\)/);
  assert.match(script, /setStylePropertyIfChanged\(rootStyle,\s*'--blended-addressbar-frame-radius',\s*radius\)/);
  assert.match(script, /setStylePropertyIfChanged\(rootStyle,\s*'--blended-addressbar-loadbar-static-color',\s*customColor\)/);
  assert.match(script, /if \(key === lastThemeKey\) \{\s*lastAppliedTheme = theme;\s*return true;\s*\}/);
  assert.match(script, /if \(key === lastThemeKey && getCurrentFrameBackground\(\) === 'transparent'\) \{\s*lastAppliedTheme = theme;\s*return true;\s*\}/);
  assert.doesNotMatch(script, /const key = getThemeKey\(theme\);\s*chromeDoc\.documentElement\.style\.setProperty\('--blended-addressbar-frame-background',\s*'transparent',\s*'important'\);\s*if \(key === lastThemeKey\)/);
});

test('loadbar modes customize the native Zen loading progress element', () => {
  const script = read('blended-bar.uc.js');
  const css = readStyleWithImports();
  const prefs = read('preferences.json');
  const prefsJson = JSON.parse(prefs);
  const loadbarModePreference = prefsJson.find((pref) => pref.property === 'uc.loadbar.mode');
  const loadbarColorSourcePreference = prefsJson.find((pref) => pref.property === 'uc.loadbar.color-source');
  const loadbarColorPreference = prefsJson.find((pref) => pref.property === 'uc.loadbar.color');
  const loadbarFocusColorPreference = prefsJson.find((pref) => pref.property === 'uc.loadbar.focus-color');
  const progressModeStart = css.indexOf(':root[data-blended-addressbar-loadbar-mode="progress"]');
  const edgeModeStart = css.indexOf(':root[data-blended-addressbar-loadbar-mode="edge"]');
  const glowModeStart = css.indexOf(':root[data-blended-addressbar-loadbar-mode="glow"]');
  assert.notEqual(progressModeStart, -1, 'missing progress loadbar mode block');
  assert.notEqual(edgeModeStart, -1, 'missing edge loadbar mode block');
  assert.notEqual(glowModeStart, -1, 'missing glow loadbar mode block');
  const progressModeBlock = css.slice(progressModeStart, edgeModeStart);
  const edgeModeBlock = css.slice(edgeModeStart, glowModeStart);
  const readme = read('README.md');

  assert.match(script, /const loadbarModePref = `\$\{loadbarPrefBranch\}mode`/);
  assert.match(script, /const loadbarFocusColorPref = `\$\{loadbarPrefBranch\}focus-color`/);
  assert.match(script, /const defaultLoadbarMode = 'glow'/);
  assert.doesNotMatch(script, /const loadbarModeValues = Object\.freeze/);
  assert.doesNotMatch(script, /loadbarColorSourcePref/);
  assert.doesNotMatch(script, /loadbarColorSourceValues/);
  assert.match(script, /const mode = readStringPref\(loadbarModePref,\s*defaultLoadbarMode\)/);
  assert.match(script, /const normalizedMode = normalizeLoadbarMode\(mode\)/);
  assert.match(script, /const height = normalizeCssLength\(readStringPref\(loadbarHeightPref,\s*'2px'\),\s*'2px'\)/);
  assert.match(script, /const opacity = normalizeOpacity\(readStringPref\(loadbarOpacityPref,\s*'100'\),\s*'1'\)/);
  assert.match(script, /const customColor = normalizeCssColor\(readStringPref\(loadbarColorPref,\s*'var\(--zen-primary-color\)'\),\s*'var\(--zen-primary-color\)'\)/);
  assert.match(script, /const useFocusColor = readBoolPref\(loadbarFocusColorPref,\s*true\)/);
  assert.match(script, /setStylePropertyIfChanged\(rootStyle,\s*'--blended-addressbar-loadbar-static-color',\s*customColor\)/);
  assert.match(script, /function getLoadbarGlowMix\(opacity,\s*percent\)/);
  assert.match(script, /setStylePropertyIfChanged\(rootStyle,\s*'--blended-addressbar-loadbar-glow-strong-mix',\s*getLoadbarGlowMix\(opacity,\s*34\)\)/);
  assert.match(script, /setStylePropertyIfChanged\(rootStyle,\s*'--blended-addressbar-loadbar-glow-medium-mix',\s*getLoadbarGlowMix\(opacity,\s*18\)\)/);
  assert.match(script, /setStylePropertyIfChanged\(rootStyle,\s*'--blended-addressbar-loadbar-glow-weak-mix',\s*getLoadbarGlowMix\(opacity,\s*7\)\)/);
  assert.match(script, /root\.setAttribute\('data-blended-addressbar-loadbar-focus-color',\s*String\(useFocusColor\)\)/);
  assert.doesNotMatch(script, /data-blended-addressbar-loadbar-color-source/);
  assert.match(script, /data-blended-addressbar-loadbar-mode/);
  assert.match(css, /#zen-loading-progress-bar/);
  assert.doesNotMatch(css, /uc\.loadbar\.mode", "hidden"/);
  assert.match(css, /:root\[data-blended-addressbar-loadbar-mode="progress"\]/);
  assert.match(css, /:root\[data-blended-addressbar-loadbar-mode="edge"\]/);
  assert.match(css, /:root\[data-blended-addressbar-loadbar-mode="glow"\]/);
  assert.doesNotMatch(css, /:root\[data-blended-addressbar-loadbar-mode="default"\]/);
  assert.doesNotMatch(css, /data-blended-addressbar-loadbar-mode="hidden"/);
  assert.match(css, /&\[long-load="false"\]/);
  assert.match(css, /&\[long-load="true"\]/);
  assert.match(css, /:root:has\(#zen-loading-progress-bar\[long-load="false"\]\)/);
  assert.match(css, /:root:has\(#zen-loading-progress-bar\[long-load="true"\]\)/);
  assert.doesNotMatch(css, /--blended-addressbar-loadbar-progress:\s*max\(var\(--blended-addressbar-loadbar-progress\)/);
  assert.match(css, /--blended-addressbar-dynamic-loadbar-color:\s*var\(--zen-tab-header-foreground,\s*var\(--blended-addressbar-page-loadbar-foreground,\s*var\(--blended-addressbar-loadbar-static-color,\s*var\(--zen-primary-color\)\)\)\)/);
  assert.match(css, /--blended-addressbar-loadbar-right-radius:\s*0px/);
  assert.match(css, /--blended-addressbar-loadbar-edge-top-offset:\s*0px/);
  assert.match(css, /@media \(-moz-bool-pref: "uc\.blended-addressbar\.frame-padding\.disabled"\)\s*\{\s*:root:not\(\[zen-single-toolbar="true"\]\)\s*\{[^}]*--blended-addressbar-loadbar-edge-top-offset:\s*var\(--blended-addressbar-loadbar-height,\s*2px\)/s);
  assert.match(css, /@media \(-moz-bool-pref: "uc\.loadbar\.roundedcorner"\)\s*\{[\s\S]*--blended-addressbar-loadbar-right-radius:\s*var\(--blended-addressbar-loadbar-height,\s*2px\)/);
  assert.match(css, /:root\[data-blended-addressbar-loadbar-focus-color="true"\]\s*\{[^}]*--blended-addressbar-dynamic-loadbar-color:\s*var\(--zen-primary-color\)/);
  assert.match(css, /--blended-addressbar-loadbar-glow-strong-mix:\s*34%/);
  assert.match(css, /--blended-addressbar-loadbar-glow-medium-mix:\s*18%/);
  assert.match(css, /--blended-addressbar-loadbar-glow-weak-mix:\s*7%/);
  assert.doesNotMatch(progressModeBlock, /--zen-loading-progress-bar-color/);
  assert.match(css, /--blended-addressbar-loadbar-track-color:\s*color-mix\(in srgb,\s*var\(--blended-addressbar-dynamic-loadbar-color\) 8%,\s*transparent\)/);
  assert.doesNotMatch(progressModeBlock, /--blended-addressbar-loadbar-static-color/);
  assert.match(progressModeBlock, /&::before\s*\{[\s\S]*background:\s*var\(--blended-addressbar-dynamic-loadbar-color\)\s*!important/);
  assert.match(progressModeBlock, /filter:\s*drop-shadow\(0 0 10px color-mix\(in srgb,\s*var\(--blended-addressbar-dynamic-loadbar-color\) 60%,\s*transparent\)\)\s*!important/);
  assert.match(css, /#zen-loading-progress-bar\s*\{[\s\S]*top:\s*0\s*!important[\s\S]*width:\s*100vw\s*!important[\s\S]*border-radius:\s*0\s*!important/);
  assert.match(css, /&::before\s*\{[\s\S]*border-radius:\s*0 var\(--blended-addressbar-loadbar-right-radius,\s*0px\) var\(--blended-addressbar-loadbar-right-radius,\s*0px\) 0\s*!important/);
  assert.doesNotMatch(css, /width 0\.35s ease-in-out/);
  assert.match(progressModeBlock, /width 0\.7s ease-in-out/);
  assert.match(edgeModeBlock, /#zen-loading-progress-bar\s*\{[^}]*display:\s*none\s*!important/);
  assert.match(edgeModeBlock, /#zen-appcontent-navbar-wrapper\s*\{[^}]*position:\s*relative\s*!important/);
  assert.match(edgeModeBlock, /#zen-appcontent-navbar-wrapper::before/);
  assert.match(edgeModeBlock, /#zen-appcontent-navbar-wrapper::after/);
  assert.match(edgeModeBlock, /#zen-appcontent-navbar-wrapper::before,\s*#zen-appcontent-navbar-wrapper::after,[\s\S]*&\[zen-single-toolbar="true"\] #zen-tabbox-wrapper::after\s*\{[\s\S]*position:\s*absolute\s*!important/);
  assert.match(edgeModeBlock, /#zen-appcontent-navbar-wrapper::before,\s*#zen-appcontent-navbar-wrapper::after,[\s\S]*&\[zen-single-toolbar="true"\] #zen-tabbox-wrapper::after\s*\{[\s\S]*width:\s*var\(--blended-addressbar-loadbar-progress\)\s*!important/);
  assert.match(edgeModeBlock, /#zen-appcontent-navbar-wrapper::before,\s*#zen-appcontent-navbar-wrapper::after,[\s\S]*&\[zen-single-toolbar="true"\] #zen-tabbox-wrapper::after\s*\{[\s\S]*max-width:\s*100%\s*!important/);
  assert.match(edgeModeBlock, /#zen-appcontent-navbar-wrapper::before,\s*&\[zen-single-toolbar="true"\] #zen-tabbox-wrapper::before\s*\{[\s\S]*top:\s*var\(--blended-addressbar-loadbar-edge-top-offset,\s*0px\)\s*!important/);
  assert.match(edgeModeBlock, /#zen-appcontent-navbar-wrapper::after,\s*&\[zen-single-toolbar="true"\] #zen-tabbox-wrapper::after\s*\{[\s\S]*top:\s*calc\(var\(--blended-addressbar-loadbar-edge-top-offset,\s*0px\) \+ var\(--blended-addressbar-loadbar-height,\s*2px\)\)\s*!important/);
  assert.doesNotMatch(edgeModeBlock, /#zen-loading-progress-bar::before/);
  assert.doesNotMatch(css, /#zen-appcontent-wrapper::before/);
  assert.doesNotMatch(css, /#zen-appcontent-wrapper::after/);
  assert.doesNotMatch(css, /#tabbrowser-tabpanels::before/);
  assert.doesNotMatch(css, /#tabbrowser-tabpanels::after/);
  assert.doesNotMatch(css, /#tabbrowser-tabpanels > \.browserSidebarContainer:not\(\.zen-glance-overlay\)::before/);
  assert.doesNotMatch(css, /#tabbrowser-tabpanels > \.browserSidebarContainer:not\(\.zen-glance-overlay\)::after/);
  assert.match(css, /max-width:\s*100%\s*!important/);
  assert.match(css, /background:\s*var\(--blended-addressbar-dynamic-loadbar-color\)\s*!important/);
  assert.doesNotMatch(edgeModeBlock, /#zen-appcontent-navbar-wrapper::before,\s*#zen-appcontent-navbar-wrapper::after,[^\{]*\{[^}]*opacity:\s*var\(--blended-addressbar-loadbar-opacity/);
  assert.doesNotMatch(edgeModeBlock, /#zen-appcontent-navbar-wrapper::before,\s*#zen-appcontent-navbar-wrapper::after,[^\{]*\{[^}]*border-radius:/);
  assert.match(edgeModeBlock, /#zen-appcontent-navbar-wrapper::before,\s*&\[zen-single-toolbar="true"\] #zen-tabbox-wrapper::before\s*\{[\s\S]*opacity:\s*var\(--blended-addressbar-loadbar-opacity,\s*1\)\s*!important/);
  assert.match(edgeModeBlock, /#zen-appcontent-navbar-wrapper::before,\s*&\[zen-single-toolbar="true"\] #zen-tabbox-wrapper::before\s*\{[\s\S]*border-radius:\s*0 var\(--blended-addressbar-loadbar-right-radius,\s*0px\) var\(--blended-addressbar-loadbar-right-radius,\s*0px\) 0\s*!important/);
  assert.match(edgeModeBlock, /#zen-appcontent-navbar-wrapper::before,\s*#zen-appcontent-navbar-wrapper::after,[\s\S]*&\[zen-single-toolbar="true"\] #zen-tabbox-wrapper::after\s*\{[\s\S]*width 0\.7s ease-in-out/s);
  assert.match(edgeModeBlock, /#zen-appcontent-navbar-wrapper::after,\s*&\[zen-single-toolbar="true"\] #zen-tabbox-wrapper::after\s*\{[\s\S]*height:\s*24px\s*!important/);
  assert.match(edgeModeBlock, /#zen-appcontent-navbar-wrapper::after,\s*&\[zen-single-toolbar="true"\] #zen-tabbox-wrapper::after\s*\{[\s\S]*opacity:\s*1\s*!important/);
  assert.match(edgeModeBlock, /&\[zen-single-toolbar="true"\] #zen-tabbox-wrapper::before/);
  assert.match(edgeModeBlock, /&\[zen-single-toolbar="true"\] #zen-tabbox-wrapper::after/);
  assert.match(edgeModeBlock, /&\[zen-single-toolbar="true"\] #zen-appcontent-navbar-wrapper::before,\s*&\[zen-single-toolbar="true"\] #zen-appcontent-navbar-wrapper::after\s*\{[^}]*content:\s*none\s*!important/s);
  assert.match(edgeModeBlock, /&\[zen-single-toolbar="true"\] #zen-tabbox-wrapper::before\s*\{[^}]*z-index:\s*4\s*!important/s);
  assert.match(edgeModeBlock, /&\[zen-single-toolbar="true"\] #zen-tabbox-wrapper::after\s*\{[^}]*z-index:\s*3\s*!important/s);
  assert.match(edgeModeBlock, /#zen-appcontent-navbar-wrapper::after,\s*&\[zen-single-toolbar="true"\] #zen-tabbox-wrapper::after\s*\{[\s\S]*background:\s*linear-gradient\(\s*to bottom,\s*color-mix\(in srgb,\s*var\(--blended-addressbar-dynamic-loadbar-color\) var\(--blended-addressbar-loadbar-glow-strong-mix,\s*34%\),\s*transparent\) 0%,\s*color-mix\(in srgb,\s*var\(--blended-addressbar-dynamic-loadbar-color\) var\(--blended-addressbar-loadbar-glow-medium-mix,\s*18%\),\s*transparent\) 36%,\s*color-mix\(in srgb,\s*var\(--blended-addressbar-dynamic-loadbar-color\) var\(--blended-addressbar-loadbar-glow-weak-mix,\s*7%\),\s*transparent\) 68%,\s*transparent 100%\s*\)\s*!important/s);
  assert.match(edgeModeBlock, /&:not\(:has\(\.tabbrowser-tab\[selected\]\[busy\]\)\) #zen-appcontent-navbar-wrapper::before,\s*&:not\(:has\(\.tabbrowser-tab\[selected\]\[busy\]\)\) #zen-appcontent-navbar-wrapper::after,[^\{]*\{[^}]*width:\s*0\s*!important;[^}]*opacity:\s*0\s*!important/s);
  assert.match(css, /radial-gradient\(ellipse 150px 32px at calc\(100% - 150px\)/);
  assert.match(css, /data-blended-loading/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /blended-addressbar-pane-address/);
  assert.match(css, /data-blended-addressbar-loadbar-iridescent="true"/);
  assert.match(css, /border-radius:\s*0\s*!important/);
  assert.doesNotMatch(css, /white\s+\d+%,\s*transparent/);
  assert.doesNotMatch(css, /color-mix\(in srgb,\s*var\(--blended-addressbar-dynamic-loadbar-color\) 40%,\s*transparent\)/);
  assert.doesNotMatch(css, /color-mix\(in srgb,\s*var\(--blended-addressbar-dynamic-loadbar-color\) (?:34|18|7)%,\s*transparent\)/);
  assert.doesNotMatch(css, /color-mix\(in srgb,\s*var\(--blended-addressbar-dynamic-loadbar-color\) 96%,\s*white 4%\)/);
  assert.doesNotMatch(css, /data-blended-addressbar-loadbar-mode="edge"[\s\S]*--blended-addressbar-loadbar-static-color/);
  assert.doesNotMatch(css, /data-blended-addressbar-loadbar-mode="glow"[\s\S]*--blended-addressbar-loadbar-static-color/);
  assert.doesNotMatch(css, /border-bottom:\s*var\(--blended-addressbar-loadbar-height/);
  assert.doesNotMatch(css, /mask-image:\s*linear-gradient\(to top,\s*black 0%,\s*black 72%,\s*transparent 100%\)/);
  assert.doesNotMatch(css, /mask-image:\s*linear-gradient\(90deg/);
  assert.match(css, /--blended-addressbar-loadbar-progress:\s*95%/);
  assert.doesNotMatch(css, /uc\.loadbar\.mode", "zen"/);
  assert.match(css, /:root\[inDOMFullscreen="true"\] #zen-loading-progress-bar/);
  assert.match(css, /:root\[inDOMFullscreen="true"\] #zen-loading-progress-bar/);
  assert.doesNotMatch(css, /\.browserSidebarContainer\.deck-selected::before/);
  assert.match(prefs, /uc\.loadbar\.mode/);
  assert.equal(loadbarModePreference.defaultValue, 'glow');
  assert.deepEqual(loadbarModePreference.options.map((option) => option.value), ['default', 'progress', 'glow', 'edge']);
  assert.deepEqual(loadbarModePreference.options.map((option) => option.label), ['Default', 'Progress bar', 'URL bar glow', 'Window edge']);
  assert.equal(loadbarColorSourcePreference, undefined);
  assert.equal(loadbarColorPreference.label, 'Fallback loadbar color');
  assert.equal(loadbarColorPreference.defaultValue, 'var(--zen-primary-color)');
  assert.equal(loadbarFocusColorPreference.label, 'Use focus color');
  assert.equal(loadbarFocusColorPreference.type, 'checkbox');
  assert.equal(loadbarFocusColorPreference.defaultValue, true);
  assert.equal(prefsJson.find((pref) => pref.property === 'uc.loadbar.height').defaultValue, '2px');
  assert.equal(prefsJson.find((pref) => pref.property === 'uc.loadbar.opacity').defaultValue, '100');
  assert.doesNotMatch(prefs, /uc\.loadbar\.color-source/);
  assert.doesNotMatch(prefs, /uc\.loadbar\.position/);
  assert.match(readme, /uc\.loadbar\.mode/);
  assert.match(readme, /Default keeps Zen's native loader/);
  assert.match(readme, /uc\.loadbar\.color`: fallback loadbar color when no page or header color is available/);
  assert.match(readme, /uc\.loadbar\.focus-color`: use the browser focus color for Progress bar, URL bar glow, and Window edge instead of the header foreground; enabled by default/);
  assert.match(readme, /uc\.loadbar\.height`: loading bar thickness for all custom loadbar styles/);
  assert.match(readme, /uc\.loadbar\.opacity`: loading bar body opacity and glow intensity for all custom loadbar styles/);
  assert.match(readme, /uc\.loadbar\.roundedcorner`: enable right-side rounded corners for Progress bar, URL bar glow, and Window edge/);
  assert.doesNotMatch(readme, /uc\.loadbar\.color-source/);
  assert.doesNotMatch(readme, /Sine's built-in None/);
  assert.doesNotMatch(readme, /choose Hidden/);
  assert.doesNotMatch(readme, /uc\.loadbar\.position/);
});

test('theme debug attributes are written through one helper', () => {
  const script = read('blended-bar.uc.js');

  assert.match(script, /function setThemeDebugAttributes\(reason = '',\s*theme = null,\s*href = ''\)/);
  assert.equal(countOccurrences(script, "setAttribute('data-blended-addressbar-theme-reason'"), 1);
  assert.equal(countOccurrences(script, "setAttribute('data-blended-addressbar-theme-bridge'"), 1);
  assert.equal(countOccurrences(script, "setAttribute('data-blended-addressbar-theme-source'"), 1);
  assert.equal(countOccurrences(script, "setAttribute('data-blended-addressbar-theme-bg'"), 1);
  assert.equal(countOccurrences(script, "setAttribute('data-blended-addressbar-theme-fg'"), 1);
  assert.equal(countOccurrences(script, "setAttribute('data-blended-addressbar-theme-href'"), 1);
  assert.match(script, /setThemeDebugAttributes\(reason,\s*null,\s*href\)/);
  assert.match(script, /setThemeDebugAttributes\(reason,\s*theme,\s*href\)/);
  assert.match(script, /setThemeDebugAttributes\(reason,\s*theme,\s*theme\.href \|\| ''\)/);
});

test('pane radius updates skip unchanged per-pane style writes', () => {
  const script = read('scripts/pane-layout.js');

  assert.match(script, /function setPaneCornerRadius\(pane,\s*property,\s*shouldRound,\s*radius\)\s*\{[\s\S]*setStylePropertyIfChanged\(pane\.style,\s*property,\s*shouldRound \? radius : '0px'\)/);
  assert.match(script, /setPaneCornerRadius\(pane,\s*'--blended-addressbar-split-radius-top-left',\s*allowTopRadius && touchesTop && touchesLeft && !sidebarBlocksLeftEdge && !hasPaneNeighborAtCorner\(cornerNeighborRects,\s*pane,\s*rect,\s*'top-left',\s*tolerance\),\s*radius\)/);
  assert.match(script, /setPaneCornerRadius\(pane,\s*'--blended-addressbar-split-radius-bottom-right',\s*touchesBottom && touchesRight && !sidebarBlocksRightEdge && !hasPaneNeighborAtCorner\(cornerNeighborRects,\s*pane,\s*rect,\s*'bottom-right',\s*tolerance\),\s*radius\)/);
  assert.doesNotMatch(script, /pane\.style\.setProperty\('--blended-addressbar-split-radius-top-left'/);
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
  assert.doesNotMatch(script, /getCachedHostTheme\(browser\)/);
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
  assert.match(script, /messageManager\.loadFrameScript\(themeFrameScriptUrl,\s*false,\s*true\)/);
  assert.match(script, /requestPersistentFrameTheme\(browser,\s*zenBoostActive \|\| deferRememberedFallback \|\| !cachedTheme\)/);
  assert.match(script, /gBrowser\.tabContainer\.addEventListener\('TabClose'/);

  assert.match(frame, /const MESSAGE_NAME = 'blended-addressbar:persistent-theme'/);
  assert.match(frame, /content\.__blended_addressbar_frame_inited/);
  assert.match(frame, /const PIXEL_SAMPLE_WIDTH = 256/);
  assert.match(frame, /const PIXEL_SAMPLE_HEIGHT = 8/);
  assert.match(frame, /getDominantSampleColor\(data\)/);
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

test('cached tab switches request a fresh page sample before using remembered fallbacks', () => {
  const script = read('blended-bar.uc.js');

  assert.match(script, /gBrowser\.tabContainer\.addEventListener\('TabSelect', \(\) => \{[^}]*scheduleActiveUpdate\(\{ reason: 'tab-select', keepCachedTheme: true \}\)/s);
  assert.match(script, /keepCachedTheme = false/);
  assert.match(script, /const deferRememberedFallback = keepCachedTheme\s+&& !zenBoostActive/);
  assert.match(script, /const hasStableCachedTabTheme = keepCachedTheme\s+&& !zenBoostActive\s+&& !deferRememberedFallback\s+&& \(targetCachedThemeApplied \|\| retainedHostThemeApplied\)/);
  assert.match(script, /if \(hasStableCachedTabTheme\) return/);
  assert.match(script, /if \(zenBoostActive\) requestPersistentFrameTheme\(browser,\s*true\)/);
  assert.match(script, /requestPersistentFrameTheme\(browser,\s*zenBoostActive \|\| deferRememberedFallback \|\| !cachedTheme\)/);
});

test('cached tab switches do not short-circuit while remembered fallbacks are deferred', () => {
  const script = read('blended-bar.uc.js');

  assert.match(script, /const targetCachedThemeApplied = !deferRememberedFallback && targetCachedTheme\s*\?\s*applyResolvedTheme\(browser,\s*targetCachedTheme,\s*'target-cache',\s*expectedHref,\s*\{[\s\S]*requireRendered:\s*zenBoostActive[\s\S]*\}\)\s*:\s*false/);
  assert.match(script, /const retainedHostThemeApplied = !deferRememberedFallback && retainedHostTheme\s*\?\s*applyResolvedTheme\(browser,\s*retainedHostTheme,\s*'same-host-retained',\s*expectedHref,\s*\{[\s\S]*requireRendered:\s*zenBoostActive[\s\S]*\}\)\s*:\s*false/);
  assert.match(script, /const hasStableCachedTabTheme = keepCachedTheme\s+&& !zenBoostActive\s+&& !deferRememberedFallback\s+&& \(targetCachedThemeApplied \|\| retainedHostThemeApplied\)/);
  assert.doesNotMatch(script, /const hasStableCachedTabTheme = keepCachedTheme\s+&& !zenBoostActive\s+&& !!\(targetCachedTheme \|\| retainedHostTheme\)/);
});

test('uncached tab switches skip initial neutral flash and delay neutral fallback after lookup misses', () => {
  const script = read('blended-bar.uc.js');

  assert.match(script, /const deferUnknownFallback = keepCachedTheme\s+&& !zenBoostActive/);
  assert.match(script, /if \(isLoadingThemeFor\(browser\) && !cachedTheme && !retainedHostTheme && !deferUnknownFallback\)/);
  assert.match(script, /else if \(!cachedTheme && !retainedHostTheme && !skipToolbarFallback && !deferUnknownFallback\)/);
  assert.match(script, /scheduleDelayedThemeFallback\(browser,\s*getNeutralHeaderShade\(browser,\s*'unknown-page'\),\s*reason,\s*expectedHref,\s*\{ headerOnly: true \}\)/);
  assert.doesNotMatch(script, /else if \(!retainedHostTheme && !skipToolbarFallback\)/);
  assert.match(script, /requestPersistentFrameTheme\(browser,\s*zenBoostActive \|\| deferRememberedFallback \|\| !cachedTheme\)/);
  assert.doesNotMatch(script, /if \(isLoadingThemeFor\(browser\) && !cachedTheme && !retainedHostTheme\) \{\s*applyHeaderOnlyTheme\(browser,\s*getNeutralHeaderShade\(browser,\s*'loading-unknown'\)/s);
});

test('tab-switch header-only fallbacks are ignored after href changes', () => {
  const script = read('blended-bar.uc.js');

  assert.match(script, /function applyHeaderOnlyTheme\(browser,\s*theme,\s*reason = 'header-only',\s*expectedHref = null\)/);
  assert.match(script, /if \(expectedHref && getBrowserHref\(browser\) !== expectedHref\) return false/);
  assert.match(script, /applyHeaderOnlyTheme\(browser,\s*getNeutralHeaderShade\(browser,\s*'loading-unknown'\),\s*'loading-unknown',\s*expectedHref\)/);
  assert.match(script, /applyHeaderOnlyTheme\(browser,\s*getNeutralHeaderShade\(browser,\s*'unknown-page'\),\s*'unknown-page',\s*expectedHref\)/);
  assert.match(script, /applyHeaderOnlyTheme\(browser,\s*getNeutralHeaderShade\(browser,\s*'unknown-page'\),\s*reason,\s*expectedHref\)/);
});

test('color source policies are centralized before candidate arbitration', () => {
  const script = `${read('blended-bar.uc.js')}\n${read('scripts/theme-source-policy.js')}`;

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
  const script = `${read('blended-bar.uc.js')}\n${read('scripts/theme-source-policy.js')}`;

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
  const script = `${read('blended-bar.uc.js')}\n${read('scripts/theme-source-policy.js')}`;

  assert.match(script, /let zenBoostMutationObserver = null/);
  assert.match(script, /let lastZenBoostActive = false/);
  assert.match(script, /function isZenBoostActive\(\)/);
  assert.match(script, /getElementById\('zen-site-data-icon-button'\)\?\.hasAttribute\('boosting'\)/);
  assert.match(script, /function clearActivePageThemeCache\(browser = gBrowser\?\.selectedBrowser \|\| null\)/);
  assert.match(script, /themeCache\.delete\(browser\)/);
  assert.match(script, /pageThemeCache\.delete\(pageKey\)/);
  assert.doesNotMatch(script, /hostThemeCache\.delete\(hostKey\)/);
  assert.doesNotMatch(script, /persistHostThemeCache\(\)/);
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
  assert.match(script, /requestPersistentFrameTheme\(browser,\s*zenBoostActive \|\| deferRememberedFallback \|\| !cachedTheme\)/);
});

test('Zen Boost active state requires pixel-derived color sources', () => {
  const script = `${read('blended-bar.uc.js')}\n${read('scripts/theme-source-policy.js')}`;

  assert.match(script, /function isPixelThemeSource\(source\)/);
  assert.match(script, /const pixelThemeSources = Object\.freeze\(new Set\(\[\s*'pixel-top-edge',\s*'pixel',\s*'sampler'\s*\]\)\)/);
  assert.match(script, /requirePixel:\s*options\.requirePixel \?\? \(options\.boostActive \?\? isZenBoostActive\(\)\)/);
  assert.match(script, /const requirePixelTheme = requirePixel && !isPixelThemeSource\(theme\)/);
  assert.match(script, /if \(requirePixelTheme\) \{\s*return \{ action: 'ignore', confidence, key \};\s*\}/);
  assert.match(script, /resolveContext\.requirePixel && !isPixelThemeSource\(theme\)/);
  assert.match(script, /requirePixel:\s*queued\.options\?\.requirePixel \?\? false/);
  assert.match(script, /sourceName === 'host-cache' && isPixelThemeSource\(getCachedColorSourceName\(source\)\)/);
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
  assert.match(script, /function applyHeaderOnlyTheme\(browser,\s*theme,\s*reason = 'header-only',\s*expectedHref = null\)/);
  assert.match(script, /function applyHeaderOnlyTheme\(browser,\s*theme,\s*reason = 'header-only',\s*expectedHref = null\)[\s\S]*const key = getThemeKey\(theme\);\s*if \(key === lastThemeKey && getCurrentFrameBackground\(\) === 'transparent'\) \{\s*lastAppliedTheme = theme;\s*return true;\s*\}/);
  assert.match(script, /setVar\(theme\.bg,\s*theme\.fg\)/);
  assert.match(script, /clearWindowTintBackground\(\)/);
  assert.match(script, /setStylePropertyIfChanged\(chromeDoc\.documentElement\.style,\s*'--blended-addressbar-frame-background',\s*'transparent',\s*'important'\)/);
  assert.match(script, /if \(isLoadingThemeFor\(browser\) && !cachedTheme && !retainedHostTheme && !deferUnknownFallback\) \{\s*requestPersistentFrameTheme\(browser,\s*true\);\s*applyHeaderOnlyTheme\(browser,\s*getNeutralHeaderShade\(browser,\s*'loading-unknown'\),\s*'loading-unknown',\s*expectedHref\);\s*void sampleRenderedTheme\(browser\);\s*return;\s*\}/s);
  assert.match(script, /applyHeaderOnlyTheme\(browser,\s*getNeutralHeaderShade\(browser,\s*'unknown-page'\),\s*'unknown-page',\s*expectedHref\)/);
  assert.match(script, /applyHeaderOnlyTheme\(browser,\s*getNeutralHeaderShade\(browser,\s*'unknown-page'\),\s*reason,\s*expectedHref\)/);
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
  const urlbarIconSelector = cssSelectorPrelude(css, '#urlbar:not([zen-floating-urlbar="true"]) #urlbar-input-container');
  const urlbarIconBlock = cssRuleBlock(css, '#urlbar:not([zen-floating-urlbar="true"]) #urlbar-input-container :is(#identity-box');
  const unscopedChromeIconSelector = cssSelectorPrelude(css, '#navigator-toolbox:not([tabs-hidden]) :is(');
  const unscopedChromeIconBlock = cssRuleBlock(css, '#navigator-toolbox:not([tabs-hidden]) :is(');
  const zenSiteDataButtonBlock = cssRuleBlock(css, '#navigator-toolbox:not([tabs-hidden]) #zen-site-data-icon-button.identity-box-button');
  assert.match(urlbarIconSelector, /\.urlbar-page-action/);
  assert.match(urlbarIconSelector, /\.identity-box-button/);
  assert.match(urlbarIconSelector, /\.urlbar-icon/);
  assert.match(urlbarIconSelector, /#identity-box/);
  assert.match(urlbarIconSelector, /#tracking-protection-icon-container/);
  assert.match(urlbarIconSelector, /#zen-site-data-icon-button/);
  assert.match(urlbarIconBlock, /fill-opacity:\s*1\s*!important/);
  assert.match(urlbarIconBlock, /--toolbarbutton-icon-fill:\s*currentColor\s*!important/);
  assert.match(urlbarIconBlock, /--urlbar-icon-fill-opacity:\s*1/);
  assert.match(unscopedChromeIconSelector, /#nav-bar-customization-target > :not\(#urlbar-container\)/);
  assert.match(unscopedChromeIconSelector, /#zen-copy-url-button[\s\S]*:is\(\.urlbar-icon,\s*image\)/);
  assert.match(unscopedChromeIconBlock, /color:\s*var\(--zen-tab-header-foreground,\s*inherit\)\s*!important/);
  assert.match(unscopedChromeIconBlock, /fill:\s*currentColor\s*!important/);
  assert.match(zenSiteDataButtonBlock, /color:\s*var\(--zen-tab-header-foreground,\s*inherit\)\s*!important/);
  assert.match(zenSiteDataButtonBlock, /--toolbarbutton-icon-fill:\s*currentColor\s*!important/);
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

test('non-boost site properties icon follows adaptive header colors while boost keeps native coloring', () => {
  const css = readStyleWithImports();
  const nonBoostButtonBlock = cssRuleBlock(css, '#zen-site-data-icon-button:not([boosting])');

  assert.match(nonBoostButtonBlock, /color:\s*var\(--zen-tab-header-foreground,\s*currentColor\)\s*!important/);
  assert.match(nonBoostButtonBlock, /fill:\s*currentColor\s*!important/);
  assert.match(nonBoostButtonBlock, /fill-opacity:\s*1\s*!important/);
  assert.match(nonBoostButtonBlock, /stroke:\s*currentColor\s*!important/);
  assert.match(nonBoostButtonBlock, /stroke-opacity:\s*1\s*!important/);
  assert.match(nonBoostButtonBlock, /--toolbarbutton-icon-fill:\s*currentColor\s*!important/);
  assert.match(nonBoostButtonBlock, /--urlbar-icon-fill-opacity:\s*1\s*!important/);
  assert.match(css, /#zen-site-data-icon-button\[boosting\] image/);
  assert.doesNotMatch(nonBoostButtonBlock, /\[boosting\]/);
});

test('bookmark toolbar popups use native colors and keep compact corners', () => {
  const css = read('style.css');
  const popupSelector = 'menupopup[placespopup="true"]';
  const popupBlock = cssRuleBlock(css, popupSelector);
  const popupContentBlock = cssRuleBlock(css, `${popupSelector}::part(content)`);
  const popupItemBlock = cssRuleBlock(css, `${popupSelector} :is(menu, menuitem, .menu-iconic, .menuitem-iconic, .menu-iconic-text, .menuitem-iconic-text, .menu-text, .menuitem-text, .bookmark-item)`);
  const popupIconBlock = cssRuleBlock(css, `${popupSelector} .menu-icon`);
  const disabledPopupItemBlock = cssRuleBlock(css, `${popupSelector} :is(menu, menuitem, .bookmark-item):is([disabled], [disabled="true"])`);
  const folderButtonBlock = cssRuleBlock(css, '#PersonalToolbar #PlacesToolbarItems > toolbarbutton.bookmark-item');

  assert.match(css, /--blended-addressbar-bookmark-popup-radius:\s*8px/);
  assert.match(css, /(?:^|\n)menupopup\[placespopup="true"\]\s*\{/);
  assert.doesNotMatch(css, /#PersonalToolbar toolbarbutton\.bookmark-item\s*>\s*menupopup(?:\.toolbar-menupopup)?\[placespopup="true"\]/);
  assert.match(popupBlock, /background:\s*Menu\s*!important/);
  assert.match(popupBlock, /--panel-background:\s*Menu\s*!important/);
  assert.match(popupBlock, /--panel-color:\s*MenuText\s*!important/);
  assert.match(popupBlock, /--panel-background-color:\s*Menu\s*!important/);
  assert.match(popupBlock, /--panel-text-color:\s*MenuText\s*!important/);
  assert.match(popupBlock, /--background-color-canvas:\s*Menu\s*!important/);
  assert.match(popupBlock, /--menuitem-icon-fill:\s*MenuText\s*!important/);
  assert.match(popupBlock, /--arrowpanel-background:\s*Menu\s*!important/);
  assert.match(popupBlock, /--arrowpanel-color:\s*MenuText\s*!important/);
  assert.match(popupBlock, /--panel-border-radius:\s*var\(--blended-addressbar-bookmark-popup-radius\)\s*!important/);
  assert.match(popupBlock, /transition:\s*none\s*!important/);
  assert.match(popupContentBlock, /background:\s*Menu\s*!important/);
  assert.match(popupContentBlock, /color:\s*MenuText\s*!important/);
  assert.match(popupContentBlock, /border-radius:\s*var\(--blended-addressbar-bookmark-popup-radius\)\s*!important/);
  assert.match(popupContentBlock, /overflow:\s*hidden\s*!important/);
  assert.match(popupContentBlock, /transition:\s*none\s*!important/);
  assert.match(popupItemBlock, /color:\s*MenuText\s*!important/);
  assert.match(css, /menupopup\[placespopup="true"\][\s\S]*\.menu-iconic-text/);
  assert.match(popupItemBlock, /--toolbarbutton-icon-fill:\s*currentColor/);
  assert.match(popupIconBlock, /fill:\s*MenuText\s*!important/);
  assert.match(disabledPopupItemBlock, /color:\s*GrayText\s*!important/);
  assert.doesNotMatch(popupBlock, /var\(--zen-tab-header-(?:background|foreground)/);
  assert.match(folderButtonBlock, /transition:\s*none\s*!important/);
});

test('addressbar and bookmarks separator can be collapsed to one visible line', () => {
  const css = read('style.css');
  const prefs = read('preferences.json');
  const readme = read('README.md');
  const prefsJson = JSON.parse(prefs);
  const separatorPreference = prefsJson.find((pref) => pref.property === 'uc.blended-addressbar.addressbar-bookmarks-separator.disabled');

  assert.equal(separatorPreference.type, 'checkbox');
  assert.equal(separatorPreference.label, 'Remove addressbar/bookmarks separator');
  assert.match(css, /--blended-addressbar-toolbar-separator-shadow:\s*0 -1px 0 0 inset rgba\(128,\s*128,\s*128,\s*0\.09\)/);
  assert.match(css, /#nav-bar\s*\{[\s\S]*box-shadow:\s*var\(--blended-addressbar-toolbar-separator-shadow\)/);
  assert.match(css, /#nav-bar:not\(\[hidden\]\):not\(\[collapsed="true"\]\) \+ #PersonalToolbar:not\(\[hidden\]\):not\(\[collapsed="true"\]\)\s*\{[\s\S]*box-shadow:\s*var\(--blended-addressbar-toolbar-separator-shadow\)/);
  assert.match(css, /@media \(-moz-bool-pref:\s*"uc\.blended-addressbar\.addressbar-bookmarks-separator\.disabled"\)\s*\{[\s\S]*#nav-bar:not\(\[hidden\]\):not\(\[collapsed="true"\]\):has\(\+ #PersonalToolbar:not\(\[hidden\]\):not\(\[collapsed="true"\]\)\)\s*\{[\s\S]*box-shadow:\s*none\s*!important/s);
  assert.doesNotMatch(css, /@media \(-moz-bool-pref:\s*"uc\.blended-addressbar\.addressbar-bookmarks-separator\.disabled"\)\s*\{[\s\S]*#nav-bar:not\(\[hidden\]\):not\(\[collapsed="true"\]\) \+ #PersonalToolbar:not\(\[hidden\]\):not\(\[collapsed="true"\]\)\s*\{[\s\S]*box-shadow:\s*none\s*!important/s);
  assert.match(readme, /uc\.blended-addressbar\.addressbar-bookmarks-separator\.disabled/);
});

test('frame highlight overlays are added once per frame and ignore missing frames', () => {
  const script = read('blended-bar.uc.js');
  const loop = script.match(/    for \(const id of \['zen-appcontent-wrapper', 'zen-tabbox-wrapper'\]\) \{[\s\S]*?frame\.appendChild\(highlight\);\n    \}/)[0];
  const frames = new Map(['zen-appcontent-wrapper', 'zen-tabbox-wrapper'].map(id => [id, {
    children: [],
    querySelector() { return this.children[0]; },
    appendChild(child) { this.children.push(child); }
  }]));
  const chromeDoc = {
    getElementById: id => frames.get(id),
    createElement: () => ({ setAttribute(name, value) { this[name] = value; } })
  };
  vm.runInNewContext(loop, { chromeDoc });
  vm.runInNewContext(loop, { chromeDoc });
  for (const frame of frames.values()) {
    assert.equal(frame.children.length, 1);
    assert.equal(frame.children[0].className, 'blended-addressbar-frame-highlight');
    assert.equal(frame.children[0]['aria-hidden'], 'true');
  }
  frames.clear();
  assert.doesNotThrow(() => vm.runInNewContext(loop, { chromeDoc }));
  const css = read('style.css');
  assert.match(css, /> \.blended-addressbar-frame-highlight\s*\{[^}]*position: absolute;[^}]*inset: 0;[^}]*z-index: 5;[^}]*border-radius: inherit;[^}]*box-shadow: inset 0 0 0 0\.5pt rgba\(255, 255, 255, 0\.15\);[^}]*pointer-events: none;/);
});

test('selected split panes use a click-through inset accent instead of the native outline', () => {
  const css = read('style.css');
  const selector = ':root:not([inDOMFullscreen="true"]) #tabbrowser-tabpanels[zen-split-view="true"] > .browserSidebarContainer[zen-split="true"].deck-selected:not(.zen-glance-overlay)';
  const rule = css.slice(css.indexOf(selector));
  assert.ok(css.includes(selector));
  assert.match(rule, /outline: none !important;/);
  assert.match(rule, /box-shadow: inset 0 0 0 1\.5pt var\(--zen-active-split-outline-color, var\(--zen-primary-color\)\), var\(--blended-addressbar-pane-inner-highlight\);/);
});

test('shared page clipping follows visible bounds on every side', () => {
  const rect = (left, top, right, bottom) => ({ left, top, right, bottom, width: right - left, height: bottom - top });
  const content = {
    children: [], querySelector() { return this.children[0]; },
    appendChild(child) { this.children.push(child); }
  };
  const pane = {
    style: {}, getBoundingClientRect: () => rect(0, 0, 110, 110),
    querySelector(selector) { return selector === ':scope > .browserContainer' ? content : null; }
  };
  const panels = { getBoundingClientRect: () => rect(0, 0, 110, 110), getAttribute: () => 'true' };
  const wrapper = { getBoundingClientRect: () => rect(5, 6, 100, 98) };
  const layout = loadScriptModule('pane-layout.js', {
    chromeDoc: {
      getElementById: id => ({ 'tabbrowser-tabpanels': panels, 'zen-tabbox-wrapper': wrapper })[id],
      querySelectorAll: () => [pane],
      createElement: () => ({ setAttribute(name, value) { this[name] = value; } })
    },
    setStylePropertyIfChanged: (style, key, value) => { style[key] = value; },
    removeStylePropertyIfChanged: (style, key) => { delete style[key]; }
  });
  layout.updatePaneCornerRadii();
  assert.equal(pane.style['--blended-addressbar-pane-clip-inset'], '6px 10px 12px 5px');
  const radius = 'var(--blended-addressbar-frame-radius)';
  assert.equal(pane.style['--blended-addressbar-pane-clip-radius'], [radius, radius, radius, radius].join(' '));
  for (const [bounds, expected] of [
    [rect(0, 0, 50, 110), [radius, '0px', '0px', radius]],
    [rect(50, 0, 110, 110), ['0px', radius, radius, '0px']],
    [rect(0, 0, 110, 50), [radius, radius, '0px', '0px']],
    [rect(0, 50, 110, 110), ['0px', '0px', radius, radius]]
  ]) {
    pane.getBoundingClientRect = () => bounds;
    layout.updatePaneCornerRadii();
    assert.equal(pane.style['--blended-addressbar-pane-clip-radius'], expected.join(' '));
  }
  pane.getBoundingClientRect = () => rect(20, 20, 80, 80);
  layout.updatePaneCornerRadii();
  assert.equal(pane.style['--blended-addressbar-pane-clip-inset'], '0px 0px 0px 0px');
  assert.equal(pane.style['--blended-addressbar-pane-clip-radius'], '0px 0px 0px 0px');
  assert.equal(content.children.length, 1);
  assert.equal(content.children[0].className, 'blended-addressbar-pane-highlight');
  assert.equal(content.children[0]['aria-hidden'], 'true');
});

test('split view suppresses the overlapping white frame highlight', () => {
  assert.match(read('style.css'), /&:has\(#tabbrowser-tabpanels\[zen-split-view="true"\]\) > \.blended-addressbar-frame-highlight\s*\{\s*display: none;/);
});

test('page content and focus overlay share clipping and corner geometry', () => {
  const css = read('style.css');
  const shared = css.slice(css.indexOf('/* Clip the page and its inner-shadow'));
  assert.match(shared, /> \.browserContainer\s*\{[^}]*border-radius: var\(--blended-addressbar-pane-clip-radius, 0\) !important;[^}]*corner-shape: superellipse\(var\(--zen-squircle-value, 1\.3\)\);[^}]*overflow: hidden !important;/);
  assert.match(shared, /> \.blended-addressbar-pane-highlight\s*\{[^}]*inset: 0;[^}]*border-radius: inherit;[^}]*corner-shape: inherit;/);
  assert.doesNotMatch(css, /--blended-addressbar-split-highlight-(inset|radius)/);
});

test('split clipping uses Zen curvature without a separate shape preference', () => {
  const css = readStyleWithImports();
  assert.doesNotMatch(css, /--zen-squircle-value\s*:|--blended-addressbar-corner-shape/);
  assert.equal(JSON.parse(read('preferences.json')).some(pref => pref.property === 'uc.blended-addressbar.frame-squircle.enabled'), false);
  assert.match(read('README.md'), /layout\.css\.corner-shape\.enabled/);
  assert.match(read('README.md'), /--zen-squircle-value/);
});

test('Only Sidebar retains the optional native bookmarks separator', () => {
  assert.match(read('style.css'), /@media not \(-moz-bool-pref: "uc\.blended-addressbar\.addressbar-bookmarks-separator\.disabled"\)\s*\{\s*#PersonalToolbar:not\(\[hidden\]\):not\(\[collapsed\]\)\s*\{\s*box-shadow:\s*var\(--blended-addressbar-toolbar-separator-shadow\)\s*!important/s);
});

test('dominant sampling ignores transparent pixels and minority text instead of mixing them into the background', () => {
  const { getDominantSampleColor } = loadScriptModule('color-sampling.js');
  const pixels = new Uint8ClampedArray([
    32, 64, 96, 255, 34, 65, 97, 255, 33, 64, 96, 255,
    255, 255, 255, 255, 255, 0, 0, 0
  ]);
  const color = getDominantSampleColor(pixels);
  assert.equal(color.r, 33);
  assert.equal(color.g, 64);
  assert.equal(color.b, 96);
  assert.equal(color.a, 1);
  assert.equal(color.share, 0.75);
  assert.equal(getDominantSampleColor(new Uint8ClampedArray(8)), null);
  assert.equal(getDominantSampleColor([]), null);
});

test('loading progress remains monotonic, finishes and cannot revive after completion', () => {
  const { createLoadProgress, advanceLoadProgress, finishLoadProgress } = loadScriptModule('loadbar.js');
  const state = createLoadProgress();
  advanceLoadProgress(state, 0.7);
  assert.equal(state.progress, 0.7);
  advanceLoadProgress(state, 0.2);
  assert.equal(state.progress, 0.7);
  for (let i = 0; i < 500; i++) advanceLoadProgress(state);
  assert.ok(state.progress <= 0.95);
  finishLoadProgress(state, 1000);
  assert.equal(state.progress, 1);
  assert.equal(state.loading, false);
  advanceLoadProgress(state, 0.5);
  assert.equal(state.progress, 1);
  assert.equal(state.hideAt, 1450);
});

test('split addresses preserve the host and keep full URLs available without credentials', () => {
  const { formatAddress } = loadScriptModule('split-addressbars.js');
  assert.equal(formatAddress('https://example.com/path?q=1#part').host, 'example.com');
  assert.equal(formatAddress('https://example.com/path?q=1#part').path, '/path?q=1#part');
  assert.equal(formatAddress('https://user:secret@example.com/path').full, 'https://example.com/path');
  assert.equal(formatAddress('about:preferences').host, 'about:preferences');
  assert.equal(formatAddress('not a URL').host, 'not a URL');
});

test('split controls route to their browser, reject stale colors and clean up without moving page nodes', () => {
  function element() {
    const attrs = new Map();
    const node = {
      style: { getPropertyValue: name => attrs.get(name) || '', getPropertyPriority: () => '',
        setProperty: (name, value) => attrs.set(name, value), removeProperty: name => attrs.delete(name) },
      children: [], textContent: '', handlers: {},
      setAttribute: (name, value) => attrs.set(name, value),
      getAttribute: name => attrs.get(name) ?? null,
      hasAttribute: name => attrs.has(name),
      addEventListener(name, callback) { this.handlers[name] = callback; },
      append(...children) { this.children.push(...children); children.forEach(child => child.parentNode = this); },
      prepend(child) { this.children.unshift(child); child.parentNode = this; },
      remove() { this.parentNode.children = this.parentNode.children.filter(child => child !== this); }
    };
    return node;
  }
  const calls = [];
  const tab = element();
  const panes = ['/red', '/blue'].map(path => {
    const holder = element();
    const browser = { currentURI: { spec: `https://example.com${path}` },
      reload: () => calls.push(`reload${path}`), stop: () => calls.push(`stop${path}`) };
    holder.append(browser);
    holder.querySelector = () => browser;
    return { browser, holder, querySelector: () => holder };
  });
  const colors = loadScriptModule('color-utils.js');
  const mod = loadScriptModule('split-addressbars.js', {
    chromeDoc: { createElementNS: () => element() }, getTab: () => tab,
    openAddress: browser => calls.push(browser.currentURI.spec),
    copyAddress: browser => calls.push(`copy ${browser.currentURI.spec}`),
    openSite: browser => calls.push(`site ${browser.currentURI.spec}`),
    getReadableForeground: colors.getReadableForeground, ...loadScriptModule('style-state.js')
  });
  assert.equal(mod.sync(panes).length, 2);
  assert.equal(mod.sync(panes).length, 0);
  for (const [i, pane] of panes.entries()) {
    mod.applyTheme(pane.browser, { href: pane.browser.currentURI.spec, bg: i ? 'rgb(240, 240, 240)' : 'rgb(32, 32, 32)' });
    assert.equal(pane.browser.parentNode, pane.holder);
  }
  const left = mod.bars.get(panes[0].browser);
  const right = mod.bars.get(panes[1].browser);
  assert.notEqual(left.bar.style.getPropertyValue('--blended-addressbar-pane-background'), right.bar.style.getPropertyValue('--blended-addressbar-pane-background'));
  assert.notEqual(left.bar.style.getPropertyValue('--blended-addressbar-pane-foreground'), right.bar.style.getPropertyValue('--blended-addressbar-pane-foreground'));
  right.address.handlers.click();
  right.reload.handlers.click();
  right.copy.handlers.click();
  left.site.handlers.click();
  tab.setAttribute('busy', 'true');
  left.reload.handlers.click();
  assert.deepEqual(calls, ['https://example.com/blue', 'reload/blue', 'copy https://example.com/blue', 'site https://example.com/red', 'stop/red']);
  panes[0].browser.currentURI.spec = 'https://example.com/green';
  mod.update(panes[0].browser);
  mod.applyTheme(panes[0].browser, { href: 'https://example.com/red', bg: 'rgb(255, 0, 0)' });
  assert.equal(left.bar.style.getPropertyValue('--blended-addressbar-pane-background'), '');
  mod.sync([]);
  assert.equal(mod.bars.size, 0);
  assert.equal(panes[0].holder.children.length, 1);
});

test('split layout reserves a local row and glow remains optional and accessible', () => {
  const css = readStyleWithImports();
  const script = read('blended-bar.uc.js');
  const prefs = JSON.parse(read('preferences.json'));
  assert.match(css, /margin-block-start:\s*var\(--blended-addressbar-pane-bar-height\)/);
  assert.match(css, /grid-area:\s*browserstack/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /:where\(#urlbar[^}]+\.blended-addressbar-pane-field\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(script, /renderedSampleRequests\.get\(browser\) !== request/);
  assert.match(script, /currentWindowGlobal !== documentGlobal/);
  assert.match(script, /if \(isPixelThemeSource\(theme\)\) splitAddressbars\.applyTheme/);
  assert.equal(prefs.find(pref => pref.property === 'uc.loadbar.iridescent').defaultValue, false);
  assert.match(read('README.md'), /uc\.loadbar\.iridescent/);
});

test('pane sampling replaces in-flight requests after same-document navigation', async () => {
  const browser = { currentURI: { spec: 'https://example.com/old' }, browsingContext: { currentWindowGlobal: {} } };
  const pending = [];
  const applied = [];
  const context = {
    addressbarEnhancementsDisposed: false,
    renderedSampleRequests: new Map(),
    gBrowser: { selectedBrowser: null },
    splitAddressbars: { bars: new Map([[browser, {}]]), applyTheme: (_browser, theme) => applied.push(theme) },
    getBrowserHref: target => target.currentURI.spec,
    isPageThemeEligibleHref: () => true,
    sampleTabPanelsPixel: () => new Promise(resolve => pending.push(resolve)),
    getSampledTheme: result => result,
    cacheTheme: () => {}
  };
  const script = read('blended-bar.uc.js');
  const start = script.indexOf('  async function sampleRenderedTheme(');
  const end = script.indexOf('  function refreshSplitAddressbars(', start);
  vm.createContext(context);
  vm.runInContext(script.slice(start, end), context);
  const oldSample = context.sampleRenderedTheme(browser);
  browser.currentURI.spec = 'https://example.com/new';
  const newSample = context.sampleRenderedTheme(browser);
  assert.equal(pending.length, 2);
  pending[0]({ href: 'https://example.com/old', bg: 'red' });
  pending[1]({ href: 'https://example.com/new', bg: 'blue' });
  await Promise.all([oldSample, newSample]);
  assert.equal(applied.length, 1);
  assert.equal(applied[0].href, 'https://example.com/new');
  assert.equal(applied[0].bg, 'blue');
  assert.equal(applied[0].source, 'pixel-top-edge');
  assert.equal(context.renderedSampleRequests.size, 0);
});

test('native split editor placement fits the viewport and reserves room for its dropdown', () => {
  const { getEditorPlacement } = loadScriptModule('split-addressbars.js');
  const placement = getEditorPlacement({ left: 600, top: 400, width: 500, height: 36 }, 1000, 700);
  assert.equal(placement.left, 492);
  assert.equal(placement.top, 400);
  assert.equal(placement.width, 500);
  assert.equal(placement.resultsHeight, 248);
  assert.equal(getEditorPlacement({ left: 20, top: 400, width: 400, height: 36 }, 1000, 550, 80).resultsHeight, 54);
  assert.equal(getEditorPlacement({ left: -20, top: 4, width: 1200, height: 36 }, 800, 600).width, 784);
  assert.equal(getEditorPlacement({ left: 0, top: 680, width: 400, height: 36 }, 1000, 700).resultsHeight, 0);
});

test('native editor follows the selected split and restores native placement outside split view', () => {
  const attrs = new Map();
  const properties = new Map();
  const rootNode = { style: {
    getPropertyValue: key => properties.get(key) || '', getPropertyPriority: () => '',
    setProperty: (key, value) => properties.set(key, value), removeProperty: key => properties.delete(key)
  }, hasAttribute: key => attrs.has(key), setAttribute: (key, value) => attrs.set(key, value), removeAttribute: key => attrs.delete(key) };
  const a = {}, b = {};
  const module = loadScriptModule('split-addressbars.js');
  const context = {
    addressbarEnhancementsDisposed: false,
    chromeDoc: { documentElement: rootNode, getElementById: () => null },
    gBrowser: { selectedBrowser: a }, window: { innerWidth: 1000, innerHeight: 800 },
    splitAddressbars: { getEditorPlacement: module.getEditorPlacement, bars: new Map([
      [a, { field: { getBoundingClientRect: () => ({ left: 20, top: 80, width: 400, height: 36 }) } }],
      [b, { field: { getBoundingClientRect: () => ({ left: 520, top: 80, width: 400, height: 36 }) } }]
    ]) },
    splitEditorProperties: ['left', 'top', 'width', 'results-height'],
    ...loadScriptModule('style-state.js')
  };
  const script = read('blended-bar.uc.js');
  const start = script.indexOf('  function positionSplitEditor()');
  const end = script.indexOf('  function paintLoadProgress(', start);
  vm.createContext(context);
  vm.runInContext(script.slice(start, end), context);
  context.positionSplitEditor();
  assert.equal(attrs.get('data-blended-split-editor'), 'true');
  assert.equal(properties.get('--blended-addressbar-editor-left'), '20px');
  context.gBrowser.selectedBrowser = b;
  context.positionSplitEditor();
  assert.equal(properties.get('--blended-addressbar-editor-left'), '520px');
  attrs.set('customizing', 'true');
  context.positionSplitEditor();
  assert.equal(attrs.has('data-blended-split-editor'), false);
  assert.equal(properties.size, 0);
  attrs.delete('customizing');
  context.splitAddressbars.bars.clear();
  context.positionSplitEditor();
  assert.equal(attrs.has('data-blended-split-editor'), false);
});

test('split mode collapses shared chrome without removing the native editor or changing bookmark preferences', () => {
  const css = read('style.css');
  const script = read('blended-bar.uc.js');
  const start = css.indexOf(':root[data-blended-split-bars] {');
  assert.notEqual(start, -1);
  const block = css.slice(start);
  assert.match(block, /#zen-appcontent-navbar-wrapper\s*\{[^}]*height:\s*0\s*!important/);
  assert.match(block, /#nav-bar\s*\{[^}]*visibility:\s*hidden\s*!important/);
  assert.match(block, /#urlbar\s*\{[^}]*visibility:\s*visible\s*!important/);
  assert.match(block, /#PersonalToolbar\s*\{[^}]*display:\s*none\s*!important/);
  assert.doesNotMatch(block, /#(?:nav-bar|urlbar|zen-appcontent-navbar-wrapper)\s*\{[^}]*display:\s*none/);
  assert.match(script, /root\.toggleAttribute\('data-blended-split-bars', splitAddressbars\.bars\.size > 1\)/);
  assert.match(script, /removeAttribute\('data-blended-split-bars'\)/);
});

test('right sidebar keeps one native gap beside split panes', () => {
  const css = read('style.css');
  const selector = '#tabbrowser-tabbox[zen-split-view="true"][sidebar-panel-open][sidebar-positionend]';
  const block = cssRuleBlock(css, selector);
  assert.match(block, /margin-right:\s*0\s*!important/);
  assert.match(css.slice(css.indexOf(selector)), /> #tabbrowser-tabpanels\s*\{[^}]*margin-right:\s*calc\(-1 \* var\(--zen-split-row-gap\)\)\s*!important/);
});

test('frame gap defaults to Zen spacing and controls pane and sidebar gaps', () => {
  const css = read('style.css');
  const script = read('blended-bar.uc.js');
  const pref = JSON.parse(read('preferences.json')).find(p => p.property === 'uc.blended-addressbar.frame-gap');
  assert.equal(pref.defaultValue, 'var(--zen-element-separation)');
  assert.match(css, /width: anchor-size\(--blended-split-panels width\) !important/);
  assert.match(script, /readStringPref\(frameGapPref, 'var\(--zen-element-separation\)'\)/);
  assert.match(css, /--zen-split-row-gap:\s*var\(--blended-addressbar-frame-gap\)\s*!important/);
  assert.match(css, /--zen-split-column-gap:\s*var\(--blended-addressbar-frame-gap\)\s*!important/);
  assert.match(css, /#tabbrowser-tabbox\[sidebar-panel-open\]\s*\{\s*column-gap:\s*0\s*!important/);
  assert.match(css, /--blended-addressbar-resize-hit-size:\s*max\(6px, var\(--blended-addressbar-frame-gap\)\)/);
});

test('split focus highlight enters slowly, exits quickly and respects reduced motion', () => {
  const css = read('style.css');
  assert.match(css, /transition: box-shadow 90ms ease-in/);
  assert.match(css, /transition-duration: 260ms/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*\.blended-addressbar-pane-highlight[^}]*transition: none !important/);
  const pref = JSON.parse(read('preferences.json')).find(p => p.property === 'uc.blended-addressbar.split-focus-on-hover');
  assert.equal(pref?.defaultValue, false);
});

test('hover focus is opt-in, delayed, cancellable and does not steal URL editing focus', () => {
  let enabled = false, nextTimer = 0, selected = 0;
  const timers = new Map();
  const browser = {}, tab = {};
  const panels = { getAttribute: () => 'true' };
  const pane = { parentNode: panels, isConnected: true, matches: () => true,
    getAttribute: () => 'true', querySelector: () => browser };
  const event = { buttons: 0, target: { closest: () => pane } };
  const context = {
    addressbarEnhancementsDisposed: false, addressbarPrefBranch: 'uc.blended-addressbar.',
    window: { gZenGlanceManager: { getFocusedTab: () => null } },
    readBoolPref: () => enabled,
    chromeDoc: { hasFocus: () => true, documentElement: { hasAttribute: () => false, getAttribute: () => null }, querySelector: () => null },
    gURLBar: { focused: false, view: { isOpen: false } },
    gBrowser: { tabpanels: panels, selectedBrowser: {}, getTabForBrowser: () => tab,
      set selectedTab(value) { assert.equal(value, tab); selected++; } },
    setTimeout: (callback, delay) => { assert.equal(delay, 150); timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout: id => timers.delete(id)
  };
  const source = read('blended-bar.uc.js');
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('  let splitHoverTimer'), source.indexOf('  function observeSplitAddressbars()')), context);
  context.onSplitHover(event);
  assert.equal(timers.size, 0);
  enabled = true;
  context.onSplitHover(event);
  context.onSplitHover(event);
  assert.equal(timers.size, 1);
  assert.equal(selected, 0);
  [...timers.values()][0]();
  assert.equal(selected, 1);
  context.onSplitHover(event);
  context.onSplitHover({ ...event, buttons: 1 });
  assert.equal(timers.size, 0);
  context.onSplitHover(event);
  context.gURLBar.focused = true;
  [...timers.values()][0]();
  assert.equal(selected, 1);
  context.gURLBar.focused = false;
  context.window.gZenGlanceManager.getFocusedTab = () => tab;
  context.onSplitHover(event);
  assert.equal(timers.size, 0);
  context.window.gZenGlanceManager.getFocusedTab = () => null;
  context.onSplitHover(event);
  enabled = false;
  [...timers.values()][0]();
  assert.equal(selected, 1);
});

test('persistent sampler shares its helper scope and recovers from incomplete initialization', () => {
  const script = read('blended-bar.uc.js');
  assert.match(script, /loadFrameScript\(`\$\{scriptModuleBaseUrl\}color-sampling\.js`, false, true\)/);
  assert.match(script, /loadFrameScript\(themeFrameScriptUrl, false, true\)/);
  let listeners = 0;
  const context = { content: {
    __blended_addressbar_frame_inited: true,
    document: { readyState: 'loading', addEventListener() {} },
    location: { href: 'https://example.com/' },
    matchMedia: () => ({ addEventListener() {} }),
    setTimeout() {}, addEventListener() { listeners++; }
  }, sendAsyncMessage() {}, console: { error() {} } };
  vm.createContext(context);
  vm.runInContext(read('frame.js'), context);
  assert.equal(typeof context.content.__blended_addressbar_sample, 'undefined');
  vm.runInContext(read('scripts/color-sampling.js'), context);
  vm.runInContext(read('frame.js'), context);
  assert.equal(typeof context.content.__blended_addressbar_sample, 'function');
  assert.equal(context.content.__blended_addressbar_frame_inited, true);
  assert.equal(listeners, 2);
  vm.runInContext(read('frame.js'), context);
  assert.equal(listeners, 2);
});

test('confirmed top-edge pixels outrank metadata colors that do not match the page', () => {
  const policy = loadScriptModule('theme-source-policy.js');
  assert.ok(policy.getThemeSourceConfidence('pixel-top-edge') > policy.getThemeSourceConfidence('theme-color'));
  assert.ok(policy.getThemeSourceConfidence('pixel') > policy.getThemeSourceConfidence('theme-color'));
});

test('content color-scheme changes force a sample even when DOM and semantic color stay unchanged', () => {
  let schemeChanged, scheduled;
  const messages = [];
  const context = {
    BlendedAddressbarModule: { getDominantSampleColor: () => null },
    content: {
      document: { readyState: 'interactive', addEventListener() {} },
      location: { href: 'https://example.com/' },
      matchMedia(query) {
        assert.equal(query, '(prefers-color-scheme: dark)');
        return { addEventListener(type, callback) { assert.equal(type, 'change'); schemeChanged = callback; } };
      },
      setTimeout(callback, delay) { if (delay === 250) scheduled = callback; return 1; },
      addEventListener() {}
    },
    sendAsyncMessage: (_name, message) => messages.push(message), console: { error() {} }
  };
  vm.createContext(context);
  vm.runInContext(read('frame.js'), context);
  context.content.__blended_addressbar_sample();
  assert.equal(messages.length, 1);
  assert.equal(typeof schemeChanged, 'function');
  schemeChanged();
  schemeChanged();
  scheduled();
  assert.equal(messages.length, 2);
  assert.equal(messages[1].href, 'https://example.com/');
});

test('collapsed shared toolbar does not intercept split controls or address clicks', () => {
  const css = read('style.css');
  const block = css.slice(css.indexOf(':root[data-blended-split-bars] {'));
  assert.match(block, /#zen-appcontent-navbar-wrapper\s*\{[^}]*pointer-events:\s*none\s*!important/);
  assert.match(block, /#zen-appcontent-navbar-container\s*\{[^}]*pointer-events:\s*none\s*!important/);
  assert.match(block, /#urlbar\s*\{[^}]*pointer-events:\s*auto\s*!important/);
});

test('sidebar shares passive pane framing without the active split accent', () => {
  const css = read('style.css');
  const start = css.indexOf('/* Frame the sidebar like a passive pane. */');
  assert.notEqual(start, -1);
  const block = css.slice(start);
  assert.match(block, /#sidebar-box\[sidebar-panel-open\]:not\(\[hidden\]\)/);
  assert.match(block, /corner-shape: superellipse\(var\(--zen-squircle-value, 1\.3\)\)/);
  assert.match(block, /box-shadow: var\(--blended-addressbar-pane-inner-highlight\)/);
  assert.match(block, /pointer-events: none/);
  assert.match(block, /\[sidebar-positionend\]/);
  assert.doesNotMatch(block, /zen-active-split-outline-color|1\.5pt/);
});

test('single-tab sidebar does not duplicate the shared frame highlight', () => {
  const css = read('style.css');
  const sidebar = css.slice(css.indexOf('/* Frame the sidebar like a passive pane. */'));
  assert.match(sidebar, /&::after\s*\{\s*content: none;/);
  assert.match(sidebar, /#tabbrowser-tabbox\[zen-split-view="true"\][\s\S]*&::after\s*\{\s*content: "";/);
});

test('single sidebar column measures native toolbars and turns off for split and Only Sidebar layouts', () => {
  const attrs = new Map(), styles = new Map();
  const rootNode = { getAttribute: key => attrs.get(key), hasAttribute: key => attrs.has(key),
    toggleAttribute: (key, on) => on ? attrs.set(key, '') : attrs.delete(key), style: styles };
  let split = false;
  const bookmarks = { hidden: false, getAttribute: () => null, getBoundingClientRect: () => ({ height: 30 }) };
  const nodes = {
    'tabbrowser-tabbox': { getAttribute: () => split ? 'true' : null },
    'sidebar-box': { hidden: false, hasAttribute: () => true },
    'tabbrowser-tabpanels': { getBoundingClientRect: () => ({ left: 364, width: 700 }) },
    'zen-appcontent-wrapper': { getBoundingClientRect: () => ({ left: 100 }) },
    'nav-bar': { hidden: false, getAttribute: () => null, getBoundingClientRect: () => ({ height: 42 }) },
    PersonalToolbar: bookmarks
  };
  const context = { readBoolPref: () => false, chromeDoc: { documentElement: rootNode, getElementById: id => nodes[id],
    defaultView: { getComputedStyle: () => ({ display: 'block', visibility: 'visible' }) } },
    setStylePropertyIfChanged: (style, key, value) => style.set(key, value) };
  const source = read('scripts/pane-layout.js');
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('  function updateSingleSidebarLayout()'), source.indexOf('  function updatePaneCornerRadii()')), context);
  context.updateSingleSidebarLayout();
  assert.ok(attrs.has('data-blended-sidebar-column'));
  assert.equal(styles.get('--blended-addressbar-sidebar-toolbar-height'), '72px');
  assert.equal(styles.get('--blended-addressbar-sidebar-page-left'), '264px');
  assert.equal(styles.get('--blended-addressbar-sidebar-page-width'), '700px');
  bookmarks.hidden = true;
  context.updateSingleSidebarLayout();
  assert.equal(styles.get('--blended-addressbar-sidebar-toolbar-height'), '42px');
  split = true;
  context.updateSingleSidebarLayout();
  assert.ok(!attrs.has('data-blended-sidebar-column'));
  split = false;
  attrs.set('zen-single-toolbar', 'true');
  context.updateSingleSidebarLayout();
  assert.ok(!attrs.has('data-blended-sidebar-column'));
  attrs.delete('zen-single-toolbar');
  attrs.set('zen-compact-mode', 'true');
  context.readBoolPref = () => true;
  context.updateSingleSidebarLayout();
  assert.ok(!attrs.has('data-blended-sidebar-column'));
});

test('loading glow adds a full-field tint without replacing the native background color', () => {
  const css = read('styles/loadbar.css');
  const selector = '#urlbar[data-blended-loading]:not([zen-floating-urlbar="true"]):not([breakout-extend]) > .urlbar-background,';
  const block = cssRuleBlock(css, selector);
  assert.match(block, /--blended-addressbar-loadbar-glow-weak-mix/);
  assert.match(block, /background-image:\s*linear-gradient/);
  assert.doesNotMatch(block, /background-color:|box-shadow:/);
});

test('focused native split editor replaces the selected proxy without collapsing its layout', () => {
  const css = read('style.css');
  const selector = ':root[data-blended-split-editor="true"]:has(#urlbar:is([focused], [breakout-extend], [open], :focus-within))';
  const block = cssRuleBlock(css, selector);
  assert.match(block, /visibility: hidden !important/);
  assert.doesNotMatch(block, /display: none/);
  assert.match(css.slice(css.indexOf(selector), css.indexOf(selector) + 500), /\.browserSidebarContainer\.deck-selected/);
  assert.match(read('blended-bar.uc.js'), /'input-padding': getComputedStyle\(inputContainer\)\.padding/);
});

test('new rendered pixels can replace an early loading color at the same confidence', () => {
  const policy = loadScriptModule('theme-source-policy.js');
  const context = {
    ...policy, getThemeKey: t => t.bg, themeApplyState: { applied: { source: 'pixel-top-edge', confidence: 8 } },
    fallbackThemeStableDelayMs: 350, immediateThemeConfidenceMin: 4
  };
  const source = read('blended-bar.uc.js');
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('  function shouldApplyThemeCandidate('), source.indexOf('  function getThemeHostKey(')), context);
  assert.equal(context.shouldApplyThemeCandidate({ bg: 'blue', source: 'pixel-top-edge' }, { loading: true }).action, 'apply');
  assert.equal(context.shouldApplyThemeCandidate({ bg: 'white', source: 'body' }, { loading: true }).action, 'ignore');
});

test('loading samples are scheduled after paint and chrome reads a strip rather than one border pixel', () => {
  const frame = read('frame.js');
  assert.match(frame, /function sampleAfterPaint\(/);
  assert.match(frame, /content\.requestAnimationFrame/);
  assert.match(frame, /content\.setTimeout\(run, 100\)/);
  assert.match(frame, /addEventListener\('DOMContentLoaded', sampleAfterPaint/);
  assert.match(read('blended-bar.uc.js'), /let sampleHeight = Math\.max\(1, Math\.min\(8, Math\.floor\(rect\.height\)\)\)/);
});

test('rendered fallback also updates an ordinary loading tab without split bars', async () => {
  const browser = { currentURI: { spec: 'https://example.com/' }, browsingContext: { currentWindowGlobal: {} } };
  const applied = [];
  const context = {
    addressbarEnhancementsDisposed: false, renderedSampleRequests: new Map(),
    gBrowser: { selectedBrowser: browser },
    splitAddressbars: { bars: new Map(), applyTheme() {} },
    getBrowserHref: b => b.currentURI.spec, isPageThemeEligibleHref: () => true,
    sampleTabPanelsPixel: async () => ({ bg: 'rgb(7, 71, 166)' }),
    getSampledTheme: result => ({ ...result, href: browser.currentURI.spec }),
    cacheTheme() {}, isLoadingThemeFor: () => true,
    applyResolvedTheme: (_browser, theme, reason, href, options) => applied.push({ theme, options })
  };
  const source = read('blended-bar.uc.js');
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('  async function sampleRenderedTheme('), source.indexOf('  function refreshSplitAddressbars(')), context);
  await context.sampleRenderedTheme(browser);
  assert.equal(applied.length, 1);
  assert.equal(applied[0].theme.source, 'pixel-top-edge');
  assert.equal(applied[0].options.loading, true);
});

test('paint-triggered samples coalesce and cancel the safety timer', () => {
  let id = 0, samples = 0;
  const timers = new Map(), frames = new Map();
  const context = { sample: force => { assert.equal(force, true); samples++; }, content: {
    setTimeout: (fn, delay) => { assert.equal(delay, 100); timers.set(++id, fn); return id; },
    clearTimeout: key => timers.delete(key),
    requestAnimationFrame: fn => { frames.set(++id, fn); return id; },
    cancelAnimationFrame: key => frames.delete(key)
  } };
  const source = read('frame.js');
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('    let paintFrame ='), source.indexOf('    function rescheduleLoad()')), context);
  context.sampleAfterPaint();
  context.sampleAfterPaint();
  assert.equal(timers.size, 1);
  const fallback = [...timers.values()][0];
  for (let i = 0; i < 2; i++) {
    const [key, callback] = [...frames.entries()][0];
    frames.delete(key); callback();
  }
  assert.equal(samples, 1);
  assert.equal(timers.size, 0);
  fallback();
  assert.equal(samples, 1);
  context.sampleAfterPaint();
  [...timers.values()][0]();
  assert.equal(samples, 2);
  assert.equal(frames.size, 0);
});

test('loading halo extends beyond the progress edge and ends in a bright tip', () => {
  const css = read('styles/loadbar.css');
  const start = css.indexOf('  :root[data-blended-addressbar-loadbar-mode="glow"]');
  const halo = cssRuleBlock(css.slice(start), '&::before {');
  assert.match(halo, /left: -150px !important/);
  assert.match(halo, /width: calc\(var\(--blended-addressbar-loadbar-progress, 0%\) \+ 300px\) !important/);
  assert.match(halo, /max-width: none !important/);
  assert.match(halo, /at calc\(100% - 150px\) 100%/);
  assert.match(css.slice(start), /var\(--blended-addressbar-glow-color\) 25%, white/);
});


test('normal full updates request rendered pixels independently of frame replies', () => {
  const source = read('blended-bar.uc.js');
  const fullUpdate = source.slice(source.indexOf('    if (!fastOnly) {', source.indexOf('  async function startSampling(')));
  assert.match(fullUpdate, /requestPersistentFrameTheme\(browser[^;]+;\s*void sampleRenderedTheme\(browser\);\s*const pageTheme = await getBrowserPageTheme\(browser\)/);
});


test('rendered fallback captures the viewport when scroll offsets are unavailable', () => {
  const source = read('blended-bar.uc.js');
  assert.match(source, /const hasScrollPosition = Number\.isFinite\(scrollX\) && Number\.isFinite\(scrollY\)/);
  assert.match(source, /wg\.drawSnapshot\(captureRect, hasScrollPosition \? 1 : 0\.5, 'transparent'\)/);
  assert.match(source, /sampleHeight = Math\.min\(4, bitmap\.height\)/);
});


test('uncached loading pages request a rendered check before the early return', () => {
  const source = read('blended-bar.uc.js');
  assert.match(source, /applyHeaderOnlyTheme\(browser, getNeutralHeaderShade\(browser, 'loading-unknown'\), 'loading-unknown', expectedHref\);\s*void sampleRenderedTheme\(browser\);\s*return;/);
});


test('loading background gradient continues across the unused field to its far edge', () => {
  const css = read('styles/loadbar.css');
  const start = css.indexOf('/* A separate full-field tint sits behind the moving glow and progress line. */');
  const fill = css.slice(start, css.indexOf('::before {', start));
  assert.match(fill, /background-image:\s*linear-gradient\(to right/);
  assert.match(fill, /--blended-addressbar-loadbar-glow-medium-mix/);
  assert.match(fill, /--blended-addressbar-loadbar-glow-weak-mix/);
  assert.match(fill, /var\(--blended-addressbar-loadbar-fill\) 100%/);
});


test('rendered colors keep sampling page paints briefly after load', () => {
  const frame = read('frame.js');
  assert.match(frame, /MIN_PAINT_SAMPLE_INTERVAL_MS = 32/);
  assert.match(frame, /POST_LOAD_PAINT_SAMPLE_WINDOW_MS = 3000/);
  assert.match(frame, /postLoadPaintSampleUntil = now \+ POST_LOAD_PAINT_SAMPLE_WINDOW_MS/);
  assert.match(frame, /function onPaint\(\)[\s\S]*document\.readyState === 'complete' && now >= postLoadPaintSampleUntil[\s\S]*now - lastPaintSampleAt < MIN_PAINT_SAMPLE_INTERVAL_MS[\s\S]*sample\(false\)/);
  assert.match(frame, /addEventListener\('MozAfterPaint', onPaint, \{ capture: true \}\)/);
});
