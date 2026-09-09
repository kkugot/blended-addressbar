# Blended Addressbar

Blended Addressbar is a Zen Browser mod that adds a compact, page-aware browser frame to Zen's dual-toolbar and Only Sidebar layouts. Dual-toolbar layouts also blend the addressbar with the active page.

![Blended Addressbar preview](https://raw.githubusercontent.com/kkugot/blended-addressbar/main/marketplace-preview.png)

## Features

- Addressbar colors that follow the active page in dual-toolbar layouts, with matching text and icon contrast.
- Optional window tint with adjustable strength.
- A browser frame with adjustable corner radius, spacing, and shadow strength. Corner shape follows Zen's settings.
- Split view with rounded outer corners and square inner boundaries.
- A bookmarks bar in Only Sidebar mode that appears on hover or stays visible.
- Three loading indicators: Progress bar, URL bar glow, and Window edge. You can also keep Zen's native loader.

## Installation

1. Install [Sine](https://github.com/CosmoCreeper/Sine#installation) and restart Zen.
2. In Sine settings, install the mod from the repository `kkugot/blended-addressbar`.
3. Enable **Blended Addressbar** and open its settings to adjust the frame, window tint, and loading indicator.

## Compatibility

This mod targets Zen Browser dual-toolbar and Only Sidebar layouts. Only Sidebar keeps Zen's native sidebar addressbar while the frame, window tint, split view, compact mode, and loading bar remain supported. Visual validation is still recommended after Zen updates because browser chrome selectors can change.

## Preferences

Change these settings in Sine. The preference names below also identify them in `about:config`.

### Window tint

- `uc.blended-addressbar.window-tint.enabled`: tint the browser window with active page colors while preserving Zen's existing icon and text colors.
- `uc.blended-addressbar.window-tint.strength`: tint strength as a percentage from `0` to `100`; defaults to `25`.

Page colors are always remembered in memory while browsing. They are not saved across browser restarts.

### Browser frame

Corner shape follows Zen's `layout.css.corner-shape.enabled` setting and `--zen-squircle-value`. The mod controls the radius, without overriding Zen's shape or curvature.

- `uc.blended-addressbar.frame-radius`: outer browser frame corner radius as a CSS length, such as `8px` or `0`. Defaults to `14px`.
- `uc.blended-addressbar.frame-radius.disabled`: remove browser frame rounding without changing the configured radius; disabled by default.
- `uc.blended-addressbar.frame-gap`: spacing around the browser frame as a CSS length, such as `5px` or `0`. Defaults to `5px`.
- `uc.blended-addressbar.frame-padding.disabled`: remove the browser frame padding around page content.
- `uc.blended-addressbar.addressbar-bookmarks-separator.disabled`: remove the separator between the addressbar and visible bookmarks bar; in Only Sidebar, remove the bookmarks bar's bottom separator.
- `uc.blended-addressbar.single-toolbar.bookmarks-always-visible`: keep bookmarks visible in Only Sidebar instead of revealing them on top-edge hover; disabled by default.
- `uc.blended-addressbar.frame-shadow`: choose the browser frame shadow preset: standard, minimal, or medium.

### Loading indicator

- `uc.loadbar.mode`: choose Default, Progress bar, URL bar glow, or Window edge. Default keeps Zen's native loader; the mod defaults to URL bar glow.
- `uc.loadbar.color`: fallback loadbar color when no page or header color is available.
- `uc.loadbar.focus-color`: use the browser focus color for Progress bar, URL bar glow, and Window edge instead of the header foreground; enabled by default.
- `uc.loadbar.height`: loading bar thickness for all custom loadbar styles.
- `uc.loadbar.opacity`: loading bar body opacity and glow intensity for all custom loadbar styles.
- `uc.loadbar.roundedcorner`: enable right-side rounded corners for Progress bar, URL bar glow, and Window edge.
- `uc.loadbar.shadow`: enable shadow for Progress bar and Window edge.

## Feedback

[Report a problem](https://github.com/kkugot/blended-addressbar/issues) with your Zen version, operating system, toolbar layout, and a screenshot. Include the page URL when the issue involves page colors.

## License

[MIT](https://github.com/kkugot/blended-addressbar/blob/main/LICENSE).

## Credits

The sampler adapts ideas from [caezium/zen-page-tint](https://github.com/caezium/zen-page-tint), especially the `requestAnimationFrame` scheduling pattern, persistent content sampler, and bounded page-color cache.
