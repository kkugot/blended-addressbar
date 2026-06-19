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

test('DOM fullscreen removes the framed browser surface', () => {
  const css = read('style.css');

  assert.match(css, /&\[inDOMFullscreen="true"\]\s*\{\s*#zen-appcontent-wrapper\s*\{[^}]*margin:\s*0\s*!important/s);
  assert.match(css, /&\[inDOMFullscreen="true"\]\s*\{\s*#zen-appcontent-wrapper\s*\{[^}]*border-radius:\s*0\s*!important/s);
  assert.match(css, /&\[inDOMFullscreen="true"\]\s*\{\s*#zen-appcontent-wrapper\s*\{[^}]*box-shadow:\s*none/s);
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
  assert.match(css, /:root:not\(\[zen-should-be-dark-mode\]\)\s*\{[^}]*--blended-addressbar-frame-shadow-minimal:\s*0 0 0 1px rgba\(0,\s*0,\s*0,\s*0\.08\),\s*0 1px 2px rgba\(0,\s*0,\s*0,\s*0\.05\)/s);
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
  const urlbarGlowBackgroundSelector = '#urlbar:not([zen-floating-urlbar="true"]):not([breakout-extend]) > .urlbar-background';
  const urlbarGlowBeforeSelector = '#urlbar:not([zen-floating-urlbar="true"]):not([breakout-extend]) > .urlbar-background::before';
  const urlbarGlowAfterSelector = '#urlbar:not([zen-floating-urlbar="true"]):not([breakout-extend]) > .urlbar-background::after';
  const urlbarGlowBackgroundBlock = cssRuleBlockOccurrence(css, urlbarGlowBackgroundSelector, 0);
  const urlbarGlowBeforeBlock = cssRuleBlockOccurrence(css, urlbarGlowBeforeSelector, 1);
  const urlbarGlowAfterBlock = cssRuleBlockOccurrence(css, urlbarGlowAfterSelector, 1);
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
  assert.match(css, /@media \(-moz-bool-pref: "uc\.blended-addressbar\.frame-padding\.disabled"\)\s*\{[\s\S]*--blended-addressbar-loadbar-edge-top-offset:\s*var\(--blended-addressbar-loadbar-height,\s*2px\)/);
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
  assert.match(edgeModeBlock, /#zen-appcontent-navbar-wrapper::before,\s*#zen-appcontent-navbar-wrapper::after\s*\{[\s\S]*position:\s*absolute\s*!important/);
  assert.match(edgeModeBlock, /#zen-appcontent-navbar-wrapper::before,\s*#zen-appcontent-navbar-wrapper::after\s*\{[\s\S]*width:\s*var\(--blended-addressbar-loadbar-progress\)\s*!important/);
  assert.match(edgeModeBlock, /#zen-appcontent-navbar-wrapper::before,\s*#zen-appcontent-navbar-wrapper::after\s*\{[\s\S]*max-width:\s*100%\s*!important/);
  assert.match(edgeModeBlock, /#zen-appcontent-navbar-wrapper::before\s*\{[\s\S]*top:\s*var\(--blended-addressbar-loadbar-edge-top-offset,\s*0px\)\s*!important/);
  assert.match(edgeModeBlock, /#zen-appcontent-navbar-wrapper::after\s*\{[\s\S]*top:\s*calc\(var\(--blended-addressbar-loadbar-edge-top-offset,\s*0px\) \+ var\(--blended-addressbar-loadbar-height,\s*2px\)\)\s*!important/);
  assert.doesNotMatch(edgeModeBlock, /#zen-loading-progress-bar::before/);
  assert.doesNotMatch(css, /#zen-appcontent-wrapper::before/);
  assert.doesNotMatch(css, /#zen-appcontent-wrapper::after/);
  assert.doesNotMatch(css, /#tabbrowser-tabpanels::before/);
  assert.doesNotMatch(css, /#tabbrowser-tabpanels::after/);
  assert.doesNotMatch(css, /#tabbrowser-tabpanels > \.browserSidebarContainer:not\(\.zen-glance-overlay\)::before/);
  assert.doesNotMatch(css, /#tabbrowser-tabpanels > \.browserSidebarContainer:not\(\.zen-glance-overlay\)::after/);
  assert.match(css, /max-width:\s*100%\s*!important/);
  assert.match(css, /background:\s*var\(--blended-addressbar-dynamic-loadbar-color\)\s*!important/);
  assert.doesNotMatch(edgeModeBlock, /#zen-appcontent-navbar-wrapper::before,\s*#zen-appcontent-navbar-wrapper::after\s*\{[^}]*opacity:\s*var\(--blended-addressbar-loadbar-opacity/);
  assert.doesNotMatch(edgeModeBlock, /#zen-appcontent-navbar-wrapper::before,\s*#zen-appcontent-navbar-wrapper::after\s*\{[^}]*border-radius:/);
  assert.match(edgeModeBlock, /#zen-appcontent-navbar-wrapper::before\s*\{[\s\S]*opacity:\s*var\(--blended-addressbar-loadbar-opacity,\s*1\)\s*!important/);
  assert.match(edgeModeBlock, /#zen-appcontent-navbar-wrapper::before\s*\{[\s\S]*border-radius:\s*0 var\(--blended-addressbar-loadbar-right-radius,\s*0px\) var\(--blended-addressbar-loadbar-right-radius,\s*0px\) 0\s*!important/);
  assert.match(edgeModeBlock, /#zen-appcontent-navbar-wrapper::before,\s*#zen-appcontent-navbar-wrapper::after\s*\{[\s\S]*width 0\.7s ease-in-out/s);
  assert.match(edgeModeBlock, /#zen-appcontent-navbar-wrapper::after\s*\{[\s\S]*height:\s*24px\s*!important/);
  assert.match(edgeModeBlock, /#zen-appcontent-navbar-wrapper::after\s*\{[\s\S]*opacity:\s*1\s*!important/);
  assert.match(edgeModeBlock, /#zen-appcontent-navbar-wrapper::after\s*\{[\s\S]*background:\s*linear-gradient\(\s*to bottom,\s*color-mix\(in srgb,\s*var\(--blended-addressbar-dynamic-loadbar-color\) var\(--blended-addressbar-loadbar-glow-strong-mix,\s*34%\),\s*transparent\) 0%,\s*color-mix\(in srgb,\s*var\(--blended-addressbar-dynamic-loadbar-color\) var\(--blended-addressbar-loadbar-glow-medium-mix,\s*18%\),\s*transparent\) 36%,\s*color-mix\(in srgb,\s*var\(--blended-addressbar-dynamic-loadbar-color\) var\(--blended-addressbar-loadbar-glow-weak-mix,\s*7%\),\s*transparent\) 68%,\s*transparent 100%\s*\)\s*!important/s);
  assert.match(edgeModeBlock, /&:not\(:has\(\.tabbrowser-tab\[selected\]\[busy\]\)\) #zen-appcontent-navbar-wrapper::before,\s*&:not\(:has\(\.tabbrowser-tab\[selected\]\[busy\]\)\) #zen-appcontent-navbar-wrapper::after\s*\{[^}]*width:\s*0\s*!important;[^}]*opacity:\s*0\s*!important/s);
  assert.match(css, /#urlbar:not\(\[zen-floating-urlbar="true"\]\):not\(\[breakout-extend\]\) > \.urlbar-background::before/);
  assert.match(css, /#urlbar:not\(\[zen-floating-urlbar="true"\]\):not\(\[breakout-extend\]\) > \.urlbar-background::after/);
  assert.doesNotMatch(css, /#urlbar:not\(\[zen-floating-urlbar="true"\]\):not\(\[breakout-extend\]\)::after/);
  assert.doesNotMatch(css, /#urlbar:not\(\[zen-floating-urlbar="true"\]\):not\(\[breakout-extend="true"\]\)/);
  assert.match(css, /#urlbar:not\(\[zen-floating-urlbar="true"\]\):not\(\[breakout-extend\]\) > \.urlbar-background\s*\{[^}]*overflow:\s*hidden\s*!important/s);
  assert.match(urlbarGlowBackgroundBlock, /background-color:\s*transparent\s*!important/);
  assert.match(urlbarGlowBackgroundBlock, /transition:\s*background-color 0\.2s ease-in-out\s*!important/);
  assert.match(css, /&:is\(:has\(\.tabbrowser-tab\[selected\]\[busy\]\),\s*:has\(#zen-loading-progress-bar\[long-load\]\)\) #urlbar:not\(\[zen-floating-urlbar="true"\]\):not\(\[breakout-extend\]\) > \.urlbar-background\s*\{[^}]*background-color:\s*color-mix\(in srgb,\s*var\(--blended-addressbar-dynamic-loadbar-color\) var\(--blended-addressbar-loadbar-glow-weak-mix,\s*7%\),\s*transparent\)\s*!important/s);
  assert.doesNotMatch(css, /#urlbar:not\(\[zen-floating-urlbar="true"\]\):not\(\[breakout-extend\]\) > \.urlbar-background\s*\{[^}]*position:\s*relative/s);
  assert.doesNotMatch(css, /#urlbar:not\(\[zen-floating-urlbar="true"\]\):not\(\[breakout-extend\]\) > \.urlbar-background\s*\{[^}]*background:/s);
  assert.doesNotMatch(css, /#urlbar:not\(\[zen-floating-urlbar="true"\]\) \.urlbar-background\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(urlbarGlowBeforeBlock, /top:\s*0\s*!important/);
  assert.match(urlbarGlowBeforeBlock, /left:\s*0\s*!important/);
  assert.match(urlbarGlowBeforeBlock, /right:\s*auto\s*!important/);
  assert.match(urlbarGlowBeforeBlock, /bottom:\s*0\s*!important/);
  assert.match(urlbarGlowBeforeBlock, /width:\s*var\(--blended-addressbar-loadbar-progress\)\s*!important/);
  assert.match(urlbarGlowBeforeBlock, /min-width:\s*0\s*!important/);
  assert.match(urlbarGlowBeforeBlock, /max-width:\s*100%\s*!important/);
  assert.match(urlbarGlowBeforeBlock, /border-radius:\s*0 var\(--blended-addressbar-loadbar-right-radius,\s*0px\) var\(--blended-addressbar-loadbar-right-radius,\s*0px\) 0\s*!important/);
  assert.doesNotMatch(urlbarGlowBeforeBlock, /inset:\s*0\s*!important/);
  assert.match(urlbarGlowBeforeBlock, /linear-gradient\(\s*to top,\s*color-mix\(in srgb,\s*var\(--blended-addressbar-dynamic-loadbar-color\) var\(--blended-addressbar-loadbar-glow-strong-mix,\s*34%\),\s*transparent\) 0%,\s*color-mix\(in srgb,\s*var\(--blended-addressbar-dynamic-loadbar-color\) var\(--blended-addressbar-loadbar-glow-medium-mix,\s*18%\),\s*transparent\) 36%,\s*color-mix\(in srgb,\s*var\(--blended-addressbar-dynamic-loadbar-color\) var\(--blended-addressbar-loadbar-glow-weak-mix,\s*7%\),\s*transparent\) 68%,\s*transparent 100%\s*\)/s);
  assert.match(urlbarGlowBeforeBlock, /z-index:\s*0\s*!important/);
  assert.match(urlbarGlowBeforeBlock, /width 0\.7s ease-in-out/);
  assert.doesNotMatch(urlbarGlowBeforeBlock, /height:\s*24px\s*!important/);
  assert.match(urlbarGlowAfterBlock, /top:\s*auto\s*!important/);
  assert.match(urlbarGlowAfterBlock, /left:\s*0\s*!important/);
  assert.match(urlbarGlowAfterBlock, /bottom:\s*0\s*!important/);
  assert.match(urlbarGlowAfterBlock, /width:\s*var\(--blended-addressbar-loadbar-progress\)\s*!important/);
  assert.match(urlbarGlowAfterBlock, /height:\s*var\(--blended-addressbar-loadbar-height,\s*2px\)\s*!important/);
  assert.match(urlbarGlowAfterBlock, /border-radius:\s*0 var\(--blended-addressbar-loadbar-right-radius,\s*0px\) var\(--blended-addressbar-loadbar-right-radius,\s*0px\) 0\s*!important/);
  assert.doesNotMatch(urlbarGlowAfterBlock, /top:\s*0\s*!important/);
  assert.doesNotMatch(urlbarGlowAfterBlock, /bottom:\s*auto\s*!important/);
  assert.doesNotMatch(urlbarGlowAfterBlock, /--blended-addressbar-urlbar-loadbar-edge-offset/);
  assert.doesNotMatch(urlbarGlowAfterBlock, /max\(0px/);
  assert.doesNotMatch(urlbarGlowAfterBlock, /height:\s*100%\s*!important/);
  assert.match(urlbarGlowAfterBlock, /background:\s*var\(--blended-addressbar-dynamic-loadbar-color\)\s*!important/);
  assert.match(urlbarGlowAfterBlock, /width 0\.7s ease-in-out/);
  assert.doesNotMatch(urlbarGlowAfterBlock, /background-position:\s*0 0,\s*0 100%/);
  assert.match(css, /&:is\(:has\(\.tabbrowser-tab\[selected\]\[busy\]\),\s*:has\(#zen-loading-progress-bar\[long-load\]\)\) #urlbar:not\(\[zen-floating-urlbar="true"\]\):not\(\[breakout-extend\]\) > \.urlbar-background::before/);
  assert.match(css, /&:is\(:has\(\.tabbrowser-tab\[selected\]\[busy\]\),\s*:has\(#zen-loading-progress-bar\[long-load\]\)\) #urlbar:not\(\[zen-floating-urlbar="true"\]\):not\(\[breakout-extend\]\) > \.urlbar-background::before\s*\{[^}]*opacity:\s*1\s*!important/s);
  assert.match(css, /&:is\(:has\(\.tabbrowser-tab\[selected\]\[busy\]\),\s*:has\(#zen-loading-progress-bar\[long-load\]\)\) #urlbar:not\(\[zen-floating-urlbar="true"\]\):not\(\[breakout-extend\]\) > \.urlbar-background::after/);
  assert.doesNotMatch(css, /:root\[data-blended-addressbar-loadbar-mode="glow"\]\s*\{[\s\S]*:root:is\(:has\(\.tabbrowser-tab\[selected\]\[busy\]\),\s*:has\(#zen-loading-progress-bar\[long-load\]\)\) #urlbar/);
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
  assert.match(css, /&:is\(:has\(\.tabbrowser-tab\[selected\]\[busy\]\),\s*:has\(#zen-loading-progress-bar\[long-load\]\)\)/);
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
  assert.match(script, /messageManager\.loadFrameScript\(themeFrameScriptUrl,\s*false\)/);
  assert.match(script, /requestPersistentFrameTheme\(browser,\s*zenBoostActive \|\| deferRememberedFallback \|\| !cachedTheme\)/);
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
  assert.match(script, /if \(isLoadingThemeFor\(browser\) && !cachedTheme && !retainedHostTheme && !deferUnknownFallback\) \{\s*requestPersistentFrameTheme\(browser,\s*true\);\s*applyHeaderOnlyTheme\(browser,\s*getNeutralHeaderShade\(browser,\s*'loading-unknown'\),\s*'loading-unknown',\s*expectedHref\);\s*return;\s*\}/s);
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
  assert.match(urlbarIconSelector, /\.urlbar-page-action/);
  assert.match(urlbarIconSelector, /\.identity-box-button/);
  assert.match(urlbarIconSelector, /\.urlbar-icon/);
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

test('bookmark toolbar popups keep readable menu colors and compact corners', () => {
  const css = read('style.css');
  const popupSelector = '#PersonalToolbar toolbarbutton.bookmark-item > menupopup.toolbar-menupopup[placespopup="true"]';
  const popupBlock = cssRuleBlock(css, popupSelector);
  const popupContentBlock = cssRuleBlock(css, `${popupSelector}::part(content)`);
  const popupItemBlock = cssRuleBlock(css, `${popupSelector} :is(menu, menuitem, .menu-iconic, .menuitem-iconic, .bookmark-item)`);
  const disabledPopupItemBlock = cssRuleBlock(css, `${popupSelector} :is(menu, menuitem, .bookmark-item):is([disabled], [disabled="true"])`);

  assert.match(css, /--blended-addressbar-bookmark-popup-radius:\s*8px/);
  assert.match(popupBlock, /--panel-background:\s*Menu\s*!important/);
  assert.match(popupBlock, /--panel-color:\s*MenuText\s*!important/);
  assert.match(popupBlock, /--panel-border-radius:\s*var\(--blended-addressbar-bookmark-popup-radius\)\s*!important/);
  assert.match(popupContentBlock, /background:\s*Menu\s*!important/);
  assert.match(popupContentBlock, /color:\s*MenuText\s*!important/);
  assert.match(popupContentBlock, /border-radius:\s*var\(--blended-addressbar-bookmark-popup-radius\)\s*!important/);
  assert.match(popupContentBlock, /overflow:\s*hidden\s*!important/);
  assert.match(popupItemBlock, /color:\s*MenuText\s*!important/);
  assert.match(popupItemBlock, /--toolbarbutton-icon-fill:\s*currentColor/);
  assert.match(disabledPopupItemBlock, /color:\s*GrayText\s*!important/);
  assert.doesNotMatch(popupBlock, /var\(--zen-tab-header-foreground/);
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
