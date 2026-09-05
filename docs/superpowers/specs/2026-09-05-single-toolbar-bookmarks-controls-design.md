# Single-toolbar bookmarks controls design

## Goal

Make the Only Sidebar bookmarks overlay easier to use without changing dual-toolbar behavior.

## Design

- Size the visible bookmarks row with Zen's `--zen-toolbar-height`. Use the same value for the page's expanded-state top padding so the row and content offset cannot drift.
- Align the bookmarks row with the left navigation controls. Keep its configured frame-radius top corners and use `clamp(8px, var(--blended-addressbar-frame-radius), 16px)` for horizontal padding.
- Delay hiding for `600ms`. Keep Zen's native transition duration and easing, and apply the same delay to the toolbar and page offset when hover ends.
- Add an unchecked `uc.blended-addressbar.single-toolbar.bookmarks-always-visible` preference labeled `Always show bookmarks in Only Sidebar`.
- When enabled and bookmarks exist, keep the navbar wrapper visible and keep page content offset by `--zen-toolbar-height`. When bookmarks are disabled, the preference has no effect.

## Scope

- `style.css`: sizing, spacing, hide delay, always-visible behavior.
- `preferences.json`: new checkbox.
- `README.md`: preference documentation.
- `CHANGELOG.md`: 1.5.1 release note.
- `tests/native-theme.test.js`: preference and CSS contracts.

No JavaScript is required because Sine preferences are available through `-moz-bool-pref` media queries.

## Validation

- Run `node --test tests/native-theme.test.js`.
- In Zen Only Sidebar mode, check hover entry/exit, bookmark buttons and folders, configured frame radius, bookmarks disabled, and the always-visible preference.
- Check left/right tabs, compact mode, fullscreen, and zero frame padding.
