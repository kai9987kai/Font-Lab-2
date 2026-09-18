import { test as base, expect } from '@playwright/test';

/**
 * Every spec opens the lab through this fixture. It keeps the suite hermetic
 * by stubbing the Google Fonts stylesheet - the lab is still exercised end to
 * end, but no test depends on a network round trip - and it fails any test
 * that logs a page error along the way.
 */
export const test = base.extend({
  lab: async ({ page }, use) => {
    const problems = [];
    page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));
    page.on('console', message => {
      if (message.type() === 'error') problems.push(`console: ${message.text()}`);
    });

    await page.route('**://fonts.googleapis.com/**', route =>
      route.fulfill({ status: 200, contentType: 'text/css', body: '/* stubbed in tests */' })
    );
    await page.route('**://fonts.gstatic.com/**', route => route.fulfill({ status: 204, body: '' }));

    await page.goto('/index.html');
    await page.waitForFunction(() => !!window.fontLab);
    await page.evaluate(() => {
      try { localStorage.clear(); } catch { /* ignore */ }
      window.fontLab.apply(window.fontLab.defaults);
      document.querySelectorAll('details.group').forEach(group => { group.open = true; });
    });
    await page.evaluate(() => new Promise(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))));

    await use({ page, problems });

    expect(problems, 'the page logged errors').toEqual([]);
  }
});

export { expect };

/**
 * The lab batches rendering into a requestAnimationFrame, so state changes
 * synchronously but the DOM catches up a frame later. Any assertion that
 * reads computed styles or measured geometry has to wait for that frame -
 * polling the state instead is a race that only shows up on a loaded runner.
 */
export const settle = page =>
  page.evaluate(() => new Promise(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))));
