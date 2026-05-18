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
  assert.match(script, /getZenBrowserBackground\(\)\?\.style\.setProperty\('--blended-addressbar-window-tint-background', tintBackground, 'important'\)/);
  assert.match(script, /getZenBrowserBackground\(\)\?\.style\.removeProperty\('--blended-addressbar-window-tint-background'\)/);
  assert.match(script, /setProperty\('--blended-addressbar-frame-background', tintBackground, 'important'\)/);
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

test('theme cache can be cleared through a momentary preference action', () => {
  const script = read('blended-bar.uc.js');
  const prefs = read('preferences.json');

  assert.match(script, /clear-cache-request/);
  assert.match(script, /clearThemeCache\('preference-button'\)/);
  assert.match(script, /setBoolPref\(clearCacheRequestPref,\s*false\)/);
  assert.match(prefs, /uc\.blended-addressbar\.clear-cache-request/);
  assert.match(prefs, /Clear cached page colors/);
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
  assert.match(script, /const key = getThemeKey\(theme\);\s*if \(key === lastThemeKey\) return true;/);
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
  assert.match(script, /function applyHeaderOnlyTheme\(browser,\s*theme,\s*reason = 'header-only'\)[\s\S]*const key = getThemeKey\(theme\);\s*chromeDoc\.documentElement\.style\.setProperty\('--blended-addressbar-frame-background',\s*'transparent',\s*'important'\);\s*if \(key === lastThemeKey\) return true;/);
  assert.match(script, /setVar\(theme\.bg,\s*theme\.fg\)/);
  assert.match(script, /clearWindowTintBackground\(\)/);
  assert.match(script, /setProperty\('--blended-addressbar-frame-background',\s*'transparent',\s*'important'\)/);
  assert.match(script, /if \(isLoadingThemeFor\(browser\) && !cachedTheme\) \{\s*applyHeaderOnlyTheme\(browser,\s*getNeutralHeaderShade\(browser,\s*'loading-unknown'\),\s*'loading-unknown'\);\s*return;\s*\}/s);
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
  assert.match(css, /--blended-addressbar-header-muted-foreground:\s*color-mix\(in srgb,\s*var\(--zen-tab-header-foreground,\s*currentColor\)\s*42%,\s*transparent\)/);
  assert.match(css, /#urlbar:not\(\[zen-floating-urlbar="true"\]\) #urlbar-input-container :is\(\.urlbar-page-action,\s*\.identity-box-button,\s*\.urlbar-icon\)/);
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
