# Blended Addressbar

Blended Addressbar is a Zen Browser mod that adds a compact, page-aware browser frame to Zen's Only Sidebar, Sidebar and Top Toolbar, and Collapsed Sidebar layouts. Dual-toolbar layouts also blend the addressbar with the active page.

![Blended Addressbar preview](https://raw.githubusercontent.com/kkugot/blended-addressbar/main/marketplace-preview.png)

## Features

- Addressbar colors that follow the active page in dual-toolbar layouts, with matching text and icon contrast.
- Optional window tint with adjustable strength.
- A browser frame with adjustable corner radius, spacing, and shadow strength. Corner shape follows Zen's settings.
- Split view with a 1.5pt inset focus ring in Zen's accent color. The page and ring share squircle clipping, with rounded outer corners and square divider corners.
- Browser sidebars share the panes’ outer-corner clipping, with a passive inner highlight in split view and no thick active-pane border. In single-tab dual-toolbar mode, the sidebar has a full-height column; the addressbar and bookmarks stay above the webpage. Native compact toolbar autohide is preserved.
- A bookmarks bar in Only Sidebar mode that appears on hover or stays visible.
- Compact address and reload/stop controls above each dual-toolbar split pane, with independent colors and loading glow. The shared toolbar and bookmarks row are hidden during split view.
- Three loading indicators: Progress bar, URL bar glow, and Window edge. You can also keep Zen's native loader.

## Installation

1. Install [Sine](https://github.com/CosmoCreeper/Sine#installation) and restart Zen.
2. In Sine settings, install the mod from the repository `kkugot/blended-addressbar`.
3. Enable **Blended Addressbar** and open its settings to adjust the frame, window tint, and loading indicator.

## Compatibility

Supported Zen layouts: **Only Sidebar**, **Sidebar and Top Toolbar**, and **Collapsed Sidebar**. Only Sidebar keeps Zen's native sidebar addressbar while the frame, window tint, split view, compact mode, and loading bar remain supported. Visual validation is still recommended after Zen updates because browser chrome selectors can change.

## Split addresses

In dual-toolbar layouts, each split pane shows a field styled like the native addressbar, with copy URL, site settings/extensions and reload/stop controls. Click the address, or focus it with Tab and press Enter, to select that pane and open Zen’s real editor over the field. Cmd/Ctrl+L opens that same editor over the selected pane. Suggestions, paste, selection and navigation remain native. Hover to see the full URL. Reload/stop controls its own pane without changing the selected tab.

Page and system light/dark changes update all visible split fields without switching tabs.

These rows share the page’s clipping boundary and reserve the native field height plus 6px above the page. The original collapsed addressbar is hidden while split fields are active; its DOM stays in place and its editor is positioned over the selected field. The shared toolbar row and bookmarks toolbar are hidden in this mode, even when bookmarks are set to always show. Both return on exit without changing Zen’s settings. Rows are removed outside split view, in Only Sidebar, and in fullscreen; Glance overlays are excluded.

## Preferences

Change these settings in Sine. The preference names below also identify them in `about:config`.

### Window tint

- `uc.blended-addressbar.window-tint.enabled`: tint the browser window with active page colors while preserving Zen's existing icon and text colors.
- `uc.blended-addressbar.window-tint.strength`: tint strength as a percentage from `0` to `100`; defaults to `25`.

Page colors are always remembered in memory while browsing. They are not saved across browser restarts.

### Split focus

- `uc.blended-addressbar.split-focus-on-hover`: select the split pane under the pointer after 150ms without clicking; disabled by default. Works in both toolbar layouts. URL editing, open menus, Glance and dragging suspend hover switching.

The active pane’s inset highlight appears over 260ms and disappears over 90ms. System reduced-motion settings disable these transitions.

### Browser frame

Corner shape follows Zen's `layout.css.corner-shape.enabled` setting and `--zen-squircle-value`. The mod controls the radius. Split-page clipping uses Zen's curvature value, and the focus ring inherits the page's shape.

- `uc.blended-addressbar.frame-radius`: outer browser frame corner radius as a CSS length, such as `8px` or `0`. Defaults to `14px`.
- `uc.blended-addressbar.frame-radius.disabled`: remove browser frame rounding without changing the configured radius; disabled by default.
- `uc.blended-addressbar.frame-gap`: spacing around the browser frame, between split panes and beside an open sidebar, as a CSS length such as `5px` or `0`. Defaults to `var(--zen-element-separation)`, following Zen’s native spacing. Explicit saved values are preserved.
- `uc.blended-addressbar.frame-padding.disabled`: remove the browser frame padding and the visible split/sidebar gaps. Resize handles retain a small invisible hit area.
- `uc.blended-addressbar.addressbar-bookmarks-separator.disabled`: remove the separator between the addressbar and visible bookmarks bar; in Only Sidebar, remove the bookmarks bar's bottom separator.
- `uc.blended-addressbar.single-toolbar.bookmarks-always-visible`: keep bookmarks visible in Only Sidebar instead of revealing them on top-edge hover; disabled by default.
- `uc.blended-addressbar.frame-shadow`: choose the browser frame shadow preset: standard, minimal, or medium. Minimal adds a 0.5pt white inner highlight and a black outer shadow, both at 15% opacity, with a 0.5pt outer edge.

### Loading indicator

- `uc.loadbar.mode`: choose Default, Progress bar, URL bar glow, or Window edge. Default keeps Zen's native loader; the mod defaults to URL bar glow.
- `uc.loadbar.color`: fallback loadbar color when no page or header color is available.
- `uc.loadbar.focus-color`: use the browser focus color for Progress bar, URL bar glow, and Window edge instead of the header foreground; enabled by default.
- `uc.loadbar.iridescent`: add a subtle color shift to the moving URL bar glow; disabled by default. System reduced-motion settings disable the animation and progress transitions.
- `uc.loadbar.height`: loading bar thickness for all custom loadbar styles.
- `uc.loadbar.opacity`: loading bar body opacity and glow intensity for all custom loadbar styles.
- `uc.loadbar.roundedcorner`: enable right-side rounded corners for Progress bar, URL bar glow, and Window edge.
- `uc.loadbar.shadow`: enable shadow for Progress bar and Window edge.

URL bar glow adds a soft gradient across the whole field, a moving bright tip and a gently breathing progress line while loading. Reduced-motion settings disable the breathing animation. It follows each browser’s loading progress, with an estimate when progress is unavailable and a short completion fade. It uses the existing focus color setting, or the local header foreground when that setting is off.

## Feedback

[Report a problem](https://github.com/kkugot/blended-addressbar/issues) with your Zen version, operating system, toolbar layout, and a screenshot. Include the page URL when the issue involves page colors.

## License

[MIT](https://github.com/kkugot/blended-addressbar/blob/main/LICENSE).

## Credits

The sampler adapts ideas from [caezium/zen-page-tint](https://github.com/caezium/zen-page-tint), especially the `requestAnimationFrame` scheduling pattern, persistent content sampler, and bounded page-color cache.

The moving glow and per-pane address controls take design inspiration from [z1n-k/zia](https://github.com/z1n-k/zia). This implementation keeps Zen’s native editor and uses the mod’s own color and layout helpers.
