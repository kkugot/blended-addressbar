# Changelog

## 1.0.1 - 2026-05-16

- Changed optional sidebar blending to use Zen's native theme variables instead of force-painting sidebar chrome selectors.
- Wrote native Zen background variables with important priority so they can win against Zen/theme background declarations.
- Added material-aware transparency for native Zen backgrounds using `zen.widget.macos.window-material`.
- Added a momentary preferences action to clear the in-memory page color cache and refresh the active tab color.
- Added root diagnostic attributes for the native theme bridge, including applied background, foreground, accent, and reason.
- Added restore behavior so native Zen theme values are returned when sidebar blending is disabled or the script unloads.
- Kept addressbar-specific colors on the existing Blended Addressbar variables while sharing page colors with Zen for native sidebar blending.
- Fixed Zen omnibox text color by feeding the adaptive foreground into `--input-color`.
