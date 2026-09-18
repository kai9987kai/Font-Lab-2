import { test, expect, settle } from './helpers.mjs';

test.describe('state schema', () => {
  test('hostile and malformed input is coerced, never trusted', async ({ lab }) => {
    const result = await lab.page.evaluate(() => {
      return window.fontLab.sanitizeState({
        size: 10_000,
        weight: -50,
        lineHeight: 'not a number',
        maxWidth: null,
        elementTag: 'script',
        align: 'javascript:alert(1)',
        href: 'javascript:alert(1)',
        lang: 'en"><script>alert(1)</script>',
        color: 'red; background: url(evil)',
        shadow: '0 0 0 red; } body { display: none } .x {',
        filter: 'url(http://evil.test/x.svg#f)',
        fontFeatures: '"ss01" 1, evil(1), "kern" 0',
        features: { ss01: 1, 'not-a-tag': 1, tnum: 0 },
        axes: { wght: 500, 'bad tag': 9, opsz: 'NaN' },
        iteration: 'infinite but very long indeed',
        unknownKeyEntirely: 'dropped',
        __proto__: { polluted: true }
      });
    });

    expect(result.size).toBe(400);           // clamped to the schema maximum
    expect(result.weight).toBe(1);           // clamped to the schema minimum
    expect(result.lineHeight).toBe(1.2);     // falls back to the default
    expect(result.maxWidth).toBe(70);
    expect(result.elementTag).toBe('p');     // not in the allow-list
    expect(result.align).toBe('start');
    expect(result.href).toBe('');            // javascript: is rejected outright
    expect(result.lang).toBe('en');          // fails the BCP 47 shape
    expect(result.color).toBe('#111418');    // not a hex colour
    expect(result.shadow).not.toContain('}');
    expect(result.shadow).not.toContain(';');
    expect(result.filter).toBe('');          // url() is stripped from CSS values
    expect(result.fontFeatures).toBe('"ss01" 1, "kern" 0');
    expect(result.features).toEqual({ ss01: 1, tnum: 0 });
    expect(result.axes).toEqual({ wght: 500 });
    expect(result.iteration).toHaveLength(12);
    expect(result).not.toHaveProperty('unknownKeyEntirely');
    expect(result).not.toHaveProperty('polluted');
    expect({}.polluted).toBeUndefined();
  });

  test('1.x saved states migrate forward', async ({ lab }) => {
    const migrated = await lab.page.evaluate(() => window.fontLab.sanitizeState({
      fontIdx: 9,
      pairFontIdx: 0,
      fontOpticalSizing: 'none',
      rhythmLock: 'on',
      colorVision: 'deuteranopia',
      align: 'right',
      size: 64
    }));
    expect(migrated.fontId).toBe('gf:Fraunces');      // index 9 in the 1.x list
    expect(migrated.pairFontId).toBe('sys:system-ui'); // index 0 in the 1.x list
    expect(migrated.opticalSizing).toBe('none');
    expect(migrated.rhythmLock).toBe('4');
    expect(migrated.colorVision).toBe('deut');
    expect(migrated.align).toBe('end');
    expect(migrated.size).toBe(64);
  });

  test('share links encode only the difference from the defaults', async ({ lab }) => {
    const result = await lab.page.evaluate(() => {
      const fl = window.fontLab;
      fl.apply(fl.defaults);
      const empty = fl.share.encode();
      fl.apply({ size: 123, lineHeight: 1.77, fontId: 'gf:Fraunces', text: 'Round trip' });
      const encoded = fl.share.encode();
      const decoded = fl.share.decode(encoded);
      return {
        emptyLength: empty.length,
        encodedLength: encoded.length,
        urlSafe: /^[A-Za-z0-9_-]*$/.test(encoded),
        decoded: { size: decoded.size, lineHeight: decoded.lineHeight, fontId: decoded.fontId, text: decoded.text },
        untouchedKeyKeptDefault: decoded.maxWidth
      };
    });
    expect(result.emptyLength).toBeLessThan(8);
    expect(result.encodedLength).toBeLessThan(220);
    expect(result.urlSafe).toBe(true);
    expect(result.decoded).toEqual({ size: 123, lineHeight: 1.77, fontId: 'gf:Fraunces', text: 'Round trip' });
    expect(result.untouchedKeyKeptDefault).toBe(70);
  });

  test('share links survive non-ASCII text', async ({ lab }) => {
    const decoded = await lab.page.evaluate(() => {
      const fl = window.fontLab;
      const text = 'Ĳsselmeer — Ω 東京 🅰 «guillemets»';
      fl.apply({ text });
      return { original: text, decoded: fl.share.decode(fl.share.encode()).text };
    });
    expect(decoded.decoded).toBe(decoded.original);
  });

  test('a tampered share link is rejected rather than applied', async ({ lab }) => {
    const outcome = await lab.page.evaluate(() => {
      const fl = window.fontLab;
      try {
        fl.share.decode('not-valid-base64!!!');
        return 'no error';
      } catch (error) {
        return 'threw';
      }
    });
    expect(outcome).toBe('threw');

    // The UI path swallows the error and leaves the lab usable.
    await lab.page.evaluate(() => { location.hash = '#type=%%%broken%%%'; });
    await settle(lab.page);
    await expect(lab.page.locator('#previewText')).toBeVisible();
  });

  test('undo and redo coalesce a drag into one step', async ({ lab }) => {
    const { page } = lab;
    await page.evaluate(() => window.fontLab.apply({ size: 48 }));
    const slider = page.locator('#fontSize');
    // Three quick changes to the same control within the coalescing window.
    await slider.evaluate(node => {
      [60, 72, 84].forEach(value => {
        node.value = String(value);
        node.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
    await settle(page);
    expect(await page.evaluate(() => window.fontLab.state.size)).toBe(84);

    await page.evaluate(() => window.fontLab.undo());
    expect(await page.evaluate(() => window.fontLab.state.size)).toBe(48);

    await page.evaluate(() => window.fontLab.redo());
    expect(await page.evaluate(() => window.fontLab.state.size)).toBe(84);
  });

  test('state survives a reload through localStorage', async ({ lab }) => {
    const { page } = lab;
    await page.evaluate(() => window.fontLab.apply({ size: 37, fontId: 'gf:Fraunces', text: 'Persisted' }));
    // The write to localStorage is debounced, so wait for the value to land
    // rather than for a stopwatch.
    await page.waitForFunction(() => {
      try { return (localStorage.getItem('font-lab-last-v2') || '').includes('"size":37'); }
      catch { return false; }
    });
    await page.reload();
    await page.waitForFunction(() => !!window.fontLab);
    const restored = await page.evaluate(() => ({
      size: window.fontLab.state.size,
      fontId: window.fontLab.state.fontId,
      text: window.fontLab.state.text
    }));
    expect(restored).toEqual({ size: 37, fontId: 'gf:Fraunces', text: 'Persisted' });
  });
});
