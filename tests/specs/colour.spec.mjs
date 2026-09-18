import { test, expect } from './helpers.mjs';

test.describe('colour and contrast', () => {
  test('WCAG 2.x contrast ratios match the published reference values', async ({ lab }) => {
    const values = await lab.page.evaluate(() => {
      const { contrastRatio, relLuminance } = window.fontLab.colour;
      return {
        blackWhite: contrastRatio('#000000', '#ffffff'),
        same: contrastRatio('#777777', '#777777'),
        knownPair: contrastRatio('#767676', '#ffffff'),
        symmetric: contrastRatio('#1a1a1a', '#eeeeee') - contrastRatio('#eeeeee', '#1a1a1a'),
        luminanceWhite: relLuminance([255, 255, 255]),
        luminanceBlack: relLuminance([0, 0, 0])
      };
    });
    expect(values.blackWhite).toBeCloseTo(21, 5);
    expect(values.same).toBeCloseTo(1, 5);
    // #767676 on white is the canonical "exactly passes AA" grey.
    expect(values.knownPair).toBeGreaterThanOrEqual(4.5);
    expect(values.knownPair).toBeLessThan(4.6);
    expect(values.symmetric).toBeCloseTo(0, 10);
    expect(values.luminanceWhite).toBeCloseTo(1, 6);
    expect(values.luminanceBlack).toBeCloseTo(0, 6);
  });

  test('APCA reproduces the reference Lc values and polarity', async ({ lab }) => {
    const values = await lab.page.evaluate(() => {
      const { apcaContrast } = window.fontLab.colour;
      return {
        blackOnWhite: apcaContrast('#000000', '#ffffff'),
        whiteOnBlack: apcaContrast('#ffffff', '#000000'),
        nearIdentical: apcaContrast('#ffffff', '#fefefe'),
        identical: apcaContrast('#888888', '#888888')
      };
    });
    // Values published for APCA-W3 0.98G-4g.
    expect(values.blackOnWhite).toBeCloseTo(106.04, 1);
    expect(values.whiteOnBlack).toBeCloseTo(-107.88, 1);
    // Light text on light background must read negative, never flip polarity.
    expect(values.nearIdentical).toBe(0);
    expect(values.identical).toBe(0);
  });

  test('the APCA font lookup table gates small text correctly', async ({ lab }) => {
    const values = await lab.page.evaluate(() => {
      const { apcaMinFontSize } = window.fontLab.colour;
      return {
        lc75w400: apcaMinFontSize(75, 400),
        lc90w400: apcaMinFontSize(90, 400),
        lc60w700: apcaMinFontSize(60, 700),
        lc20: apcaMinFontSize(20, 400),
        lc5: apcaMinFontSize(5, 400),
        negativePolarity: apcaMinFontSize(-90, 400)
      };
    });
    expect(values.lc75w400.px).toBe(18);
    expect(values.lc90w400.px).toBe(16);
    expect(values.lc60w700.px).toBe(16);
    expect(values.lc20.px).toBeNull();
    expect(values.lc20.note).toContain('spot');
    expect(values.lc5.px).toBeNull();
    // Polarity must not change the size requirement.
    expect(values.negativePolarity.px).toBe(16);
  });

  test('OKLCh conversion round-trips within sRGB', async ({ lab }) => {
    const drift = await lab.page.evaluate(() => {
      const { hexToOklch, oklchToHex } = window.fontLab.colour;
      const samples = ['#000000', '#ffffff', '#4c63e6', '#c92a35', '#15794f', '#f6c96f', '#8da2ff'];
      return samples.map(hex => ({ hex, back: oklchToHex(hexToOklch(hex)) }));
    });
    drift.forEach(({ hex, back }) => {
      const a = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
      const b = [1, 3, 5].map(i => parseInt(back.slice(i, i + 2), 16));
      a.forEach((channel, index) => expect(Math.abs(channel - b[index])).toBeLessThanOrEqual(1));
    });
  });

  test('the contrast solver reaches the target while keeping the hue', async ({ lab }) => {
    const cases = await lab.page.evaluate(() => {
      const { solveContrast, contrastRatio, hexToOklch, apcaContrast } = window.fontLab.colour;
      const out = [];
      [['#3182ce', '#2b6cb0', 4.5], ['#888888', '#ffffff', 7], ['#222222', '#111111', 4.5]].forEach(([seed, bg, target]) => {
        const solved = solveContrast(seed, bg, target, contrastRatio);
        out.push({
          seed, bg, target, solved,
          ratio: contrastRatio(solved, bg),
          hueSeed: hexToOklch(seed).h,
          hueSolved: hexToOklch(solved).h
        });
      });
      const apca = solveContrast('#4c63e6', '#ffffff', 75, (a, b) => Math.abs(apcaContrast(a, b)));
      out.push({ apca, lc: Math.abs(apcaContrast(apca, '#ffffff')) });
      return out;
    });

    const [inGamut, grey, impossible, apca] = cases;
    expect(inGamut.ratio).toBeGreaterThanOrEqual(4.5);
    // Hue is preserved to within a degree.
    expect(Math.abs(inGamut.hueSeed - inGamut.hueSolved)).toBeLessThan(0.02);
    expect(grey.ratio).toBeGreaterThanOrEqual(7);
    // Against near-black the 4.5 target is reachable by going light.
    expect(impossible.ratio).toBeGreaterThanOrEqual(4.5);
    expect(apca.lc).toBeGreaterThanOrEqual(75);
  });

  test('Machado CVD matrices interpolate between published severities', async ({ lab }) => {
    const values = await lab.page.evaluate(() => {
      const { cvdMatrixValues } = window.fontLab.colour;
      return {
        identity: cvdMatrixValues('prot', 0).split(' ').map(Number),
        deutFull: cvdMatrixValues('deut', 1).split(' ').map(Number),
        deutHalf: cvdMatrixValues('deut', 0.5).split(' ').map(Number),
        deutQuarter: cvdMatrixValues('deut', 0.25).split(' ').map(Number),
        unknown: cvdMatrixValues('nope', 1)
      };
    });
    // Severity 0 is the identity transform.
    expect(values.identity.slice(0, 5)).toEqual([1, 0, 0, 0, 0]);
    // Severity 1.0 deuteranomaly, straight from Machado et al. (2009).
    expect(values.deutFull.slice(0, 3)).toEqual([0.367322, 0.860646, -0.227968]);
    expect(values.deutHalf.slice(0, 3)).toEqual([0.547494, 0.607765, -0.155259]);
    // A severity between table rows is a linear blend of its neighbours.
    expect(values.deutQuarter[0]).toBeCloseTo((0.760729 + 0.675425) / 2, 5);
    // The alpha row is untouched.
    expect(values.deutFull.slice(15)).toEqual([0, 0, 0, 1, 0]);
    expect(values.unknown).toBeNull();
  });

  test('gradients are scored on their weakest pairing', async ({ lab }) => {
    const report = await lab.page.evaluate(() => {
      window.fontLab.apply({
        gradMode: 'text', gradA: '#ffffff', gradB: '#f2f2f2', bg: '#ffffff', size: 18, weight: 400
      });
      return window.fontLab.metrics.contrastReport();
    });
    // White-to-near-white text on white has to fail, not average out.
    expect(report.ratio).toBeLessThan(1.2);
    expect(report.passAA).toBe(false);
  });
});
