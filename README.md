# Enhanced Typography Playground Pro

A single-file typography playground for experimenting with variable fonts, OpenType features, fluid type, color systems, contrast, accessibility stress checks, animation, presets, and exportable code.

## Overview

This project is a standalone HTML app. It does not require a build step, package install, or framework. Open `index.html` directly in a browser, or serve the folder over localhost if you want the most reliable clipboard, font-loading, and export behavior.

## Features

- Live text preview with editable content, element type, language, links, and specimen presets.
- Font controls for system fonts, Google Fonts, variable axes, weight, stretch, optical sizing, spacing, and fluid `clamp()` output.
- Decoration controls for gradients, text stroke, shadow, filters, underlines, block padding, radius, columns, hyphenation, and writing modes.
- OpenType controls for ligatures, numeric variants, and raw feature settings.
- Research lab with WCAG text-spacing stress mode, contrast metrics, estimated characters per line, type scale previews, type pairing, color-vision simulation, and browser support checks.
- Smart presets for editorial, poster, UI, code, accessible, and neon treatments.
- Design audit panel for contrast, line-height, measure, tracking, motion, and optical sizing warnings.
- Export tools for standalone HTML, preset JSON, PNG, SVG, CSS variables, share URLs, and generated HTML/CSS/JS/state JSON.
- Sandboxed JavaScript runner for quick code experiments.

## Run

Open the file directly:

```text
index.html
```

Or serve it locally:

```bash
python -m http.server 5173 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:5173/index.html
```

## Accessibility Tools

The playground includes checks inspired by WCAG guidance:

- WCAG 2.x contrast ratios for normal and large text.
- AAA contrast status where applicable.
- Text-spacing stress mode using line-height, letter-spacing, and word-spacing thresholds from WCAG 1.4.12.
- Reduced-motion handling for animations.
- Safe link protocol handling for previewed anchors.
- Browser support reporting for variable fonts, optical sizing, `text-wrap`, `color-mix`, background-clipped text, and canvas export.

The experimental `Lc` contrast badge is a perceptual-style helper, not a replacement for WCAG conformance.

## Workflow

1. Choose or paste text in the Content panel.
2. Pick a font and adjust size, weight, axes, rhythm, layout, and effects.
3. Use Smart tools or Auto tune for a quick baseline.
4. Run the Research lab tools to stress spacing, measure, contrast, support, and color perception.
5. Copy generated code or export a standalone snippet, image, SVG, or preset JSON.

## Files

- `index.html` - the full app, styles, controls, preview, and export logic.
- `README.md` - project documentation.

## Notes

- Google Fonts are loaded only when selected.
- The app stores the last state and local presets in `localStorage`.
- Clipboard features may need localhost or a secure browser context.
- PNG and SVG exports approximate the live DOM styling; generated HTML/CSS is the most faithful export path.
