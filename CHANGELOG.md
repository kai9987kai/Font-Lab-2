# Changelog

## 2.0.0

A rebuild of the playground into a typography research lab. Still one HTML
file, still no build step.

### Added

**Typefaces**
- The complete Google Fonts catalogue: 1,946 families, 558 of them variable,
  across 48 variation axes, with ranges and defaults taken from the Google Fonts
  metadata endpoint. Previously eleven hard-coded families.
- A searchable font picker with classification and variable-only filters.
- Loading fonts from disk by button or drag and drop, with an OpenType parser
  that reads `fvar` axes and named instances, `name` records, `OS/2` and `hhea`
  metrics and the `GSUB`/`GPOS` feature list. TrueType, CFF and WOFF 1
  containers are read directly; WOFF 2 renders but is not introspected.
- Detected OpenType features become toggles that write `font-feature-settings`.
- Named-instance selection for variable fonts.
- Installed system families through the Local Font Access API where available.

**Measurement**
- A metrics engine built on the Canvas text metrics API: measured x-height, cap
  height, ascent and descent, cached per family, weight and style.
- Characters per line measured from the real content box and the average advance
  of the current text, replacing the previous `fontSize × 0.52` estimate.
- `text-box-trim` support with a measured fallback and an `@supports` block in
  the exported CSS.
- x-height matching for font pairing.
- Flesch Reading Ease, Flesch-Kincaid grade level and reading time, replacing
  the previous ad-hoc readability score.

**Colour**
- APCA implemented from the published APCA-W3 `0.98G-4g` constants, including
  the black soft-clamp and low-contrast clip, plus the APCA font lookup table
  for minimum usable size at a given Lc and weight. The previous release carried
  a rough approximation labelled experimental.
- A contrast solver that moves lightness in OKLCh to hit a WCAG or APCA target
  while preserving hue and chroma, replacing the black-or-white swap.
- Colour-vision simulation using the Machado, Oliveira & Fernandes (2009)
  matrices with a 0–1 severity slider, applied in linear RGB.
- Greyscale, glare and low-acuity simulations.

**Accessibility**
- WCAG 1.4.10 reflow simulation at 320 and 256 CSS px.
- WCAG 1.4.4 resize simulation at 150%, 200% and 400%, composed correctly with
  the reflow width.
- A design audit with a severity per finding, covering contrast under both
  models, measure, rhythm, tracking, motion, target size, x-height and reading
  ease.
- A reading ruler.

**Views**
- Waterfall, paragraph proof, glyph inspector and spacing/kerning proof, in
  addition to the live stage.
- The glyph inspector probes coverage per codepoint across nine Unicode ranges
  and reports what the font is missing.

**Exports**
- W3C Design Tokens (DTCG) output with a composite typography token.
- Tailwind CSS v4 `@theme` output.
- Two-anchor fluid type scales producing `clamp()` per step, alongside the
  modular scale.
- PNG at 2× and SVG laid out with measured advances, so snapshots break lines
  where the preview does. PNG now honours tracking, word spacing and the
  gradient angle; SVG positions the first baseline from measured ascent.
- Per-tab download, print stylesheet, and share links that encode only the
  difference from the defaults.

**Interface**
- A command palette (<kbd>Ctrl/Cmd</kbd> + <kbd>K</kbd>) and keyboard shortcuts
  that stay inert while typing.
- Focus-trapped dialogs that close on <kbd>Escape</kbd>, a skip link, and
  `aria-pressed`/`aria-selected` state on toggles and tabs.
- A three-way theme control: system, light, dark.
- Content direction control and RTL specimens; Greek, Cyrillic, Arabic,
  diacritic and punctuation proofs.

**Engineering**
- A Playwright suite covering the colour maths against published
  reference values, the state schema against hostile input, the OpenType parser
  against synthetic TrueType and WOFF fixtures built at test time, the measured
  metrics, and the UI end to end. Any page or console error fails the test.
- A GitHub Actions workflow running the suite and a syntax check of the inline
  script.

### Changed

- The app is now `index.html`, which the README always documented and which
  serves as the default document. `main.html` forwards, preserving any
  `#type=…` fragment.
- Fonts are identified by a stable id (`gf:Inter`) rather than an index into a
  fixed array, so share links and presets survive catalogue changes. 1.x indices
  are migrated.
- State is described by a schema. Every value from a share link, preset file,
  `localStorage` or control is coerced into its declared range and unknown keys
  are dropped.
- Undo coalesces edits to the same control within 700ms, so dragging a slider is
  one undo step rather than hundreds.
- `font-variation-settings` now only names axes that cannot be expressed by
  `font-weight`, `font-stretch` or `font-optical-sizing`, so those properties
  keep working and the exported CSS stays idiomatic.
- Generated CSS omits properties left at their default and uses class selectors
  rather than ids.
- Free-text CSS fields are validated with `CSS.supports()` after stripping
  rule-escaping characters; `url()` and similar functions are refused.

### Fixed

- A `ch` measure resolved against the interface font rather than the sample, so
  a 16ch headline was roughly 128px wide whatever the type size. The preview
  block and the exported `.type-block` now carry the sample's family and size.
- `Number(null)` and `Number('')` coerced to the schema minimum instead of the
  default, so a malformed preset could silently collapse a measure to 8ch.
- PNG export ignored device pixel ratio, tracking, word spacing and the gradient
  angle.
- SVG export broke lines by character count rather than measured width, and put
  the first baseline at a fixed offset.
- The exported CSS dropped `white-space: pre-wrap`, so multi-line text collapsed
  outside the lab.
- Reduced-motion preference changes did not re-render the preview.
