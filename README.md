# Font Lab

A typography research playground in a single HTML file. No build step, no
package install, no framework, no telemetry. Open `index.html` and you have the
whole Google Fonts catalogue, real variable-font axes, measured font metrics,
WCAG and APCA contrast analysis, accessibility stress tests and
production-ready exports.

```bash
# Open it directly
open index.html

# …or serve it, which is better for clipboard access and font loading
python3 -m http.server 5173 --bind 127.0.0.1
# then visit http://127.0.0.1:5173/
```

---

## What it does

### The typefaces

- **1,946 Google Fonts families** are built in, including **558 variable
  families** across **48 distinct variation axes**. Axis ranges and defaults
  come from the Google Fonts metadata endpoint, so the sliders match what the
  API will actually serve. Thirteen system stacks are listed alongside them.
- **Search and filter** the catalogue by name, classification, or whether the
  family is variable.
- **Load your own fonts** by dropping a `.ttf`, `.otf`, `.woff` or `.woff2` file
  onto the page. Nothing is uploaded — the file is read in the browser.
- **Inspect what you load.** Font Lab parses the sfnt container directly and
  reads the `fvar` axes and named instances, the `name` records, the `OS/2` and
  `hhea` vertical metrics, and the `GSUB`/`GPOS` feature list. Detected features
  become toggles that write real `font-feature-settings`. (WOFF 2 is Brotli
  compressed and browsers expose no Brotli decoder, so those files render but
  are not introspected — the UI says so.)
- **Installed fonts** can be added through the Local Font Access API where the
  browser supports it.

### The measurements

Most type tools estimate. This one measures, using the Canvas text metrics API
against the font as it is actually rendering:

| Readout | How it is derived |
| --- | --- |
| x-height, cap height, ascent, descent | measured ink bounds at a 100px em, cached per family/weight/style |
| Characters per line | the real content box width divided by the average advance of *your* text, not a guess from the font size |
| Leading trim | `text-box-trim` where the browser has it, otherwise the same result computed from measured metrics and emitted as an `@supports` fallback |
| x-height matching | pairs a second family by scaling it until its measured x-height matches the display face |
| Reading ease | Flesch Reading Ease and Flesch-Kincaid grade level, plus reading time at 238 wpm |

### The contrast work

- **WCAG 2.2** ratios with the correct large-text threshold (24px, or 18.66px at
  weight 700 or above).
- **APCA**, implemented from the published APCA-W3 `0.98G-4g` constants,
  including the black soft-clamp and the low-contrast clip. Black on white
  returns Lc 106.04 and white on black returns Lc −107.88, matching the
  reference implementation. The accompanying font lookup table turns an Lc value
  and a weight into a minimum usable font size.
- **A colour solver** that hits your contrast target by moving lightness in
  OKLCh, so the hue and chroma you chose survive the fix. It works against either
  the WCAG or the APCA target.
- **Gradients are scored on their weakest pairing**, not an average, so a
  gradient that fails anywhere fails here.
- **Colour-vision simulation** using the Machado, Oliveira & Fernandes (2009)
  matrices with a severity slider from 0 to 1, applied in linear RGB (the SVG
  filter declares `color-interpolation-filters="linearRGB"`, which is what the
  model assumes). Greyscale, glare and low-acuity simulations sit alongside.

### The accessibility lab

- **WCAG 1.4.12** text-spacing stress: forces line height to 1.5, tracking to
  0.12em and word spacing to 0.16em so you can see whether the layout survives a
  reader's own settings.
- **WCAG 1.4.10 reflow** at 320 or 256 CSS px, and **1.4.4 resize** at 150%,
  200% or 400%. The two compose the way a browser composes them: a 320px
  viewport at 200% zoom leaves 160 CSS px of layout width.
- **A design audit** that reports contrast, measure, rhythm, tracking, motion,
  target size and reading ease against the current role, with a severity per
  finding.
- A reading ruler, a baseline grid, and a safe-area guide.

### The views

| View | For |
| --- | --- |
| **Stage** | the live composition, with a ghost-compare overlay against a captured baseline |
| **Waterfall** | one line at each of eighteen sizes, which is how optical sizing shows itself |
| **Proof** | running paragraphs at your measure, with punctuation and numeral proofs |
| **Glyphs** | coverage probing across nine Unicode ranges, rendered per codepoint and compared against the font's own missing-glyph box; click to append a character |
| **Spacing** | `HHHOOO` rhythm strings, ambiguous-glyph rows, and 25 kerning pairs |

### The exports

- **CSS** that only emits what differs from the browser default, with an
  `@supports` fallback for leading trim and a `prefers-reduced-motion` guard.
- **Design tokens** in the W3C Design Tokens Community Group format, including a
  composite `typography` token and the measured metrics as `$extensions`.
- **Tailwind CSS v4** `@theme` block.
- **HTML**, a **standalone page**, and a **JS** style object.
- **PNG at 2×** and **SVG**, both laid out with the same measured advances the
  metrics panel uses, so a snapshot breaks lines where the preview does. The SVG
  keeps live, selectable text.
- **Share links** that encode only what differs from the defaults — a typical
  link is a couple of hundred characters rather than two kilobytes.

### Type scales

A modular scale with named ratios, or a **two-anchor fluid scale** where the
small viewport uses one ratio and the large viewport a wider one, so headings
grow faster than body text. Either way you get `clamp()` expressions ready to
paste.

---

## Keyboard

| Key | Action |
| --- | --- |
| <kbd>Ctrl/Cmd</kbd> + <kbd>K</kbd> | command palette |
| <kbd>Ctrl/Cmd</kbd> + <kbd>Z</kbd> / <kbd>Shift</kbd> + <kbd>Z</kbd> | undo / redo |
| <kbd>1</kbd>–<kbd>5</kbd> | switch preview mode |
| <kbd>G</kbd> | baseline grid |
| <kbd>R</kbd> | randomise a readable style |
| <kbd>A</kbd> | run the design audit |
| <kbd>?</kbd> | shortcuts, method notes, and the current font's details |

Shortcuts stay out of the way while you are typing in a field.

---

## Privacy and safety

- Nothing is uploaded. Fonts you load are read locally with `FontFace`.
- The only network request is the Google Fonts stylesheet for the family you
  select, and only when you select one. System stacks make no request at all.
- Every value that reaches the app — from a share link, a preset file,
  `localStorage` or a control — passes through a schema that drops unknown keys
  and coerces every known one into its declared range. Free-text CSS fields have
  rule-escaping characters stripped and are then validated with `CSS.supports()`,
  so a value the browser will not accept never reaches the preview or an export.
  `url()` and friends are refused outright.
- Links in the preview are restricted to `http`, `https`, `mailto` and `tel`.
- The JavaScript sandbox runs in a cross-origin `sandbox="allow-scripts"` frame
  and receives a copy of the state, nothing else.

## Browser support

Chromium 111+, Safari 16.4+ and Firefox 128+ run everything that is not
explicitly feature-detected. **Feature support** in the accessibility lab reports
what your browser actually has. Features that degrade rather than break:

| Feature | Without it |
| --- | --- |
| `text-box-trim` | offsets are computed from measured metrics instead |
| Local Font Access API | the button explains the alternative |
| Brotli in `DecompressionStream` | WOFF 2 renders but is not introspected |
| Canvas `letterSpacing` | PNG export ignores tracking |
| Clipboard API | falls back to a hidden textarea |

## Upgrading from 1.x

Saved states, presets and share links from the previous version are migrated
automatically: the old numeric font index maps onto the new stable font ids, and
the renamed keys are translated. `main.html` now forwards to `index.html`,
carrying any `#type=…` fragment with it.

---

## Tests

The app has no dependencies. The tests do — they drive the real page in
Chromium.

```bash
cd tests
npm ci
npx playwright install --with-deps chromium
npm test
```

Five specs cover the colour maths against published reference
values, the state schema against hostile input, the OpenType parser against
synthetic TrueType and WOFF containers built at test time, the measured metrics,
and the whole UI end to end including exports, share links and the mobile
layout. Any page error or console error fails the test that produced it. CI runs
the same suite on every push.

## Files

| File | |
| --- | --- |
| `index.html` | the entire app: markup, styles, catalogue and logic |
| `main.html` | a redirect for links to the 1.x filename |
| `tests/` | the Playwright suite, its fixtures and a small static server |

## Licence

MIT. See [LICENSE](LICENSE).

The Google Fonts catalogue metadata is published by Google; the fonts themselves
are served by Google Fonts under their own licences. The APCA constants and font
lookup table are from the Myndex APCA-W3 reference implementation. The
colour-vision matrices are from Machado, Oliveira & Fernandes, *A
Physiologically-Based Model for Simulation of Color Vision Deficiency*, IEEE
TVCG 15(6), 2009.
