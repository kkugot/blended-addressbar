# Blended Addressbar

An addressbar that belongs to the page.

Blended Addressbar is a Zen Browser mod that reshapes the dual-toolbar addressbar into a page-aware browser frame with adaptive colors.

![Blended Addressbar preview](blended-addressbar.png)

## Demo

![Blended Addressbar demo](video-demo.gif)

## Features

- Adaptive addressbar background and foreground colors from active-page semantic colors.
- Readability guardrails for adaptive foreground colors.
- Compact framed browser surface with subtle spacing, radius, and shadow.
- Configurable browser frame corner radius.
- Compact-mode toolbar icon colors that follow the addressbar foreground.
- Optional sidebar blending that applies the active page colors to Zen sidebar controls.
- Preference-driven loading bar height, opacity, and color source.

## Preferences

The mod exposes its settings through `preferences.json`.

- `uc.blended-addressbar.sidebar.enabled`: blend Zen sidebar controls with the active page colors.
- `uc.blended-addressbar.frame-radius`: browser frame corner radius as a CSS length, such as `8px` or `0`.
- `uc.loadbar.position`: choose a full-width left-to-right loading bar or a centered loading bar.
- `uc.loadbar.color-source`: choose Zen primary color, page foreground, page background, or a custom color.
- `uc.loadbar.color`: custom loading bar color.
- `uc.loadbar.height`: loading bar height.
- `uc.loadbar.opacity`: loading bar opacity as a percentage.
- `uc.loadbar.roundedcorner`: enable rounded loading bar corners.
- `uc.loadbar.shadow`: enable loading bar shadow.

## Manual Installation

Blended Addressbar is installed through [Sine](https://github.com/CosmoCreeper/Sine). Install and enable Sine first, then:

1. Copy this folder into your Zen profile's `chrome/sine-mods` directory.
2. Reload Sine mods or restart Zen Browser.
3. Enable `Blended Addressbar` from Sine settings.

## Compatibility

This mod targets Zen Browser dual-toolbar layouts. Compact mode is supported, but visual validation is still recommended after Zen updates because browser chrome selectors can change.
