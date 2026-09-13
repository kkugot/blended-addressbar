# Title

Blended Addressbar update: all three Zen layouts, better split view, and fewer color flashes

# Post

I posted Blended Addressbar here when I released the first version. I've kept working on it since then, and 1.6.1 is ready.

It started as a way to blend the addressbar into the page. It now supports **Only Sidebar, Sidebar and Top Toolbar, and Collapsed Sidebar**, with a configurable frame and optional page-colored window tint. Only Sidebar keeps Zen's native sidebar addressbar.

The biggest changes since that first post:

- **Split view:** the active pane has an inset focus ring in Zen's accent color. It shares the page's clipping and squircle shape, so the ring follows the corners instead of getting cut off. Corners along the divider stay square.
- **Only Sidebar bookmarks:** reveal the bookmarks bar by hovering at the top, or keep it visible. There's also a separator toggle.
- **Frame settings:** adjust the radius, spacing, and shadow strength, or remove rounding. The Minimal shadow now has a thin white inner highlight and a black outer shadow. It gives dark pages a little separation from the frame.
- **Loading indicators:** choose Progress bar, URL bar glow, Window edge, or Zen's native loader. The custom ones have controls for color, thickness, and opacity.
- **Page colors:** less flashing during tab switches, better handling of internal pages, and fixes for icon contrast and native popup colors. Scrolling no longer triggers color sampling. I also removed color storage across restarts because it could bring back stale colors.

There are fixes for fullscreen, compact mode, and the macOS window controls in Collapsed Sidebar too.

The split-view corners took more work than I expected. Moving the page clipping and focus ring into the same container made the biggest difference.

**Install through Sine:** add `kkugot/blended-addressbar` as the repository.

[Repository and settings](https://github.com/kkugot/blended-addressbar) · [Full changelog](https://github.com/kkugot/blended-addressbar/blob/main/CHANGELOG.md) · [Changes since the first release](https://github.com/kkugot/blended-addressbar/blob/main/docs/releases/1.6.1.md)

If something looks off, send a screenshot with your Zen version, OS, and layout. Those details help a lot with the corner and spacing bugs.
