import { test, expect, settle } from './helpers.mjs';

test.describe('the lab end to end', () => {
  test('loads, renders and exposes live metrics', async ({ lab }) => {
    const { page } = lab;
    await expect(page.locator('#previewText')).toBeVisible();
    await expect(page.locator('#metrics .badge')).not.toHaveCount(0);
    await expect(page.locator('#htmlOut pre')).toContainText('type-sample');
    await expect(page).toHaveTitle(/Font Lab/);
  });

  test('every preview mode renders without errors', async ({ lab }) => {
    const { page } = lab;
    for (const view of ['waterfall', 'proof', 'spacing', 'glyphs']) {
      await page.click(`#viewSwitch button[data-view="${view}"]`);
      await expect(page.locator('#specimenView')).toBeVisible();
      await expect(page.locator('#specimenView h2')).not.toBeEmpty();
    }
    await expect(page.locator('.waterfallRow')).toHaveCount(0); // glyphs is showing
    await page.click('#viewSwitch button[data-view="waterfall"]');
    await expect(page.locator('.waterfallRow')).not.toHaveCount(0);
    await page.click('#viewSwitch button[data-view="canvas"]');
    await expect(page.locator('#previewText')).toBeVisible();
  });

  test('the glyph inspector finds Latin coverage and reports gaps', async ({ lab }) => {
    const { page } = lab;
    await page.evaluate(() => window.fontLab.apply({ fontId: 'sys:system-ui' }));
    await page.click('#viewSwitch button[data-view="glyphs"]');
    await expect(page.locator('.glyphCell')).not.toHaveCount(0);
    const counts = await page.evaluate(() => ({
      total: document.querySelectorAll('.glyphCell').length,
      missing: document.querySelectorAll('.glyphCell.missing').length
    }));
    // Basic Latin is 95 codepoints and any real system font covers them all.
    expect(counts.total).toBe(95);
    expect(counts.missing).toBe(0);
  });

  test('smart presets each produce a coherent, renderable state', async ({ lab }) => {
    const { page } = lab;
    const buttons = page.locator('#smartPresets button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(5);
    for (let i = 0; i < count; i++) {
      await buttons.nth(i).click();
      const snapshot = await page.evaluate(() => {
        const fl = window.fontLab;
        return { size: fl.state.size, fontId: fl.state.fontId, css: fl.code.css().length };
      });
      expect(snapshot.size).toBeGreaterThan(0);
      expect(snapshot.fontId).toBeTruthy();
      expect(snapshot.css).toBeGreaterThan(80);
      await expect(page.locator('#previewText')).toBeVisible();
    }
  });

  test('auto tune retunes for the role and swaps a display face off body copy', async ({ lab }) => {
    const swapped = await lab.page.evaluate(() => {
      const fl = window.fontLab;
      fl.apply({ fontId: 'gf:Lobster', typeRole: 'body', size: 96, lineHeight: 0.9, color: '#dddddd', bg: '#ffffff' });
      document.getElementById('autoTune').click();
      return {
        fontId: fl.state.fontId,
        size: fl.state.size,
        lineHeight: fl.state.lineHeight,
        maxWidth: fl.state.maxWidth,
        ratio: fl.colour.contrastRatio(fl.state.color, fl.state.bg)
      };
    });
    // Lobster is classified Display, so body copy gets a text face instead.
    expect(swapped.fontId).not.toBe('gf:Lobster');
    expect(swapped.size).toBe(18);
    expect(swapped.lineHeight).toBeGreaterThan(1.4);
    expect(swapped.maxWidth).toBe(66);
    expect(swapped.ratio).toBeGreaterThanOrEqual(4.5);

    const kept = await lab.page.evaluate(() => {
      const fl = window.fontLab;
      fl.apply({ fontId: 'gf:Source Serif 4', typeRole: 'display', size: 14 });
      document.getElementById('autoTune').click();
      return { fontId: fl.state.fontId, size: fl.state.size };
    });
    // A text face is a perfectly good display face, so it is left alone.
    expect(kept.fontId).toBe('gf:Source Serif 4');
    expect(kept.size).toBe(104);
  });

  test('the contrast solver button fixes a failing pairing', async ({ lab }) => {
    const { page } = lab;
    await page.evaluate(() => window.fontLab.apply({
      color: '#8899aa', bg: '#7788aa', contrastModel: 'wcag', targetContrast: 4.5, gradMode: 'off'
    }));
    await page.click('#fixContrast');
    const report = await page.evaluate(() => window.fontLab.metrics.contrastReport());
    expect(report.ratio).toBeGreaterThanOrEqual(4.5);
    await expect(page.locator('#metrics')).toContainText('AA: pass');
  });

  test('accessibility simulations change what is on screen', async ({ lab }) => {
    const { page } = lab;
    await page.evaluate(() => {
      const fl = window.fontLab;
      fl.set('colorVision', 'deut');
      fl.set('zoomLevel', 200);
      fl.set('reflowWidth', 320);
    });
    await settle(page);
    const stage = await page.evaluate(() => ({
      filter: getComputedStyle(document.getElementById('canvas')).filter,
      width: document.getElementById('stageWrap').style.width,
      transform: document.getElementById('stageWrap').style.transform,
      matrix: document.getElementById('cvdMatrix').getAttribute('values').split(' ')[0]
    }));
    expect(stage.filter).toContain('cvdFilter');
    // 320 CSS px at 200% zoom leaves 160 px of layout width.
    expect(stage.width).toBe('160px');
    expect(stage.transform).toBe('scale(2)');
    expect(Number(stage.matrix)).toBeCloseTo(0.367322, 5);

    await page.evaluate(() => {
      window.fontLab.set('colorVision', 'none');
      window.fontLab.set('zoomLevel', 100);
      window.fontLab.set('reflowWidth', 0);
    });
    await settle(page);
    expect(await page.evaluate(() => document.getElementById('stageWrap').style.transform)).toBe('');
  });

  test('the command palette runs commands', async ({ lab }) => {
    const { page } = lab;
    await page.keyboard.press('Control+k');
    await expect(page.locator('#palette')).toBeVisible();
    await page.fill('#paletteInput', 'glyph inspector');
    await expect(page.locator('#paletteList [role="option"]')).toHaveCount(1);
    await page.keyboard.press('Enter');
    await expect(page.locator('#palette')).not.toBeVisible();
    expect(await page.evaluate(() => window.fontLab.state.view)).toBe('glyphs');

    await page.keyboard.press('Control+k');
    await page.keyboard.press('Escape');
    await expect(page.locator('#palette')).not.toBeVisible();
  });

  test('keyboard shortcuts stay out of the way while typing', async ({ lab }) => {
    const { page } = lab;
    await page.click('#customText');
    await page.type('#customText', 'rag');
    expect(await page.evaluate(() => window.fontLab.state.view)).toBe('canvas');
    expect(await page.inputValue('#customText')).toContain('rag');

    await page.click('#canvas');
    await page.keyboard.press('2');
    expect(await page.evaluate(() => window.fontLab.state.view)).toBe('waterfall');
  });

  test('generated output covers every tab and downloads', async ({ lab }) => {
    const { page } = lab;
    await page.evaluate(() => window.fontLab.apply({
      fontId: 'gf:Fraunces', size: 42, weight: 600, scaleMode: 'fluid', showScale: 'on',
      pairMode: 'on', pairFontId: 'gf:Inter', textBoxTrim: 'cap alphabetic'
    }));
    // The pair size is derived from the rendered display size, so the CSS is
    // only stable once the frame has painted.
    await settle(page);

    const output = await page.evaluate(() => {
      const fl = window.fontLab;
      return {
        html: fl.code.html(),
        css: fl.code.css(),
        tokens: JSON.parse(fl.code.tokens()),
        tailwind: fl.code.tailwind(),
        js: fl.code.js(),
        scale: fl.code.scaleCSS(),
        clamp: fl.code.clampCSS()
      };
    });

    expect(output.html).toContain('class="type-block"');
    expect(output.html).toContain('class="type-pair"');
    expect(output.css).toContain('@import url("https://fonts.googleapis.com/css2?family=Fraunces');
    expect(output.css).toContain('font-size: 42px');
    expect(output.css).toContain('text-box-trim: trim-both');
    expect(output.tokens.typography.sample.$type).toBe('typography');
    expect(output.tokens.size['step-0']).toBeTruthy();
    expect(output.tokens.colour.text.$type).toBe('color');
    expect(output.tailwind).toContain('@theme');
    expect(output.tailwind).toContain('--text-step-0');
    expect(output.js).toContain('export const typeStyle');
    expect(output.scale).toContain('--step-0');
    expect(output.clamp).toMatch(/^clamp\(.+px, .+px \+ .+vw, .+px\)$/);

    for (const [target, filename] of [
      ['htmlOut', 'type-sample.html'],
      ['cssOut', 'type-sample.css'],
      ['tokensOut', 'design-tokens.json'],
      ['tailwindOut', 'theme.css'],
      ['jsOut', 'type-style.js'],
      ['jsonOut', 'font-lab-state.json']
    ]) {
      await page.click(`.tab[data-target="${target}"]`);
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('#downloadActive')
      ]);
      expect(download.suggestedFilename()).toBe(filename);
    }
  });

  test('exports produce real HTML, SVG and PNG files', async ({ lab }) => {
    const { page } = lab;
    const grab = async selector => {
      const [download] = await Promise.all([page.waitForEvent('download'), page.click(selector)]);
      const stream = await download.createReadStream();
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      return { name: download.suggestedFilename(), body: Buffer.concat(chunks) };
    };

    const html = await grab('#exportHTML');
    expect(html.name).toBe('type-sample.html');
    expect(html.body.toString()).toMatch(/^<!DOCTYPE html>/);
    expect(html.body.toString()).toContain('class="type-sample"');

    const svg = await grab('#exportSVG');
    expect(svg.name).toBe('type-sample.svg');
    const svgText = svg.body.toString();
    expect(svgText).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svgText).toContain('</text>');
    expect(svgText).not.toContain('undefined');
    expect(svgText).not.toContain('NaN');

    const png = await grab('#exportPNG');
    expect(png.name).toBe('type-sample.png');
    // PNG magic number, then a 2x canvas of at least 3200 CSS px wide.
    expect(png.body.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(png.body.readUInt32BE(16)).toBe(3200);
  });

  test('a share link round-trips through the address bar', async ({ lab }) => {
    const { page } = lab;
    const url = await page.evaluate(() => {
      window.fontLab.apply({ size: 61, fontId: 'gf:Fraunces', text: 'Shared state', lineHeight: 1.45 });
      return window.fontLab.share.url();
    });
    await page.goto(url);
    await page.waitForFunction(() => !!window.fontLab && window.fontLab.state.size === 61);
    const restored = await page.evaluate(() => ({
      size: window.fontLab.state.size,
      fontId: window.fontLab.state.fontId,
      text: window.fontLab.state.text,
      lineHeight: window.fontLab.state.lineHeight
    }));
    expect(restored).toEqual({ size: 61, fontId: 'gf:Fraunces', text: 'Shared state', lineHeight: 1.45 });
  });

  test('the escape-hatch inputs cannot inject CSS into the page', async ({ lab }) => {
    const { page } = lab;
    await page.fill('#shadowCSS', '0 0 4px red; } #previewText { display: none } .x {');
    await page.fill('#filterCSS', 'url(http://example.test/x.svg#evil)');
    await settle(page);
    await expect(page.locator('#previewText')).toBeVisible();
    const applied = await page.evaluate(() => ({
      shadow: window.fontLab.state.shadow,
      filter: window.fontLab.state.filter,
      css: window.fontLab.code.css()
    }));
    // Rule-escaping characters are gone, and the browser's own parser rejects
    // what is left, so neither value survives into the output at all.
    expect(applied.shadow).toBe('');
    expect(applied.filter).toBe('');
    expect(applied.css).not.toContain('display: none');
    expect(applied.css).not.toContain('example.test');

    // A legitimate value still goes through untouched.
    await page.fill('#shadowCSS', '0 2px 8px rgba(0, 0, 0, .35)');
    await settle(page);
    expect(await page.evaluate(() => window.fontLab.state.shadow)).toBe('0 2px 8px rgba(0, 0, 0, .35)');
    expect(await page.evaluate(() => window.fontLab.code.css())).toContain('text-shadow: 0 2px 8px rgba(0, 0, 0, .35)');
  });

  test('presets save, list, load and delete', async ({ lab }) => {
    const { page } = lab;
    page.once('dialog', dialog => dialog.accept('Nightly'));
    await page.evaluate(() => window.fontLab.apply({ size: 88, fontId: 'gf:Archivo' }));
    await page.click('#savePreset');
    await page.evaluate(() => window.fontLab.apply(window.fontLab.defaults));

    await page.click('#loadPreset');
    await expect(page.locator('#modal')).toBeVisible();
    await page.click('#modalBody .presetRow button:not(.danger)');
    expect(await page.evaluate(() => window.fontLab.state.size)).toBe(88);

    await page.click('#loadPreset');
    await page.click('#modalBody .presetRow button.danger');
    await expect(page.locator('#modalBody')).toContainText('No presets saved yet');
    await page.click('#modalClose');
    await expect(page.locator('#modal')).not.toBeVisible();
  });

  test('dialogs trap focus and close on Escape', async ({ lab }) => {
    const { page } = lab;
    await page.click('#helpBtn');
    await expect(page.locator('#modal')).toBeVisible();
    await expect(page.locator('#modalTitle')).toHaveText('Font Lab');
    expect(await page.evaluate(() => document.activeElement.id)).toBe('modalClose');
    await page.keyboard.press('Escape');
    await expect(page.locator('#modal')).not.toBeVisible();
  });

  test('the layout holds together on a phone-sized viewport', async ({ lab }) => {
    const { page } = lab;
    await page.setViewportSize({ width: 390, height: 780 });
    await settle(page);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.locator('#previewText')).toBeVisible();
    await expect(page.locator('#controls')).toBeVisible();
  });
});
