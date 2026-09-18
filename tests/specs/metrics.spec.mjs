import { test, expect } from './helpers.mjs';

test.describe('measured metrics', () => {
  test('font metrics come back in plausible em-relative ranges', async ({ lab }) => {
    const metrics = await lab.page.evaluate(() => {
      const fl = window.fontLab;
      return fl.metrics.measureFont(fl.getFont('sys:system-ui'));
    });
    expect(metrics.supported).toBe(true);
    expect(metrics.xHeight).toBeGreaterThan(0.3);
    expect(metrics.xHeight).toBeLessThan(0.8);
    expect(metrics.capHeight).toBeGreaterThan(metrics.xHeight);
    expect(metrics.capHeight).toBeLessThan(1);
    expect(metrics.ascent + metrics.descent).toBeGreaterThan(0.9);
    expect(metrics.lowercaseAdvance).toBeGreaterThan(0.2);
    expect(metrics.spaceAdvance).toBeGreaterThan(0.1);
  });

  test('characters per line tracks the measure, not the font size', async ({ lab }) => {
    const samples = await lab.page.evaluate(async () => {
      const fl = window.fontLab;
      const read = async patch => {
        fl.apply(Object.assign({ fontId: 'sys:system-ui', text: 'lorem ipsum dolor sit amet '.repeat(30) }, patch));
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        return fl.metrics.measuredCPL();
      };
      return {
        narrow: await read({ maxWidth: 20, size: 16 }),
        wide: await read({ maxWidth: 60, size: 16 }),
        // A measure in ch scales with the type, so the same 20ch at double the
        // size should still hold about the same number of characters.
        narrowLarge: await read({ maxWidth: 20, size: 32 })
      };
    });

    expect(samples.narrow).toBeGreaterThan(8);
    expect(samples.wide).toBeGreaterThan(samples.narrow * 2);
    // Allow slack for sub-pixel advances and hinting at different sizes.
    expect(Math.abs(samples.narrow - samples.narrowLarge)).toBeLessThan(samples.narrow * 0.25);
  });

  test('WCAG 1.4.12 stress raises spacing to the required minimums', async ({ lab }) => {
    const values = await lab.page.evaluate(() => {
      const fl = window.fontLab;
      fl.apply({ size: 20, lineHeight: 1.1, letterSpacing: 0, wordSpacing: 0, spacingStress: 'off' });
      const before = {
        lineHeight: fl.metrics.activeLineHeight(),
        letterSpacing: fl.metrics.activeLetterSpacing(),
        wordSpacing: fl.metrics.activeWordSpacing()
      };
      fl.apply({ size: 20, lineHeight: 1.1, letterSpacing: 0, wordSpacing: 0, spacingStress: 'wcag' });
      const after = {
        lineHeight: fl.metrics.activeLineHeight(),
        letterSpacing: fl.metrics.activeLetterSpacing(),
        wordSpacing: fl.metrics.activeWordSpacing()
      };
      return { before, after };
    });

    expect(values.before).toEqual({ lineHeight: 1.1, letterSpacing: 0, wordSpacing: 0 });
    // The success criterion's thresholds: 1.5 line height, 0.12em tracking,
    // 0.16em word spacing.
    expect(values.after.lineHeight).toBeCloseTo(1.5, 5);
    expect(values.after.letterSpacing).toBeCloseTo(0.12, 5);
    expect(values.after.wordSpacing).toBeCloseTo(20 * 0.16, 5);
  });

  test('rhythm lock snaps the line box onto the grid', async ({ lab }) => {
    const boxes = await lab.page.evaluate(() => {
      const fl = window.fontLab;
      const box = () => Math.round(fl.state.size * fl.metrics.activeLineHeight() * 1000) / 1000;
      fl.apply({ size: 17, lineHeight: 1.37, rhythmLock: 'off' });
      const loose = box();
      fl.apply({ size: 17, lineHeight: 1.37, rhythmLock: '4' });
      const four = box();
      fl.apply({ size: 17, lineHeight: 1.37, rhythmLock: '8' });
      const eight = box();
      return { loose, four, eight };
    });

    expect(boxes.loose).toBeCloseTo(23.29, 1);
    expect(boxes.four % 4).toBeLessThan(0.05);
    expect(boxes.eight % 8).toBeLessThan(0.05);
  });

  test('leading-trim offsets come from the measured metrics', async ({ lab }) => {
    const offsets = await lab.page.evaluate(() => {
      const fl = window.fontLab;
      const metrics = { ascent: 0.95, descent: 0.25, capHeight: 0.7, xHeight: 0.5 };
      return {
        cap: fl.metrics.trimOffsets(100, 1.5, metrics, 'cap alphabetic'),
        ex: fl.metrics.trimOffsets(100, 1.5, metrics, 'ex alphabetic'),
        text: fl.metrics.trimOffsets(100, 1.5, metrics, 'text alphabetic'),
        tight: fl.metrics.trimOffsets(100, 1.2, metrics, 'cap alphabetic')
      };
    });

    // Line box 150, content box 120, so half-leading is 15 on each side.
    // cap trim also removes the 25px between ascent and cap height.
    expect(offsets.cap).toEqual({ top: 40, bottom: 40 });
    expect(offsets.ex).toEqual({ top: 60, bottom: 40 });
    expect(offsets.text).toEqual({ top: 15, bottom: 40 });
    // A tighter line box means less half-leading to remove.
    expect(offsets.tight.top).toBe(25);
  });

  test('readability statistics follow the Flesch formulas', async ({ lab }) => {
    const stats = await lab.page.evaluate(() => {
      const fl = window.fontLab;
      const read = text => { fl.apply({ text }); return fl.metrics.readabilityStats(); };
      return {
        simple: read('The cat sat on the mat. The dog ran to the log. We had fun.'),
        dense: read('Notwithstanding the aforementioned considerations, the institutional implementation of interdisciplinary methodologies necessitates substantial organisational reconfiguration.'),
        empty: read('')
      };
    });

    expect(stats.simple.words).toBe(15);
    expect(stats.simple.sentences).toBe(3);
    expect(stats.simple.flesch).toBeGreaterThan(90);   // very easy
    expect(stats.simple.grade).toBeLessThan(3);
    expect(stats.dense.flesch).toBeLessThan(30);       // very hard
    expect(stats.dense.grade).toBeGreaterThan(15);
    expect(stats.simple.readingSeconds).toBeGreaterThan(0);
    expect(stats.empty.words).toBe(0);
    expect(stats.empty.flesch).toBe(0);
  });

  test('the design audit reports what is actually wrong', async ({ lab }) => {
    const audits = await lab.page.evaluate(() => {
      const fl = window.fontLab;
      const run = patch => { fl.apply(patch); return fl.metrics.buildAudit().notes; };
      return {
        lowContrast: run({ color: '#cccccc', bg: '#ffffff', size: 16, weight: 400, contrastModel: 'both' }),
        forcedMotion: run({ anim: 'bounce', motionSafe: 'force' }),
        badJustify: run({ align: 'justify', hyphens: 'none' }),
        healthy: run(Object.assign({}, fl.defaults, { size: 18, weight: 400, lineHeight: 1.6, maxWidth: 66, typeRole: 'body' }))
      };
    });

    expect(audits.lowContrast.some(n => n.severity === 'fail' && /WCAG contrast/.test(n.text))).toBe(true);
    expect(audits.lowContrast.some(n => /APCA/.test(n.text))).toBe(true);
    expect(audits.forcedMotion.some(n => /prefers-reduced-motion/.test(n.text))).toBe(true);
    expect(audits.badJustify.some(n => /hyphenation/.test(n.text))).toBe(true);
    expect(audits.healthy.every(n => n.severity !== 'fail')).toBe(true);
  });
});
