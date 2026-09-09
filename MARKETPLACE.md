# Marketplace Release Checklist

## Ready

- Name: `Blended Addressbar` (18 characters).
- Version: `1.6.0`.
- Description: `A page-aware addressbar that blends Zen chrome with the active website.` (71 characters).
- Metadata: `theme.json`.
- Preferences: `preferences.json`.
- README: `README.md`.
- Zen target: `fork: ["zen"]`.
- Public repository and homepage: `https://github.com/kkugot/blended-addressbar`.
- License: `LICENSE` (MIT).
- Marketplace screenshot: `marketplace-preview.png` (600 × 400 PNG).

## Required Before Submission

- Complete visual validation in Zen for both toolbar layouts, split view, compact mode, Glance, and fullscreen.
- Merge the release PR so the public README and metadata match this entry.
- Submit the Sine store entry with the absolute URLs below.

## Suggested Sine Store Entry

```json
{
  "id": "blended-addressbar",
  "name": "Blended Addressbar",
  "description": "A page-aware addressbar that blends Zen chrome with the active website.",
  "homepage": "https://github.com/kkugot/blended-addressbar",
  "readme": "https://raw.githubusercontent.com/kkugot/blended-addressbar/main/README.md",
  "image": "https://raw.githubusercontent.com/kkugot/blended-addressbar/main/marketplace-preview.png",
  "author": "Kostiantyn Kugot",
  "version": "1.6.0",
  "ai": "partial",
  "updatedAt": "2026-09-09",
  "style": {
    "chrome": "style.css",
    "content": ""
  },
  "scripts": {
    "blended-bar.uc.js": {
      "include": [
        "chrome://browser/content/browser.xhtml"
      ]
    }
  },
  "preferences": "preferences.json",
  "tags": [
    "addressbar",
    "urlbar",
    "sidebar",
    "adaptive",
    "theming",
    "zen browser"
  ],
  "fork": [
    "zen"
  ]
}
```
