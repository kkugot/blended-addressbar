# Changelog

## 1.4.1 - 2026-08-09

- Fixed adaptive foreground and opacity for the sidebar toggle and copy-link icons in Zen Only Sidebar and compact modes.

## 1.4.0 - 2026-06-19

- Made URL bar glow the default custom loadbar style while keeping a Default option for Zen's native loader.
- Reworked Progress bar, URL bar glow, and Window edge loadbar styles to share color, opacity, glow intensity, thickness, right-side radius, and width transition behavior.
- Added a focus-color loadbar preference, set focus color on by default, and changed default loadbar height to `2px` with `100%` opacity.
- Moved Progress bar to the full window top edge and fixed Window edge placement so it draws on the browser chrome edge instead of tab content.
- Kept the Window edge loadbar body visible when browser frame padding is disabled.
- Added a preference to collapse the addressbar/bookmarks separator and kept bookmark folder popups readable with native menu colors.
- Removed obsolete selector-rule and legacy loadbar color-source handling from the color pipeline.

## 1.3.3 - 2026-06-05

- Removed long-lived persisted site color caching and the `Remember site colors longer` preference so restored tabs do not reuse stale cross-session host colors.
- Kept page color memory limited to exact in-session tab/page cache plus delayed same-host retention when fresh page sampling misses.
- Delayed remembered and neutral fallback paints during tab switching so fresh rendered page colors can resolve first.
- Added regression coverage for the in-memory-only cache model and calmer fallback transitions.

## 1.3.2 - 2026-06-04

- Removed the browser frame gap, rounded corners, and shadow while DOM fullscreen is active so fullscreen video fills the window cleanly.
- Added regression coverage for DOM fullscreen frame styling.

## 1.3.1 - 2026-05-30

- Reduced navigation color refresh work by replacing the repeating loading poll loop with one early update, one settled update, and persistent-frame `load`/`pageshow` samples.
- Requested the persistent frame sampler before showing the neutral loading header so loading pages can still resolve to page colors without polling.
- Required actual pixel-derived color sources while Zen Boost is active, ignoring computed-style fallbacks such as `top-visible`, `body`, `html`, `theme-color`, selector rules, and Dark Reader variables.
- Added regression coverage for reduced navigation scheduling and Boost pixel-only color arbitration.
- Updated adaptive color architecture notes for the loading tracker and Boost pixel-source gate.

## 1.3.0 - 2026-05-27

- Split repeated chrome script helper logic into focused modules loaded from the existing Zen script entry point.
- Centralized adaptive theme debug attributes and native Zen theme metadata cleanup.
- Moved hidden-tabs chrome foreground styling into `styles/header-chrome.css`.
- Added compact bounded host color cache persistence that migrates older payloads, omits persisted hrefs, and clears oversized cache preferences.
- Added regression coverage for helper module exports, CSS import order, host cache serialization, and refactored debug/metadata behavior.
- Updated the marketplace preview image and kept the README to a single marketplace-ready preview.
- Updated the adaptive color architecture notes to match the current helper-module split, cache layers, and Zen Boost modifier behavior.

## 1.2.0 - 2026-05-26

- Added a persistent content sampler inspired by `caezium/zen-page-tint` to pick up rendered page colors and theme mutations without repeated one-off frame-script setup.
- Restored a short linear adaptive header color transition for background and foreground changes.
- Deferred post-load semantic fallbacks briefly so rendered pixel samples can win first on Zen Boost-modified pages.
- Added Zen Boost-aware color arbitration that ignores non-rendered theme sources while Boost is active and resamples when Boost state changes.
- Applied exact target-tab/page cached colors before same-host or host-cache fallbacks during tab switches.
- Retained the previous same-host color during tab switches so unloaded tabs do not briefly flash a neutral header while restoring.
- Kept a stable readable foreground on early cached tab-switch colors so the addressbar text does not blink while samples catch up.
- Kept preferred `theme-color` metadata stable during active page loads while still skipping weaker non-rendered fast fallbacks.
- Added coalesced active-tab color refresh scheduling with a `requestAnimationFrame` plus timeout fallback.
- Added a bounded `origin + pathname` page-color LRU cache before the long-lived host fallback cache.
- Skipped reapplying equivalent tab colors by normalizing theme keys and avoiding unchanged CSS variable writes.
- Removed the `Remember page colors while browsing` preference; page colors are now always remembered in memory during the browsing session.
- Changed `Remember site colors longer` to default on so site colors persist across browser restarts unless disabled.
- Removed the perpetual active-tab refresh loop from the normal event path now that the content sampler observes page theme changes.
- Removed scroll-driven page color resampling so scrolling does not change the adaptive header color.
- Kept cached tab-switch colors stable without immediately forcing a fresh persistent page sample.
- Cleared page color caches when the OS color scheme changes and skipped same-document navigation refreshes.
- Added README credit for the borrowed `zen-page-tint` implementation ideas.
- Centralized adaptive color source policy and resolve-context inputs so Boost, Dark Reader, semantic colors, and cache behavior use one arbitration model.

## 1.1.6 - 2026-05-25

- Replaced the momentary page-color cache clear action with a `Remember page colors while browsing` preference.
- Added an opt-in `Remember site colors longer` preference that persists capped host color cache entries across browser restarts.
- Deferred persisted host-cache colors until fresh page color lookup fails, preventing addressbar background blinking on tab switch.
- Kept expanded sidebar toolbar alignment and boosted site-data icon colors consistent with adaptive header foregrounds.

## 1.1.5 - 2026-05-20

- Kept focused/open URL text native while the addressbar popup is shown.
- Restored native URL selection background and selected text colors.
- Tuned expanded URL bar spacing and input-container height for the breakout state.

## 1.1.4 - 2026-05-20

- Kept selected URL bar text colors native so selection remains an isolated input affordance.

## 1.1.3 - 2026-05-20

- Matched macOS mono window-control dots to a muted blended foreground color for contrast on adaptive headers.

## 1.1.2 - 2026-05-18

- Kept floating URL bar/search popup colors native so page-aware foreground does not bleed into the popup.
- Scoped adaptive toolbar foregrounds to the non-floating chrome header, including bookmarks and toolbar icons.
- Added a translucent neutral loading/unknown-page header with a transparent browser frame layer so it does not appear as a solid black or white block.
- Stabilized internal browser page colors to avoid stale website colors and repeated flicker on `about:` pages.

## 1.1.1 - 2026-05-18

- Scoped adaptive omnibox foreground colors to the URL input text instead of the URL bar popup container.
- Cleared page-derived header, tint, cache, and loadbar colors when switching to internal browser pages such as `about:preferences`.

## 1.1.0 - 2026-05-18

- Added an explicit `uc.blended-addressbar.frame-gap` preference while keeping the frame padding removal checkbox.
- Derived the inner content radius from the outer frame radius minus the frame gap, clamped at `0px`.
- Added a `uc.blended-addressbar.frame-shadow` dropdown with no shadow, standard, minimal, and medium frame shadow presets.
- Renamed the old `uc.blended-addressbar.sidebar.enabled` setting to browser window tinting with `uc.blended-addressbar.window-tint.enabled`, while preserving the old setting as a migration fallback.
- Changed browser window tinting to a configurable active-page background layer and stopped writing site-derived Zen icon/text color variables.
- Added `uc.blended-addressbar.window-tint.strength` to control the browser window tint percentage, defaulting to 25%.
- Removed the Custom Page Selector section from the visible Sine settings.
- Removed split-pane-specific color, spacing, separator, and focus-ring treatment from the working tree.
- Limited Zen pane radius, including sidebars on either side, to outer browser-frame corners so inner split boundaries stay square.

## 1.0.1 - 2026-05-16

- Changed optional browser window tinting to use Zen's native theme variables instead of force-painting sidebar chrome selectors.
- Wrote native Zen background variables with important priority so they can win against Zen/theme background declarations.
- Added material-aware transparency for native Zen backgrounds using `zen.widget.macos.window-material`.
- Added a momentary preferences action to clear the in-memory page color cache and refresh the active tab color.
- Added root diagnostic attributes for the native theme bridge, including applied background, foreground, accent, and reason.
- Added restore behavior so native Zen theme values are returned when window tinting is disabled or the script unloads.
- Kept addressbar-specific colors on the existing Blended Addressbar variables while sharing page colors with Zen for native browser window tinting.
- Fixed Zen omnibox text color by feeding the adaptive foreground into `--input-color`.
