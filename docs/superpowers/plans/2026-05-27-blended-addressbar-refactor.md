# Blended Addressbar Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce duplication and file pressure in the Zen Browser Blended Addressbar mod without changing adaptive color behavior.

**Execution status (2026-05-27):** Continued from the partial working tree on `feature/blended-addressbar-refactor-20260527`. Automated refactor checks pass; manual Zen Browser validation remains pending because it requires reloading the live browser profile.

**Architecture:** Keep the existing Zen entry points intact: `blended-bar.uc.js` remains the userChrome behavior entry point and `style.css` remains the chrome stylesheet entry point. Refactor internally by extracting small helpers in the script, then move one self-contained CSS concern into `styles/header-chrome.css` imported by `style.css`.

**Tech Stack:** Zen Browser chrome CSS, userChrome JavaScript, Node.js built-in `node:test`.

---

## File Structure

- Modify `blended-bar.uc.js`: add focused helpers for repeated debug theme attributes and native-theme metadata cleanup.
- Modify `style.css`: import a new focused stylesheet and remove the hidden-tabs chrome icon block from the main file.
- Create `styles/header-chrome.css`: own hidden-tabs / compact-mode chrome icon color rules.
- Modify `tests/native-theme.test.js`: lock the refactor behavior with regex-based regression tests.

## Task 1: Centralize Theme Debug Attribute Writes

**Files:**
- Modify: `tests/native-theme.test.js`
- Modify: `blended-bar.uc.js`

- [ ] **Step 1: Write the failing test**

Add this test after `same effective tab theme updates are no-ops to avoid tab-switch blink` in `tests/native-theme.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/native-theme.test.js
```

Expected: FAIL in `theme debug attributes are written through one helper` because the helper does not exist and debug attribute writes are repeated inline.

- [ ] **Step 3: Add the helper**

In `blended-bar.uc.js`, place this helper after `clearTabHeaderTheme()`:

```js
  function setThemeDebugAttributes(reason = '', theme = null, href = '') {
    if (!DEBUG_THEME) return;

    const root = chromeDoc.documentElement;
    root.setAttribute('data-blended-addressbar-theme-reason', reason || '');
    root.setAttribute('data-blended-addressbar-theme-bridge', theme?.bridge || '');
    root.setAttribute('data-blended-addressbar-theme-source', theme?.source || '');
    root.setAttribute('data-blended-addressbar-theme-bg', theme?.bg || '');
    root.setAttribute('data-blended-addressbar-theme-fg', theme?.fg || '');
    root.setAttribute('data-blended-addressbar-theme-href', href || theme?.href || '');
  }
```

- [ ] **Step 4: Replace inline debug blocks**

In `clearAdaptivePageTheme(reason = 'ineligible-url')`, replace the whole `if (DEBUG_THEME) { ... }` block with:

```js
    setThemeDebugAttributes(reason, null, href);
```

In `applyInternalPageTheme(browser, reason = 'internal-page')`, replace the whole `if (DEBUG_THEME) { ... }` block with:

```js
    setThemeDebugAttributes(reason, theme, href);
```

In `applyHeaderOnlyTheme(browser, theme, reason = 'header-only')`, replace the whole `if (DEBUG_THEME) { ... }` block with:

```js
    setThemeDebugAttributes(reason, theme, href);
```

In `applyTheme(theme, reason)`, replace the repeated `root.setAttribute('data-blended-addressbar-theme-*', ...)` lines with:

```js
    setThemeDebugAttributes(reason, theme, theme.href || '');
```

Keep the existing `console.info('[blended-addressbar:urlbar] Theme resolved', ...)` block in `applyTheme`.

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
node --test tests/native-theme.test.js
```

Expected: PASS for all tests.

- [ ] **Step 6: Commit**

```bash
git add blended-bar.uc.js tests/native-theme.test.js
git commit -m "refactor: centralize theme debug attributes"
```

## Task 2: Centralize Native Theme Metadata Cleanup

**Files:**
- Modify: `tests/native-theme.test.js`
- Modify: `blended-bar.uc.js`

- [ ] **Step 1: Write the failing test**

Add this test after `browser window tint bridges page colors through native Zen window theme variables`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/native-theme.test.js
```

Expected: FAIL in `native theme debug metadata is cleared from one property list` because `restoreNativeZenTheme()` removes each attribute directly.

- [ ] **Step 3: Add the constant**

In `blended-bar.uc.js`, place this after `nativeZenThemeProperties`:

```js
  const nativeZenThemeDebugAttributes = Object.freeze([
    'data-blended-addressbar-native-theme-bg',
    'data-blended-addressbar-native-theme-fg',
    'data-blended-addressbar-native-theme-accent',
    'data-blended-addressbar-native-theme-tint',
    'data-blended-addressbar-native-theme-material',
    'data-blended-addressbar-native-theme-opacity',
    'data-blended-addressbar-native-theme-reason'
  ]);
```

- [ ] **Step 4: Replace direct removals**

In `restoreNativeZenTheme()`, keep:

```js
    root.setAttribute('data-blended-addressbar-native-theme', 'restored');
```

Replace the seven direct `root.removeAttribute('data-blended-addressbar-native-theme-*')` calls with:

```js
    for (const attribute of nativeZenThemeDebugAttributes) {
      root.removeAttribute(attribute);
    }
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
node --test tests/native-theme.test.js
```

Expected: PASS for all tests.

- [ ] **Step 6: Commit**

```bash
git add blended-bar.uc.js tests/native-theme.test.js
git commit -m "refactor: centralize native theme metadata cleanup"
```

## Task 3: Move Hidden-Tabs Chrome CSS Into A Focused Stylesheet

**Files:**
- Create: `styles/header-chrome.css`
- Modify: `style.css`
- Modify: `tests/native-theme.test.js`

- [ ] **Step 1: Write the failing test**

Add this test after `hidden tab sidebar toolbar icons use the softer addressbar chrome foreground`:

```js
test('hidden tab chrome styling lives in a focused imported stylesheet', () => {
  const css = read('style.css');
  const headerCss = read('styles/header-chrome.css');

  assert.match(css, /@import "styles\/header-chrome\.css";/);
  assert.match(headerCss, /#navigator-toolbox\[tabs-hidden\]/);
  assert.match(headerCss, /--blended-addressbar-header-chrome-icon-fill/);
  assert.match(headerCss, /&:has\(\[zen-compact-mode="true"\]\):not\(:has\(#navigator-toolbox\[tabs-hidden\]\)\)\s+#zen-appcontent-navbar-wrapper/);
  assert.doesNotMatch(css, /--blended-addressbar-header-chrome-icon-fill/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/native-theme.test.js
```

Expected: FAIL because `styles/header-chrome.css` does not exist and `style.css` still owns the hidden-tabs chrome selectors.

- [ ] **Step 3: Create the new stylesheet**

Create `styles/header-chrome.css` with this content:

```css
/* Hidden-tabs chrome foreground handling */

:root:not([zen-single-toolbar="true"]) {
    #navigator-toolbox[tabs-hidden],
    &:has(#navigator-toolbox[tabs-hidden]) #zen-sidebar-top-buttons-customization-target {
        --blended-addressbar-header-chrome-foreground: var(--zen-tab-header-foreground, currentColor);
        --blended-addressbar-header-chrome-icon-fill: color-mix(in srgb, var(--blended-addressbar-header-chrome-foreground) 60%, transparent);
        --blended-addressbar-header-muted-foreground: color-mix(in srgb, var(--zen-tab-header-foreground, currentColor) 42%, transparent);
        color: var(--blended-addressbar-header-chrome-foreground);
        --toolbox-textcolor: var(--blended-addressbar-header-chrome-foreground);
        --toolbarbutton-icon-fill: var(--blended-addressbar-header-chrome-icon-fill) !important;
        --toolbar-color: var(--blended-addressbar-header-chrome-foreground);
        --toolbar-field-color: var(--blended-addressbar-header-chrome-foreground);
        --urlbar-icon-fill-opacity: 0.6;
    }

    #navigator-toolbox[tabs-hidden] :is(toolbarbutton, .toolbarbutton-1, .toolbarbutton-icon, .toolbarbutton-text, .toolbarbutton-badge-stack, image, .titlebar-button),
    #navigator-toolbox[tabs-hidden] #nav-bar-customization-target > :not(#urlbar-container):not(#urlbar[zen-floating-urlbar="true"]),
    #navigator-toolbox[tabs-hidden] #nav-bar-customization-target > :not(#urlbar-container):not(#urlbar[zen-floating-urlbar="true"]) :is(toolbarbutton, .toolbarbutton-1, .toolbarbutton-icon, .toolbarbutton-text, .toolbarbutton-badge-stack, image),
    #navigator-toolbox[tabs-hidden] #zen-sidebar-top-buttons-customization-target :is(toolbarbutton, .toolbarbutton-1, .toolbarbutton-icon, .toolbarbutton-text, .toolbarbutton-badge-stack, image, .titlebar-button),
    &:has(#navigator-toolbox[tabs-hidden]) #zen-sidebar-top-buttons-customization-target :is(toolbarbutton, .toolbarbutton-1, .toolbarbutton-icon, .toolbarbutton-text, .toolbarbutton-badge-stack, image, .titlebar-button) {
        color: var(--blended-addressbar-header-chrome-icon-fill) !important;
        fill: currentColor !important;
        fill-opacity: 1 !important;
        stroke: currentColor !important;
        stroke-opacity: 1 !important;
        transition: color var(--blended-addressbar-color-transition), fill var(--blended-addressbar-color-transition), stroke var(--blended-addressbar-color-transition);
        --toolbox-textcolor: var(--blended-addressbar-header-chrome-icon-fill);
        --toolbarbutton-icon-fill: currentColor !important;
        --toolbar-color: var(--blended-addressbar-header-chrome-icon-fill);
        --toolbar-field-color: var(--blended-addressbar-header-chrome-foreground);
    }

    #navigator-toolbox[tabs-hidden] :is(.urlbar-icon, .identity-box-button, .urlbar-page-action) {
        color: var(--blended-addressbar-header-chrome-foreground) !important;
        fill: currentColor !important;
        fill-opacity: 0.6 !important;
        stroke: currentColor !important;
        stroke-opacity: 0.6 !important;
        --toolbarbutton-icon-fill: currentColor !important;
        --urlbar-icon-fill-opacity: 0.6;
    }

    #navigator-toolbox[tabs-hidden] :is([disabled], [disabled="true"], [muted], [soundplaying], .toolbarbutton-icon[disabled], [disabled] .toolbarbutton-icon, [disabled="true"] .toolbarbutton-icon),
    #navigator-toolbox[tabs-hidden] #nav-bar-customization-target :is([disabled], [disabled="true"], [muted], [soundplaying], .toolbarbutton-icon[disabled], [disabled] .toolbarbutton-icon, [disabled="true"] .toolbarbutton-icon),
    #navigator-toolbox[tabs-hidden] #zen-sidebar-top-buttons-customization-target :is([disabled], [disabled="true"], [muted], [soundplaying], .toolbarbutton-icon[disabled], [disabled] .toolbarbutton-icon, [disabled="true"] .toolbarbutton-icon),
    &:has(#navigator-toolbox[tabs-hidden]) #zen-sidebar-top-buttons-customization-target :is([disabled], [disabled="true"], [muted], [soundplaying], .toolbarbutton-icon[disabled], [disabled] .toolbarbutton-icon, [disabled="true"] .toolbarbutton-icon) {
        color: var(--blended-addressbar-header-muted-foreground) !important;
        fill: currentColor !important;
        fill-opacity: 1 !important;
        stroke: currentColor !important;
        stroke-opacity: 1 !important;
        transition: color var(--blended-addressbar-color-transition), fill var(--blended-addressbar-color-transition), stroke var(--blended-addressbar-color-transition);
        --toolbox-textcolor: var(--blended-addressbar-header-muted-foreground);
        --toolbarbutton-icon-fill: currentColor !important;
        --toolbar-color: var(--blended-addressbar-header-muted-foreground);
    }

    &:has([zen-compact-mode="true"]):not(:has(#navigator-toolbox[tabs-hidden])) #zen-appcontent-navbar-wrapper {
        :is(toolbarbutton, .toolbarbutton-1, .toolbarbutton-icon, .urlbar-icon) {
            color: inherit !important;
            fill: currentColor !important;
            --toolbarbutton-icon-fill: currentColor;
        }
    }
}
```

- [ ] **Step 4: Import and remove moved rules**

At the top of `style.css`, change imports to:

```css
@import "styles/loadbar.css";
@import "styles/header-chrome.css";
```

Remove these blocks from inside `:root:not([zen-single-toolbar="true"])` in `style.css`:

```css
    #navigator-toolbox[tabs-hidden],
    &:has(#navigator-toolbox[tabs-hidden]) #zen-sidebar-top-buttons-customization-target {
        ...
    }

    #navigator-toolbox[tabs-hidden] :is(toolbarbutton, .toolbarbutton-1, .toolbarbutton-icon, .toolbarbutton-text, .toolbarbutton-badge-stack, image, .titlebar-button),
    ...
    }

    #navigator-toolbox[tabs-hidden] :is(.urlbar-icon, .identity-box-button, .urlbar-page-action) {
        ...
    }

    #navigator-toolbox[tabs-hidden] :is([disabled], [disabled="true"], [muted], [soundplaying], .toolbarbutton-icon[disabled], [disabled] .toolbarbutton-icon, [disabled="true"] .toolbarbutton-icon),
    ...
    }

    &:has([zen-compact-mode="true"]):not(:has(#navigator-toolbox[tabs-hidden])) #zen-appcontent-navbar-wrapper {
        ...
    }
```

- [ ] **Step 5: Update existing hidden-tabs test to read combined CSS**

In `tests/native-theme.test.js`, change the first line inside `hidden tab sidebar toolbar icons use the softer addressbar chrome foreground` from:

```js
  const css = read('style.css');
```

to:

```js
  const css = `${read('style.css')}\n${read('styles/header-chrome.css')}`;
```

- [ ] **Step 6: Run test to verify it passes**

Run:

```bash
node --test tests/native-theme.test.js
```

Expected: PASS for all tests.

- [ ] **Step 7: Commit**

```bash
git add style.css styles/header-chrome.css tests/native-theme.test.js
git commit -m "refactor: split hidden tab chrome styling"
```

## Task 4: Final Verification

**Files:**
- Verify: `blended-bar.uc.js`
- Verify: `frame.js`
- Verify: `style.css`
- Verify: `styles/header-chrome.css`
- Verify: `tests/native-theme.test.js`

- [ ] **Step 1: Run all automated checks**

Run:

```bash
node --test tests/native-theme.test.js
node --check blended-bar.uc.js
node --check frame.js
node --check scripts/style-state.js
node --check scripts/prefs.js
node --check scripts/pane-layout.js
node --check scripts/color-utils.js
node --check scripts/theme-source-policy.js
git diff --check
```

Expected:

```text
tests 34
pass 34
fail 0
```

`node --check` commands should print no output and exit 0. `git diff --check` should print no output and exit 0.

- [ ] **Step 2: Manual Zen validation**

Reload the mod or restart Zen, then validate:

```text
1. Open a light page, a dark page, and an internal about: page.
2. Switch tabs repeatedly and confirm the header background and foreground still update together.
3. Toggle hidden tabs / compact mode and confirm sidebar/top chrome icons stay legible.
4. Open split view and confirm only outer pane corners are rounded.
5. Trigger a page load and confirm the loadbar still uses the selected color source.
```

- [ ] **Step 3: Commit verification-only test adjustments if needed**

If Step 1 required only test-regex corrections with no runtime behavior change, commit them with:

```bash
git add tests/native-theme.test.js
git commit -m "test: align refactor regression checks"
```

If no additional changes were needed, skip this commit.

## Self-Review

**Spec coverage:** The plan addresses the current refactoring target by reducing duplicated JavaScript attribute writes, centralizing native metadata cleanup, and moving a focused CSS concern out of the main stylesheet.

**Placeholder scan:** The plan contains concrete file paths, concrete test snippets, concrete implementation snippets, commands, and expected outcomes.

**Type consistency:** Helper names are consistent across tests and implementation: `setThemeDebugAttributes`, `nativeZenThemeDebugAttributes`, and `styles/header-chrome.css`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-27-blended-addressbar-refactor.md`.

Two execution options:

**1. Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.
