# Blended Addressbar agent guide

## Project

Blended Addressbar is a dependency-free Zen Browser mod distributed through Sine. It adapts Zen chrome to the active page and supports dual-toolbar and Only Sidebar layouts.

The mod has no build step. Zen loads the source files directly.

## Runtime map

- `theme.json` registers `blended-bar.uc.js`, `style.css`, and `preferences.json` with Sine.
- `blended-bar.uc.js` is the only chrome script entry point. It owns browser events, color arbitration, caches, preference effects, and CSS variable updates.
- `frame.js` runs in page content. It samples page colors and reports theme changes through the message manager.
- `scripts/*.js` are focused chrome helpers. `blended-bar.uc.js` loads them with `Services.scriptloader` from `chrome://sine/content/blended-addressbar/scripts/`.
- Each helper exports one `BlendedAddressbarModule`. Keep this contract compatible with the chrome script loader and Node tests.
- `style.css` is the chrome stylesheet entry point. It imports `styles/loadbar.css` and `styles/header-chrome.css`.
- `preferences.json` defines the Sine settings UI.
- `tests/native-theme.test.js` is the Node regression suite.
- `docs/color-architecture.md` describes the adaptive color pipeline and source policy.

Do not register `frame.js`, helper scripts, or imported styles as new manifest entry points unless the loading model changes.

## Change boundaries

- Put browser lifecycle, sampling orchestration, caches, and CSS variable writes in `blended-bar.uc.js`.
- Put page-content observation and sampling in `frame.js`.
- Put reusable color, preference, style-state, pane-layout, or source-policy logic in the matching `scripts/` module.
- Put layout and visual rules in `style.css` or the matching imported stylesheet.
- Reuse existing CSS variables and helper modules before adding values or logic.
- Do not add dependencies, bundlers, generated files, or speculative abstractions.
- Keep changes small. Zen chrome APIs and selectors can change between browser releases.

## Adaptive color invariants

- Update header background and foreground together. Preserve readable contrast during loading and tab switches.
- Keep exact tab and page colors in memory only. Do not add cross-session color persistence.
- Keep the bounded page cache keyed by origin and pathname. Preserve its least-recently-used behavior.
- Keep active-tab updates coalesced through `requestAnimationFrame` with the timeout fallback.
- Do not restore repeated loading polls or scroll-driven color sampling.
- Keep the persistent frame sampler as the main dynamic page signal.
- While Zen Boost is active, accept pixel-derived colors only. Reject semantic and computed-style fallbacks.
- Centralize new source metadata in `scripts/theme-source-policy.js`. Do not scatter source rankings through callers.
- Treat unchanged effective colors as no-ops to prevent flicker and needless chrome writes.

Read `docs/color-architecture.md` before changing candidate collection, arbitration, caches, or fallback timing.

## CSS and layout invariants

- Scope selectors to Zen chrome and the narrowest supported state.
- Preserve separate behavior for dual-toolbar and `[zen-single-toolbar="true"]` layouts.
- Check vertical tabs on both sides, compact mode, hidden tabs, split view, Glance overlays, and fullscreen states after layout changes.
- Keep interactive navigation controls outside `-moz-window-dragging: drag` regions.
- Preserve native menu colors for bookmark popups.
- Keep split-pane inner edges square. Round only edges that touch the outer browser frame.
- Use `!important` only where chrome cascade precedence requires it.

## Preferences and releases

- For a new preference, update `preferences.json`, runtime or CSS handling, `README.md`, and regression coverage.
- Normalize free-form preference values through `scripts/prefs.js` before applying them.
- For each user-visible fix or release, update `CHANGELOG.md` and bump the version in `theme.json` and `blended-bar.uc.js`.
- Keep the version, date, description, manifest data, and Sine entry in `MARKETPLACE.md` synchronized with `theme.json`.
- Update the release metadata assertion in `tests/native-theme.test.js` when the version or release date changes.
- Documentation-only maintenance does not require a version bump.

## Validation

Run the regression suite after every source, style, preference, or release metadata change:

```sh
node --test tests/native-theme.test.js
```

The tests validate contracts and source structure. They do not replace Zen validation.

For user-visible changes:

1. Reload the mod or restart Zen.
2. Switch between pages with different top-edge colors.
3. Check background updates, foreground contrast, flicker, and stale colors.
4. Check loading, compact mode, Only Sidebar, split view, Glance, and fullscreen as applicable.
5. Check frame spacing, corner radii, clipping, shadows, and control clickability after layout changes.
