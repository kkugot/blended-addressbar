# Marketplace Release Checklist

## Ready

- Name: `Blended Addressbar` (18 characters).
- Version: `0.9.4`.
- Description: `A page-aware addressbar that blends Zen chrome with the active website.` (71 characters).
- Metadata: `theme.json`.
- Preferences: `preferences.json`.
- README: `README.md`.
- Zen target: `fork: ["zen"]`.

## Required Before Submission

- Publish the mod in a public GitHub repository.
- Add a license file so the mod is explicitly open source.
- Add a marketplace screenshot image. Zen Mods Registry expects a `600x400` PNG. Candidate: `blended-addressbar.png`.
- Confirm `homepage` in `theme.json` points to the public repository URL.
- For Sine store listing, use absolute public URLs for `readme` and `image` in the marketplace entry.

## Suggested Sine Store Entry

```json
{
  "id": "blended-addressbar",
  "name": "Blended Addressbar",
  "description": "A page-aware addressbar that blends Zen chrome with the active website.",
  "homepage": "https://github.com/kkugot/blended-addressbar",
  "readme": "https://raw.githubusercontent.com/kkugot/blended-addressbar/main/README.md",
  "image": "https://raw.githubusercontent.com/kkugot/blended-addressbar/main/blended-addressbar.png",
  "author": "Kostiantyn Kugot",
  "version": "0.9.4",
  "updatedAt": "2026-05-13",
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
  ],
  "js": true
}
```
