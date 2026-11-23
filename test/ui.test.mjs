/*
 * Mobile UI test for Capydoku (390×844, iPhone-ish).
 * Serves the folder locally, drives the real UI with Playwright, asserts the
 * main interactions and saves the two play screenshots.
 *
 * Run:  node test/ui.test.mjs
 * Needs Playwright + Chromium available (the workspace copy is used below).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOWNLOADS = '/workspace/downloads';
const PORT = Number(process.env.PORT || 4173);

let chromium;
try {
  ({ chromium } = await import('/workspace/kurly-auto-cart/node_modules/playwright/index.mjs'));
} catch (err) {
  ({ chromium } = await import('playwright'));
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json'
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) {
    res.statusCode = 403;
    res.end('forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.end(data);
  });
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
console.log(`serving ${ROOT} on http://127.0.0.1:${PORT}`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'ko-KR',
  colorScheme: 'light'
});
const page = await context.newPage();

const problems = [];
let offlinePhase = false;
page.on('console', (msg) => {
  if (msg.type() === 'error' && !offlinePhase) problems.push(`console: ${msg.text()}`);
});
page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
page.on('requestfailed', (req) => {
  if (req.resourceType() !== 'image' && !offlinePhase) problems.push(`requestfailed: ${req.url()}`);
});

const steps = [];
function step(name, detail = '') {
  steps.push(`${name}${detail ? ' — ' + detail : ''}`);
  console.log(`✓ ${name}${detail ? ' — ' + detail : ''}`);
}

const state = () =>
  page.evaluate(() => {
    const s = window.__capydoku.state;
    return {
      size: s.size,
      board: Array.from(s.board),
      seeds: s.seeds,
      solved: s.solved,
      difficulty: s.difficulty,
      daily: s.daily,
      solution: Array.from(s.solution),
      visibleSheets: Array.from(document.querySelectorAll('.sheet'))
        .filter((el) => !el.hidden)
        .map((el) => el.id),
      theme: document.documentElement.dataset.theme
    };
  });

async function cellClick(index) {
  await page.locator(`.cell[data-i="${index}"]`).click({ position: { x: 8, y: 8 } });
}

async function closeSheetIfOpen() {
  if (await page.locator('#overlay:not([hidden])').count()) {
    await page.locator('#btnRestartCancel').click();
    await page.waitForTimeout(120);
  }
}

async function setMode(mode) {
  await page.locator(`.mode[data-mode="${mode}"]`).click();
}

async function pickDifficulty(group, key) {
  await page.locator(`.level-tab[data-group="${group}"]`).click();
  await page.locator(`.diff[data-diff="${key}"]`).click();
  await page.waitForTimeout(150);
  if (await page.locator('#overlay:not([hidden])').count()) {
    await page.locator('#btnRestartConfirm').click();
    await page.waitForTimeout(200);
  }
}

try {
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__capydoku && !!window.__capydoku.state);
  await page.waitForTimeout(300);

  // 1. Shell and brand
  assert.strictEqual(await page.title(), 'Capydoku · 광고 없는 카피바라 퍼즐');
  assert.strictEqual(await page.locator('.brand-text h1').textContent(), 'Capydoku');
  assert.strictEqual(await page.locator('.cell').count(), 36);
  assert.strictEqual(await page.locator('.seed').count(), 3);
  assert.strictEqual((await page.locator('.seed').first().textContent()).trim(), '🍊');
  assert.deepStrictEqual(
    await page.locator('.diff').allTextContents(),
    ['초급5×5', '쉬움6×6']
  );
  step('page loads', 'title, brand, 6×6 board and 3 tangerines');

  // 2. Easy / hard group switch
  await page.locator('.level-tab[data-group="hard"]').click();
  assert.deepStrictEqual(
    await page.locator('.diff').allTextContents(),
    ['보통7×7', '어려움8×8', '전문가9×9', '마스터10×10']
  );
  await page.locator('.level-tab[data-group="easy"]').click();
  step('level groups', 'easy 5·6, hard 7·8·9·10');

  // 3. Auto-cycle: empty → × → capybara → empty on a correct cell
  {
    const s0 = await state();
    const idx = s0.solution[0]; // row 0, correct column
    await setMode('auto');
    await cellClick(idx);
    assert.strictEqual((await state()).board[idx], 1, 'first tap marks ×');
    await cellClick(idx);
    assert.strictEqual((await state()).board[idx], 2, 'second tap places the capybara');
    await cellClick(idx);
    assert.strictEqual((await state()).board[idx], 0, 'third tap clears the cell');
    assert.strictEqual((await state()).seeds, 3, 'cycling on a correct cell costs nothing');
    step('auto cycle', '빈칸 → ✕ → 카피바라 → 빈칸');
  }

  // 4. Memo marks by tap
  await setMode('memo');
  await cellClick(0);
  let s = await state();
  assert.strictEqual(s.board[0], 1, 'tap should add a memo ×');
  await cellClick(0);
  s = await state();
  assert.strictEqual(s.board[0], 0, 'second tap should clear the ×');
  step('tap to mark ×');

  // 4. Drag to paint × across empty cells
  const box0 = await page.locator('.cell[data-i="0"]').boundingBox();
  const box2 = await page.locator('.cell[data-i="2"]').boundingBox();
  await page.mouse.move(box0.x + box0.width / 2, box0.y + box0.height / 2);
  await page.mouse.down();
  await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2, { steps: 12 });
  await page.mouse.up();
  s = await state();
  assert.ok(s.board[0] === 1 && s.board[1] === 1 && s.board[2] === 1, 'drag should paint × marks');
  step('drag paint', 'three × marks in one gesture');

  // Undo the drag as one action.
  await page.locator('#btnUndo').click();
  s = await state();
  assert.ok(s.board[0] === 0 && s.board[1] === 0 && s.board[2] === 0, 'undo should clear the whole drag');
  step('undo', 'drag undone in one step');

  // 5. Place a capybara, then a wrong one costs a tangerine.
  await setMode('place');
  s = await state();
  const size = s.size;
  const solution = s.solution;
  const firstCorrect = solution[0]; // row 0
  await cellClick(firstCorrect);
  s = await state();
  assert.strictEqual(s.board[firstCorrect], 2, 'correct tap places a capybara');
  assert.strictEqual(s.seeds, 3, 'correct placement costs nothing');
  assert.ok((await page.locator('.capi').count()) >= 1);
  step('place capybara', 'row 0');

  const wrongCol = (solution[0] + 2) % size;
  const wrongIndex = wrongCol;
  await cellClick(wrongIndex);
  s = await state();
  assert.strictEqual(s.seeds, 2, 'a mistake should cost one tangerine');
  assert.strictEqual(s.board[wrongIndex], 0, 'a wrong capybara must not stay on the board');
  const toastText = await page.locator('#toast').textContent();
  assert.ok(toastText.includes('🍊 -1'), `toast should mention the lost tangerine: ${toastText}`);
  assert.strictEqual(await page.locator('.seed.spent').count(), 1);
  step('mistake', `seeds 3 → 2, toast "${toastText.trim()}"`);

  // 6. Undo the wrong attempt (last board change is the correct capybara).
  await page.locator('#btnUndo').click();
  s = await state();
  assert.strictEqual(s.board[firstCorrect], 0, 'undo removes the placed capybara');
  step('undo placement');

  // 7. Hint reveals a correct cell
  const before = (await state()).board.filter((v) => v === 2).length;
  await page.locator('#btnHint').click();
  s = await state();
  const after = s.board.filter((v) => v === 2).length;
  assert.strictEqual(after, before + 1, 'hint places one safe capybara');
  step('hint', 'one safe cell revealed');

  // 8. Switch difficulty and size
  await pickDifficulty('hard', 'hard');
  s = await state();
  assert.strictEqual(s.size, 8);
  assert.strictEqual(await page.locator('.cell').count(), 64);
  step('switch difficulty', '8×8 board rendered');

  // 9. Master 10×10 renders quickly
  const started = Date.now();
  await pickDifficulty('hard', 'master');
  await page.waitForFunction(() => window.__capydoku.state.size === 10, null, { timeout: 5000 });
  await page.waitForTimeout(120);
  const masterMs = Date.now() - started;
  s = await state();
  assert.strictEqual(s.size, 10);
  assert.strictEqual(await page.locator('.cell').count(), 100);
  assert.ok(masterMs < 3000, `10×10 took ${masterMs}ms`);
  step('master 10×10', `${masterMs}ms to show`);
  await page.waitForTimeout(500);

  // 10. Dark mode toggle
  await page.locator('#btnTheme').click();
  s = await state();
  assert.strictEqual(s.theme, 'dark');
  await page.locator('#btnTheme').click();
  s = await state();
  assert.strictEqual(s.theme, 'light');
  step('dark mode toggle');

  // 11. Complete a 6×6 to reach the win modal
  await pickDifficulty('easy', 'easy');
  s = await state();
  assert.strictEqual(s.size, 6);
  await setMode('place');
  for (let row = 0; row < s.size; row++) {
    const idx = row * s.size + s.solution[row];
    await cellClick(idx);
  }
  await page.waitForFunction(
    () => window.__capydoku.state.solved && !document.getElementById('sheetWin').hidden,
    null,
    { timeout: 4000 }
  );
  s = await state();
  assert.ok(s.solved, '6×6 should be solved');
  assert.ok(s.visibleSheets.includes('sheetWin'), 'win modal should open');
  const winTitle = await page.locator('#winTitle').textContent();
  assert.strictEqual(winTitle, '퍼즐 완성!');
  const clearedText = await page.evaluate(() => localStorage.getItem('capydoku.stats.v1'));
  assert.ok(clearedText && JSON.parse(clearedText).cleared >= 1, 'cleared count should be saved');
  step('complete 6×6', 'win modal shown');

  await page.locator('#btnCloseWin').click();
  await page.waitForTimeout(200);
  assert.ok(await page.locator('#winBanner:not([hidden])').count(), 'win banner after closing modal');
  assert.ok(!(await state()).visibleSheets.length);
  step('win banner after closing');

  // 12. 8×8 play screenshot, light and dark
  await pickDifficulty('hard', 'hard');
  await page.waitForTimeout(300);
  s = await state();
  await setMode('place');
  const rowsToFill = [0, 2, 5];
  for (const row of rowsToFill) {
    const idx = row * s.size + s.solution[row];
    await cellClick(idx);
  }
  // A few manual × marks in an empty area of another row.
  await setMode('memo');
  for (const row of [3]) {
    for (let c = 0; c < 3; c++) {
      const idx = row * s.size + c;
      if ((await state()).board[idx] === 0) await cellClick(idx);
    }
  }
  await setMode('auto');
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    window.__capydoku.state.elapsedMs = 84000;
    document.getElementById('timer').textContent = '01:24';
  });
  await page.locator('#toast').evaluate((el) => el.classList.remove('show'));
  fs.mkdirSync(DOWNLOADS, { recursive: true });
  await page.screenshot({ path: path.join(DOWNLOADS, 'capydoku-play-light.png') });
  step('screenshot light', 'downloads/capydoku-play-light.png');

  await page.locator('#btnTheme').click();
  await page.waitForTimeout(420);
  await page.screenshot({ path: path.join(DOWNLOADS, 'capydoku-play-dark.png') });
  step('screenshot dark', 'downloads/capydoku-play-dark.png');
  await page.locator('#btnTheme').click();

  // 13. Settings sheet opens with the saved stats
  await page.locator('#btnSettings').click();
  await page.waitForTimeout(250);
  assert.ok(await page.locator('#sheetSettings:not([hidden])').count());
  assert.strictEqual(await page.locator('#setAutoX').isChecked(), true);
  await page.screenshot({ path: '/workspace/tmp/hamdoku/settings.png' });
  await page.locator('#scrim').click({ position: { x: 10, y: 10 } });
  await page.waitForTimeout(200);
  step('settings sheet');

  // 14. Reload restores the in-progress board
  s = await state();
  const savedBoard = s.board.join(',');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__capydoku?.state);
  await page.waitForTimeout(300);
  s = await state();
  assert.strictEqual(s.size, 8, 'reload restores the 8×8 puzzle');
  assert.strictEqual(s.board.join(','), savedBoard, 'reload restores the board');
  step('reload restore', 'board and level kept');

  // 15. Daily puzzle uses a date seed
  await page.locator('#tabDaily').click();
  await page.waitForTimeout(200);
  if (await page.locator('#overlay:not([hidden])').count()) {
    await page.locator('#btnRestartConfirm').click();
    await page.waitForTimeout(250);
  }
  s = await state();
  assert.strictEqual(s.daily, true, 'daily mode should be active');
  const seed = await page.evaluate(() => window.__capydoku.state.seed);
  assert.ok(seed.startsWith('daily-'), `daily seed should be date based: ${seed}`);
  step('daily puzzle', seed);

  // 16. Colour-blind patterns toggle
  await page.locator('#btnSettings').click();
  await page.waitForTimeout(200);
  await page.getByText('🎨 색약 대비 패턴').click();
  await page.locator('#btnCloseSettings').click();
  await page.waitForTimeout(200);
  assert.ok(await page.locator('#board.cb').count(), 'board should show region patterns');
  await page.screenshot({ path: '/workspace/tmp/hamdoku/colorblind.png' });
  await page.locator('#btnSettings').click();
  await page.getByText('🎨 색약 대비 패턴').click();
  await page.locator('#btnCloseSettings').click();
  step('colour-blind patterns');

  // 17. Offline PWA: cached shell still opens without the network
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  offlinePhase = true;
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__capydoku?.state, null, { timeout: 8000 });
  const offlineCells = await page.locator('.cell').count();
  assert.ok(offlineCells >= 25, 'offline shell should render a board');
  await context.setOffline(false);
  offlinePhase = false;
  step('offline PWA', `service worker ${controlled ? 'controlling page' : 'active'}, board rendered offline`);

  // 18. No console or page errors during the whole run
  assert.deepStrictEqual(problems, [], `browser problems: ${problems.join(' | ')}`);
  step('no console/page errors');

  console.log(`\n${steps.length} UI checks passed.`);
} finally {
  await browser.close();
  server.close();
}
