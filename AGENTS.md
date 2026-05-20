# AGENTS.md

## Overview

This directory contains Blended Addressbar, a Zen Browser UI mod that overhauls the dual-toolbar addressbar with page-aware adaptive colors.

- `blended-bar.uc.js`: userChrome script that reads active-page colors and writes CSS custom properties for the header background and foreground colors.
- `style.css`: main chrome stylesheet for layout and header styling.
- `styles/loadbar.css`: loading bar styling and related preference-driven behavior.
- `theme.json`: Zen mod metadata and entry points.
- `preferences.json`: exposed mod preferences.

## Working Rules

- Keep changes small and targeted. This mod has no build step and is loaded directly by Zen.
- Preserve the split between behavior and presentation:
  - put sampling, browser lifecycle, and CSS variable logic in `blended-bar.uc.js`
  - put visual styling in `style.css` or `styles/*.css`
- Prefer extending existing CSS variables over hardcoding new duplicated values.
- Avoid adding dependencies, bundlers, or generated assets.
- Maintain compatibility with Zen chrome context APIs already used here (`gBrowser`, progress listeners, chrome DOM access).

## Editing Guidance

- When changing the adaptive header behavior, verify both background and foreground colors still update together.
- Be careful with polling or sampling interval changes in `blended-bar.uc.js`; they affect browser chrome performance.
- Keep selectors scoped to Zen-specific UI where possible to avoid unintended Firefox chrome regressions.
- If you add a new user-facing preference, update `preferences.json` and wire the behavior in CSS or script.
- If you add new files, register them in `theme.json` only when Zen needs them as explicit entry points.

## Manual Validation

There is no automated test suite in this directory. Validate changes manually in Zen Browser:

1. Reload the mod or restart the browser/profile.
2. Open pages with clearly different top-edge colors and switch between tabs.
3. Confirm the header background updates, text/icons remain legible, and no flicker or stuck colors appear.
4. Check both normal pages and Zen-specific states such as compact mode, glance overlays, and loading progress.
5. If CSS changes touch layout, verify dual-toolbar spacing, border radius, and overflow clipping still look correct.
