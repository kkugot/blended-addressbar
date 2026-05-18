# Changelog

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
