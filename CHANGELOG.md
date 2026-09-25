# Changelog

## 1.7.20 - 2026-09-25

- Attach the content sampler when the new top-level page commits, so an early request cannot remain bound to the previous document until loading finishes.

## 1.7.19 - 2026-09-25

- Start content and rendered-pixel sampling on early fast-only loading updates, including cached pages, so visible header changes can reach the addressbar before load finishes.

## 1.7.18 - 2026-09-25

- Continue sampling paint-triggered color updates for three seconds after load so late-rendered page headers can replace an early fallback.

## 1.7.17 - 2026-09-25

- Sample rendered page colors up to 30 times per second while the page is painting, down from 10, so the addressbar follows loading-time color changes sooner.

## 1.7.16 - 2026-09-25

- Extend the loading-field gradient to the far edge and add a gentle progress-line pulse. Respect reduced motion.


## 1.7.15 - 2026-09-25

- Extend the URL-bar tint across the full field with a soft fade towards its far end.
- Let the progress line gently brighten and dim while loading; keep the movement disabled for reduced motion.

## 1.7.14 - 2026-09-25

- Request a one-shot rendered snapshot on uncached loading pages and full active-tab updates even if the content frame never replies.
- Follow Zia’s viewport-snapshot approach when scroll offsets are unavailable, using half scale and a top strip instead of assuming document coordinates are zero.

- Extend the loading halo beyond the progress edge so it fades naturally instead of ending at a hard crop.
- Add a brighter tip and a small leading glow core while preserving the selected color, opacity control and clipping at the address field boundary.

## 1.7.13 - 2026-09-25

- Sample after paint during initial loading and DOM theme changes, with a coalesced 100ms safety fallback instead of waiting for page completion.
- Allow a newer rendered pixel color to replace an early loading color at equal confidence. Keep weaker semantic candidates guarded.
- Use the rendered snapshot fallback for ordinary active tabs as well as split panes, and sample an 8px strip so a thin top border does not dominate. Discard stale snapshots when a newer frame sample arrives.

## 1.7.12 - 2026-09-21

- Hide the selected split’s visual address proxy while the native editor owns focus, preventing overlapping URLs and icons without changing row geometry.
- Reuse native input padding, text padding and action-button dimensions; refresh captured styling when the native editor returns to its closed state.

## 1.7.11 - 2026-09-21

- Reduce the Minimal preset’s white inner highlight, black outer edge and soft shadow from 20% to 15% opacity.

## 1.7.10 - 2026-09-21

- Restore a full-field loading tint behind the moving URL-bar glow and progress line, for both native and split address fields.
- Keep the underlying background and shadows intact; use the existing glow color and opacity settings, and remove the tint when loading ends.

## 1.7.9 - 2026-09-21

- Give single-tab dual-toolbar sidebars their own full-height column, with the native addressbar and bookmarks confined to the webpage width. Keep native browser/sidebar nodes and resizing intact.
- Remove the extra sidebar highlight in single-tab mode so the shared frame does not produce a double border.
- Track toolbar height, bookmark visibility and sidebar resizing. Preserve native compact toolbar autohide and restore normal layout when the sidebar closes or split view starts.

## 1.7.8 - 2026-09-21

- Give open browser sidebars the same passive frame treatment as split panes, with matching outer-corner clipping and the shared inner-highlight preset.
- Keep divider-facing corners square and omit the thick active-pane accent. The highlight remains click-through.

## 1.7.7 - 2026-09-21

- Stop the collapsed shared toolbar containers from intercepting mouse events over split address fields and native split controls.
- Keep the real URL editor interactive when opened. Validate physical pointer clicks and hover paths with hover-to-focus both enabled and disabled.

## 1.7.6 - 2026-09-20

- Refresh every attached page sampler on prefers-color-scheme changes, including inactive visible split panes. CSS-only dark/light switches no longer leave split address fields on the previous background.
- Coalesce theme notifications and force a bridge update when needed for rendered-color fallbacks. Refresh native proxy styling on browser color-scheme changes without scrolling or polling.

## 1.7.5 - 2026-09-20

- Fix the persistent sampler’s shared-helper loading scope and retry incomplete initialization instead of leaving the sampler disabled.
- Prefer confirmed top-edge pixel colors over site theme-color metadata, so sites such as zen-browser.app blend with their rendered background and follow page theme changes.

## 1.7.4 - 2026-09-20

- Animate the active split’s inset highlight with a smooth 260ms entrance and a faster 90ms exit; disable transitions for reduced motion.
- Add opt-in Focus split pane on hover, with a 150ms dwell before selecting the pane. Keep click selection by default and suppress hover changes during URL editing, open menus, Glance, dragging and inactive windows.

## 1.7.3 - 2026-09-20

- Use Frame gap for both split directions and the gap beside an open sidebar. Default to Zen’s native element spacing while preserving explicitly saved values.
- Remove the duplicate gap beside a right-hand sidebar and keep its outer edge inside the frame.
- Keep resize handles usable when frame padding is disabled, and anchor split handles to the page area instead of including sidebar width on browsers supporting CSS anchor positioning.

## 1.7.2 - 2026-09-20

- Collapse the shared toolbar row and hide the bookmarks toolbar while dual-toolbar split address fields are active. Restore both on exit without changing Zen’s bookmark visibility preference.
- Keep the native URL editor and site menus available above each pane while shared toolbar buttons are hidden.

## 1.7.1 - 2026-09-20

- Match split address fields to the native addressbar’s font, height, shape and background. Add native copy-URL and site-settings actions for each pane.
- Hide the collapsed original addressbar in split view and anchor its real editor and suggestions over the selected pane, including keyboard activation. Keep its original DOM and restore normal placement outside split view.
- Reposition the editor on pane/sidebar layout changes and constrain suggestions to the remaining window height.

## 1.7.0 - 2026-09-19

- Added compact address and reload/stop controls above each dual-toolbar split pane, with independent page colors and loading progress. The native toolbar and URL editor stay in place.
- Changed URL bar glow to a moving highlight with a bright leading edge, smooth progress and completion. Existing page/focus colors remain configurable.
- Added optional iridescent glow and reduced-motion support.
- Sample the dominant color of the page’s top strip instead of averaging a small central patch or the whole line. Pixel sampling and foreground contrast stay separate for each pane.
- Preserve native browser, notification, findbar and DevTools containers, shared clipping and square split-divider corners.

## 1.6.1 - 2026-09-13

- Added a 0.5pt white inner highlight at 20% opacity to the Minimal frame shadow preset.
- Made the Minimal outer shadow black at 20% opacity in light and dark modes, with a 0.5pt hard edge.
- Replaced the clipped native split-pane outline with a 1.5pt inset focus ring in Zen's accent color, painted above the pane highlight.
- Gave split page content and its highlight one shared clipping boundary with Zen's squircle shape, rounded outer corners, and square divider corners.
- Restored rounded browser-frame corners in Only Sidebar fullscreen mode.
- Documented support for Only Sidebar, Sidebar and Top Toolbar, and Collapsed Sidebar layouts.

## 1.6.0 - 2026-09-09

- Added the preview image URL to the manifest so Sine marketplace updates retain it.
- Restored the Only Sidebar bookmarks bar separator and connected it to the existing separator checkbox.
- Documented Zen's native corner-shape setting and curvature value, which the mod leaves unchanged.
- Updated the README with direct Sine installation, grouped settings, and support information.

## 1.5.1 - 2026-09-05

- Framed the visible bookmarks bar in Only Sidebar mode with the adaptive page color and readable foreground, without its bottom separator.
- Overlaid the auto-hidden bookmarks bar inside the page frame, kept the configured frame gap above it, and offset page content with Zen's native easing only while expanded.
- Preserved the computed inner page radius instead of clipping it with the outer frame radius.
- Restored the native URL-bar border after glow loading and kept window-edge and progress loaders visible above auto-hidden bookmarks.
- Removed the obsolete window-edge loader offset when frame padding is disabled in Only Sidebar mode.
- Matched Zen's attribute-presence semantics so disabled bookmarks cannot trigger the hover offset.
- Aligned the bookmarks row with Zen's toolbar controls, added more horizontal space, delayed autohide by 600ms, and added an `Always show bookmarks in Only Sidebar` setting.

## 1.5.0 - 2026-09-03

- Added browser frame, window tint, split view, compact mode, fullscreen, and loading-bar support to Zen's single-toolbar Only Sidebar layout while keeping its sidebar addressbar native.
- Fixed macOS traffic lights in Collapsed Sidebar mode with compact horizontal controls centered inside the narrow rail.
- Added an unchecked `Remove browser frame rounding` setting that preserves the configured radius while active.

## 1.4.4 - 2026-08-10

- Fixed default bookmark favicon colors and removed background transitions from bookmark folder buttons.

## 1.4.3 - 2026-08-09

- Forced bookmark toolbar popups to use native menu colors and removed their opening color transition.

## 1.4.2 - 2026-08-09

- Added regression coverage for Home, Back, and Forward controls staying clickable inside the browser window-drag region.

## 1.4.1 - 2026-08-09

- Fixed adaptive foreground and opacity for Zen Only Sidebar, compact-mode, site-properties, copy-link, and macOS window-control icons; non-boost site-properties now follow light/dark page headers while Zen Boost keeps its native contrast.

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
