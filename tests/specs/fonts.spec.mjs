import { test, expect, settle } from './helpers.mjs';
import { makeTTF, makeWOFF, woffHasCompressedTable, EXPECTED } from '../fixtures/make-font.mjs';
import { existsSync } from 'node:fs';

const toArray = buffer => Array.from(new Uint8Array(buffer));

test.describe('font catalogue', () => {
  test('ships the whole Google Fonts catalogue with real axis data', async ({ lab }) => {
    const summary = await lab.page.evaluate(() => {
      const fonts = window.fontLab.fonts;
      const google = fonts.filter(f => f.source === 'google');
      const variable = google.filter(f => f.axes.length);
      const inter = window.fontLab.getFont('gf:Inter');
      const robotoFlex = window.fontLab.getFont('gf:Roboto Flex');
      return {
        total: fonts.length,
        google: google.length,
        variable: variable.length,
        system: fonts.filter(f => f.source === 'system').length,
        categories: [...new Set(google.map(f => f.cat))].sort(),
        interAxes: inter.axes,
        robotoFlexAxisCount: robotoFlex.axes.length,
        duplicateIds: fonts.length - new Set(fonts.map(f => f.id)).size
      };
    });

    expect(summary.google).toBeGreaterThan(1500);
    expect(summary.variable).toBeGreaterThan(400);
    expect(summary.system).toBeGreaterThan(8);
    expect(summary.categories).toEqual(['d', 'f', 'h', 'm', 's']);
    expect(summary.duplicateIds).toBe(0);
    expect(summary.interAxes).toEqual([
      { tag: 'opsz', min: 14, max: 32, def: 14, name: 'Optical Size' },
      { tag: 'wght', min: 100, max: 900, def: 400, name: 'Weight' }
    ]);
    expect(summary.robotoFlexAxisCount).toBeGreaterThan(10);
  });

  test('builds valid Google Fonts css2 URLs', async ({ lab }) => {
    const urls = await lab.page.evaluate(() => {
      const { googleHref, getFont } = window.fontLab;
      return {
        inter: googleHref(getFont('gf:Inter'), false),
        interItalic: googleHref(getFont('gf:Inter'), true),
        spaced: googleHref(getFont('gf:Libre Baskerville'), false),
        system: googleHref(getFont('sys:georgia'), false)
      };
    });

    expect(urls.inter).toBe('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,100..900&display=swap');
    // Italic uses the tuple form, upright first.
    expect(urls.interItalic).toBe('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap');
    // Spaces become plus signs, as the API requires.
    expect(urls.spaced).toContain('family=Libre+Baskerville');
    // System stacks never hit the network.
    expect(urls.system).toBe('');
  });

  test('custom uppercase axes sort after the registered lowercase ones', async ({ lab }) => {
    const url = await lab.page.evaluate(() =>
      window.fontLab.googleHref(window.fontLab.getFont('gf:Roboto Flex'), false)
    );
    const spec = decodeURIComponent(url.split('family=')[1].split('&')[0]);
    const tags = spec.split(':')[1].split('@')[0].split(',');
    const firstUpper = tags.findIndex(t => /^[A-Z]/.test(t));
    expect(firstUpper).toBeGreaterThan(0);
    // Nothing lowercase may appear after the first uppercase tag.
    expect(tags.slice(firstUpper).every(t => /^[A-Z]/.test(t))).toBe(true);
    // And each group is alphabetical.
    const lower = tags.slice(0, firstUpper);
    expect(lower).toEqual([...lower].sort());
  });

  test('searching and filtering the catalogue', async ({ lab }) => {
    const { page } = lab;
    await page.click('#fontSearch');
    await page.fill('#fontSearch', 'fraun');
    await expect(page.locator('#fontResults [role="option"]')).toHaveCount(1);
    await page.locator('#fontResults [role="option"]').first().click();
    await settle(page);
    expect(await page.evaluate(() => window.fontLab.state.fontId)).toBe('gf:Fraunces');
    // Fraunces exposes four axes, each with its own slider.
    await expect(page.locator('#axesContainer .axisRow')).toHaveCount(4);

    const monoOnly = await page.evaluate(() => {
      document.querySelectorAll('#fontFilters .chip').forEach(chip => {
        if (chip.textContent === 'Mono') chip.click();
      });
      return window.fontLab.searchFonts('', 400).every(font => font.cat === 'm');
    });
    expect(monoOnly).toBe(true);
  });

  test('font-variation-settings only names axes it has to', async ({ lab }) => {
    const css = await lab.page.evaluate(() => {
      const fl = window.fontLab;
      const out = {};
      fl.apply({ fontId: 'gf:Inter', weight: 600, opticalAuto: 'off', axes: {} });
      out.untouched = fl.code.css();
      fl.apply({ fontId: 'gf:Inter', weight: 600, opticalAuto: 'on', size: 24, axes: {} });
      out.autoOpsz = fl.code.css();
      fl.apply({ fontId: 'gf:Fraunces', axes: { SOFT: 40, wght: 500 } });
      out.custom = fl.code.css();
      return out;
    });

    // Weight is expressed by font-weight, so nothing needs the escape hatch.
    expect(css.untouched).not.toContain('font-variation-settings');
    expect(css.untouched).toContain('font-weight: 600');
    // Linking opsz to the size does need it.
    expect(css.autoOpsz).toContain('font-variation-settings: "opsz" 24');
    // A custom axis is written out; wght stays with font-weight.
    expect(css.custom).toContain('"SOFT" 40');
    expect(css.custom).not.toContain('"wght"');
  });
});

test.describe('OpenType parsing', () => {
  test('reads axes, instances, features and metrics from a TrueType file', async ({ lab }) => {
    const info = await lab.page.evaluate(async bytes => {
      const buffer = new Uint8Array(bytes).buffer;
      return window.fontLab.fontFile.inspect(buffer);
    }, toArray(makeTTF()));

    expect(info.family).toBe(EXPECTED.family);
    expect(info.subfamily).toBe('Variable');
    expect(info.version).toBe('Version 2.000');
    expect(info.axes).toEqual(EXPECTED.axes);
    expect(info.instances).toEqual(EXPECTED.instances);
    expect(info.features).toEqual(EXPECTED.features);
    expect(info.metrics).toMatchObject({
      unitsPerEm: EXPECTED.unitsPerEm,
      xHeight: EXPECTED.xHeight,
      capHeight: EXPECTED.capHeight,
      weightClass: EXPECTED.weightClass,
      ascender: 880,
      descender: -220
    });
  });

  test('reads the same font back out of a WOFF 1 container', async ({ lab }) => {
    expect(woffHasCompressedTable(), 'fixture should exercise the inflate path').toBe(true);
    const info = await lab.page.evaluate(async bytes => {
      const buffer = new Uint8Array(bytes).buffer;
      return window.fontLab.fontFile.inspect(buffer);
    }, toArray(makeWOFF()));

    expect(info.family).toBe(EXPECTED.family);
    expect(info.axes).toEqual(EXPECTED.axes);
    expect(info.instances).toEqual(EXPECTED.instances);
    expect(info.features).toEqual(EXPECTED.features);
    expect(info.metrics.unitsPerEm).toBe(EXPECTED.unitsPerEm);
  });

  test('rejects files that are not fonts, and flags WOFF2 as opaque', async ({ lab }) => {
    const errors = await lab.page.evaluate(async () => {
      const attempt = async bytes => {
        try {
          await window.fontLab.fontFile.inspect(new Uint8Array(bytes).buffer);
          return 'parsed';
        } catch (error) { return error.message; }
      };
      const woff2 = [0x77, 0x4f, 0x46, 0x32, 0, 1, 0, 0, 0, 0, 0, 16];
      return {
        tiny: await attempt([1, 2, 3]),
        garbage: await attempt([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        woff2: await attempt(woff2)
      };
    });
    expect(errors.tiny).toContain('too small');
    expect(errors.garbage).toContain('Unrecognised');
    expect(errors.woff2).toBe('woff2');
  });
});

test.describe('loading a font from disk', () => {
  /* A real, renderable font is needed for the full FontFace path: the
     synthetic fixtures above carry no outlines, so the browser's font
     sanitiser rejects them by design. Most Linux images ship DejaVu; where it
     is missing the test skips rather than pretending to pass. */
  const DEJAVU = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';

  test('a dropped .ttf becomes a selectable family with its own metrics', async ({ lab }) => {
    test.skip(!existsSync(DEJAVU), 'no DejaVu Sans on this machine');
    const { page } = lab;

    await page.setInputFiles('#fontFileInput', DEJAVU);
    // Wait for the family to be on screen, not merely for the state to flip:
    // the preview is painted a frame later.
    await page.waitForFunction(() =>
      window.fontLab.state.fontId.startsWith('user:')
      && getComputedStyle(document.getElementById('previewText')).fontFamily.includes('FontLab'));

    const loaded = await page.evaluate(() => {
      const fl = window.fontLab;
      const font = fl.getFont(fl.state.fontId);
      return {
        label: font.label,
        source: font.source,
        features: font.features,
        unitsPerEm: font.metrics.unitsPerEm,
        xHeight: fl.metrics.measureFont(font).xHeight,
        css: fl.code.css(),
        rendered: getComputedStyle(document.getElementById('previewText')).fontFamily
      };
    });

    expect(loaded.source).toBe('user');
    expect(loaded.label).toContain('DejaVu Sans');
    expect(loaded.unitsPerEm).toBe(2048);
    expect(loaded.features).toContain('kern');
    // The family really is rendering, so its metrics are measurable.
    expect(loaded.rendered).toContain('FontLab');
    expect(loaded.xHeight).toBeGreaterThan(0.4);
    expect(loaded.xHeight).toBeLessThan(0.7);
    // A local file must never turn into a Google Fonts request.
    expect(loaded.css).not.toContain('fonts.googleapis.com');

    // Its OpenType features become toggles that write font-feature-settings.
    const chips = page.locator('#featureChips .chip');
    await expect(chips).not.toHaveCount(0);
    await chips.first().click();
    await settle(page);
    expect(await page.evaluate(() => window.fontLab.code.css())).toContain('font-feature-settings');
  });
});
