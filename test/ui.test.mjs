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

async function cellCenter(index) {
  const box = await page.locator(`.cell[data-i="${index}"]`).boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/* two taps on the same cell within the 350ms double-tap window */
async function fastDoubleTap(index) {
  const p = await cellCenter(index);
  await page.mouse.click(p.x, p.y);
  await page.mouse.click(p.x, p.y);
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
  assert.strictEqual(await page.getAttribute('link[rel="stylesheet"]', 'href'), './styles.css?v=6');
  assert.deepStrictEqual(
    await page.evaluate(() => [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src'))),
    ['./engine.js?v=6', './app.js?v=6']
  );
  step('page loads', 'title, brand, 6×6 board, 3 tangerines, ?v=6 assets');

  // 1b. 도감 버튼은 해금 수를 배지로 보여준다
  {
    assert.strictEqual(await page.locator('#btnCollection').count(), 1, 'header has the 도감 button');
    assert.strictEqual((await page.locator('#collectionCount').textContent()).trim(), '1/10', 'one capybara is unlocked from the start');
    assert.ok(await page.locator('#brandBadge .capi').count(), 'brand badge shows the active capybara');
    assert.ok(await page.locator('.mode[data-mode="place"] .capi[data-skin="default"]').count(), 'the mode button uses the active skin');
    step('도감 header button', 'trophy + 1/10 badge');
  }

  // 2. Easy / hard group switch
  await page.locator('.level-tab[data-group="hard"]').click();
  assert.deepStrictEqual(
    await page.locator('.diff').allTextContents(),
    ['보통7×7', '어려움8×8', '전문가9×9', '마스터10×10']
  );
  await page.locator('.level-tab[data-group="easy"]').click();
  step('level groups', 'easy 5·6, hard 7·8·9·10');

  // 3. 자동 순환: 한 번 탭 = ✕, 천천히 한 번 더 = 지우기, 빠르게 두 번 = 카피바라 시도
  {
    const s0 = await state();
    const idx = s0.solution[0]; // row 0, correct column
    await setMode('auto');
    await cellClick(idx);
    assert.strictEqual((await state()).board[idx], 1, 'single tap marks ×');
    await page.waitForTimeout(450);
    await cellClick(idx);
    assert.strictEqual((await state()).board[idx], 0, 'a slow second tap erases the ×');
    assert.strictEqual((await state()).seeds, 3, 'erasing the × costs nothing');
    step('auto single tap', '빈칸 → ✕ → 450ms 뒤 탭 → 빈칸, 귤 3개 그대로');

    await page.waitForTimeout(450);
    await fastDoubleTap(idx);
    assert.strictEqual((await state()).board[idx], 2, 'a quick double tap places the capybara');
    assert.strictEqual((await state()).seeds, 3, 'a correct capybara costs nothing');
    step('auto double tap', '빠른 두 번 → 카피바라');

    await page.waitForTimeout(400);
    await cellClick(idx);
    assert.strictEqual((await state()).board[idx], 0, 'a tap on the capybara removes it');

    // the same double tap works when the cell already has an × (from ✕ 메모, a drag, or earlier)
    const idx2 = s0.size + s0.solution[1];
    await setMode('memo');
    await cellClick(idx2);
    assert.strictEqual((await state()).board[idx2], 1, 'memo ✕ placed');
    await setMode('auto');
    await page.waitForTimeout(450);
    await fastDoubleTap(idx2);
    assert.strictEqual((await state()).board[idx2], 2, 'double tap on an × places the capybara');
    await page.waitForTimeout(400);
    await cellClick(idx2);
    assert.strictEqual((await state()).board[idx2], 0, 'and it can be removed again');
    assert.strictEqual((await state()).seeds, 3, 'still three tangerines');
    step('auto double tap from ×', '✕ 있는 칸 더블탭 → 카피바라');
  }

  // 3b. 자동 순환 빠른 더블탭이 틀린 칸이면 귤 하나를 잃고 칸은 빈칸으로 돌아간다.
  {
    await setMode('auto');
    const s0 = await state();
    const wrong = (s0.solution[0] + 1) % s0.size;
    await cellClick(wrong);
    assert.strictEqual((await state()).board[wrong], 1, 'first tap marks ×');
    await page.waitForTimeout(450);
    await cellClick(wrong);
    let s1 = await state();
    assert.strictEqual(s1.board[wrong], 0, 'slow tap erases the × without a capybara attempt');
    assert.strictEqual(s1.seeds, 3, 'slow tap costs no tangerine');

    await page.waitForTimeout(450);
    await fastDoubleTap(wrong);
    s1 = await state();
    assert.strictEqual(s1.board[wrong], 0, 'a wrong double tap leaves the cell empty');
    assert.strictEqual(s1.seeds, 2, 'a wrong double tap costs one tangerine');
    assert.strictEqual(await page.locator('.seed.spent').count(), 1, 'one tangerine shown as spent');
    assert.ok(
      await page.locator(`.cell[data-i="${wrong}"].wrong`).count(),
      'the missed cell flashes the wrong/conflict styling'
    );
    const missToast = (await page.locator('#toast').textContent()).trim();
    assert.ok(missToast.includes('이 칸엔 카피바라가 없어요'), `toast should explain the miss: ${missToast}`);
    assert.ok(missToast.includes('🍊 -1'), `toast should mention the lost tangerine: ${missToast}`);
    step('auto wrong double tap', `seeds 3 → 2, toast "${missToast}"`);

    // Restart so the following checks start from three tangerines again.
    await page.locator('#btnRestart').click();
    await page.waitForTimeout(250);
    s1 = await state();
    assert.strictEqual(s1.seeds, 3, 'restart refills the tangerines');
    assert.strictEqual(s1.board.filter((v) => v !== 0).length, 0, 'restart clears the board');
  }

  // 4. Memo marks by tap
  await setMode('memo');
  await cellClick(0);
  let s = await state();
  assert.strictEqual(s.board[0], 1, 'tap should add a memo ×');
  await cellClick(0);
  s = await state();
  assert.strictEqual(s.board[0], 0, 'second tap should clear the ×');
  assert.strictEqual(s.seeds, 3, 'memo mode never costs a tangerine');
  step('tap to mark ×', 'memo mode, no tangerine lost');

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
  const party = await page.evaluate(() => {
    const layer = document.querySelector('.party');
    return {
      layer: !!layer,
      bits: layer ? layer.querySelectorAll('.party-bit').length : 0,
      pointer: layer ? getComputedStyle(layer).pointerEvents : null,
      overlayBefore: getComputedStyle(document.getElementById('overlay'), '::before').content
    };
  });
  assert.ok(party.layer, 'a confetti layer appears on win');
  assert.ok(party.bits >= 20, `confetti burst should be made of many pieces: ${party.bits}`);
  assert.strictEqual(party.pointer, 'none', 'confetti never blocks taps');
  assert.ok(
    party.overlayBefore === 'none' || party.overlayBefore === 'normal',
    `the old falling tangerines are gone: ${party.overlayBefore}`
  );
  fs.mkdirSync(DOWNLOADS, { recursive: true });
  await page.screenshot({ path: path.join(DOWNLOADS, 'capydoku-win-confetti.png') });
  step('win confetti', `${party.bits} pieces burst around the board`);
  const clearedText = await page.evaluate(() => localStorage.getItem('capydoku.stats.v1'));
  assert.ok(clearedText && JSON.parse(clearedText).cleared >= 1, 'cleared count should be saved');
  step('complete 6×6', 'win modal shown');

  // 11a. 실수 없이 클리어한 첫 판은 선글라스 쿨바라를 해금한다
  {
    assert.ok(await page.locator('#winUnlock:not([hidden])').count(), 'the win sheet celebrates a new capybara');
    const names = await page.locator('.unlock-item b').allTextContents();
    assert.deepStrictEqual(names, ['선글라스 쿨바라'], `a flawless first clear unlocks the sunglasses: ${names}`);
    assert.strictEqual(await page.locator('.unlock-art .capi[data-skin="perfect"]').count(), 1);
    assert.ok(await page.locator('#btnUseUnlock').count() && await page.locator('#btnSeeUnlock').count(), 'both unlock actions are offered');
    const statsNow = await page.evaluate(() => JSON.parse(localStorage.getItem('capydoku.stats.v1')));
    assert.strictEqual(statsNow.perfectClears, 1, 'perfect clear is recorded');
    assert.deepStrictEqual(statsNow.sizeClears, { 6: 1 }, 'size clear history is recorded');
    assert.ok(statsNow.skins.unlocked.includes('perfect'), 'the skin is saved as unlocked');
    step('win unlock banner', names.join(', '));
  }

  await page.locator('#btnCloseWin').click();
  await page.waitForTimeout(200);
  assert.ok(await page.locator('#winBanner:not([hidden])').count(), 'win banner after closing modal');
  assert.ok(!(await state()).visibleSheets.length);
  await page.waitForTimeout(1700);
  assert.strictEqual(await page.locator('.party').count(), 0, 'the confetti layer is cleaned up');
  step('win banner after closing');

  // 11b. 도감: 잠금·해금 상태를 보여주고, 눌러서 바로 장착한다
  {
    assert.strictEqual((await page.locator('#collectionCount').textContent()).trim(), '2/10', 'badge reflects the unlocked skin');
    await page.locator('#btnCollection').click();
    await page.waitForTimeout(350);
    assert.ok(await page.locator('#sheetCollection:not([hidden])').count(), '도감 sheet opens');
    assert.strictEqual(await page.locator('.skin-card').count(), 10, 'all ten capybaras are listed');
    assert.strictEqual(await page.locator('.skin-card.is-unlocked').count(), 2);
    assert.strictEqual(await page.locator('.skin-card.is-locked').count(), 8);
    assert.strictEqual(await page.locator('.skin-card.is-locked svg[data-skin="locked"]').count(), 8, 'locked cards show the gray ? silhouette');
    const conds = await page.locator('.skin-card.is-locked .skin-cond').allTextContents();
    for (const wanted of ['누적 3판 클리어', '누적 25판 클리어', '오늘의 퍼즐 3일 클리어', '카피바라 9종을 모두 모으면']) {
      assert.ok(conds.includes(wanted), `locked card should state "${wanted}": ${conds.join(' | ')}`);
    }
    assert.strictEqual(await page.locator('.skin-card.is-locked .skin-count').count(), 8, 'locked cards show progress counts');
    assert.strictEqual(await page.locator('.skin-card[data-skin="default"].is-active').count(), 1, '기본 is in use');
    assert.ok(await page.locator('.skin-card[data-skin="perfect"] .skin-new').count(), 'the freshly unlocked skin is flagged NEW');
    assert.strictEqual((await page.locator('#collectBar').getAttribute('aria-valuenow')), '2');
    fs.mkdirSync(DOWNLOADS, { recursive: true });
    await page.screenshot({ path: path.join(DOWNLOADS, 'capydoku-collection.png') });

    await page.locator('.skin-card[data-skin="perfect"]').click();
    await page.waitForTimeout(300);
    assert.strictEqual(await page.evaluate(() => window.__capydoku.activeSkin()), 'perfect');
    assert.ok(await page.locator('.skin-card[data-skin="perfect"].is-active').count(), 'the card shows 사용 중');
    assert.ok(await page.locator('.skin-card[data-skin="perfect"] .skin-state').textContent() === '사용 중');
    assert.strictEqual(await page.locator('#board .capi[data-skin="perfect"]').count(), 6, 'the board capybaras switch at once');
    assert.strictEqual(await page.locator('.mode[data-mode="place"] .capi[data-skin="perfect"]').count(), 1, 'the mode button switches too');
    assert.strictEqual(await page.locator('#brandBadge .capi[data-skin="perfect"]').count(), 1, 'the brand badge switches too');
    await page.screenshot({ path: '/workspace/tmp/hamdoku/collection-equipped.png' });

    // dark mode of the same sheet
    await page.locator('#btnCloseCollection').click();
    await page.locator('#btnTheme').click();
    await page.waitForTimeout(250);
    await page.locator('#btnCollection').click();
    await page.waitForTimeout(350);
    assert.strictEqual(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
    await page.screenshot({ path: '/workspace/tmp/hamdoku/collection-dark.png' });
    await page.locator('#btnCloseCollection').click();
    await page.locator('#btnTheme').click();
    await page.waitForTimeout(200);
    step('도감 sheet', '8 locked · equip changes board + mode button');
  }

  // 11c. 새 해금을 승리 화면에서 바로 쓰기
  {
    await page.evaluate(() => window.__capydoku.setStats({ cleared: 2 }));
    await pickDifficulty('easy', 'beginner');
    s = await state();
    assert.strictEqual(s.size, 5, 'beginner is a 5×5');
    await setMode('place');
    for (let row = 0; row < 5; row++) {
      await cellClick(row * 5 + s.solution[row]);
    }
    await page.waitForFunction(() => !document.getElementById('sheetWin').hidden, null, { timeout: 4000 });
    await page.waitForTimeout(600);
    assert.ok(await page.locator('#winUnlock:not([hidden])').count());
    const names = await page.locator('.unlock-item b').allTextContents();
    assert.ok(names.includes('수건 온천 카피바라'), `third clear unlocks the onsen towel: ${names}`);
    await page.screenshot({ path: '/workspace/tmp/hamdoku/win-unlock.png' });
    await page.locator('#btnUseUnlock').click();
    await page.waitForTimeout(350);
    assert.ok(await page.locator('#sheetWin').isHidden(), '바로 쓰기 closes the win sheet');
    assert.strictEqual(await page.evaluate(() => window.__capydoku.activeSkin()), 'onsen');
    assert.strictEqual(await page.locator('#board .capi[data-skin="onsen"]').count(), 5, 'the new capybara is on the board right away');
    assert.ok((await page.locator('#toast').textContent()).includes('수건 온천 카피바라'), 'a toast confirms the equip');
    assert.strictEqual((await page.locator('#collectionCount').textContent()).trim(), '3/10');
    step('바로 쓰기', '3rd clear → onsen towel equipped');
  }

  // 11d. 기록 초기화는 도감을 지우지 않는다
  {
    await page.locator('#btnSettings').click();
    await page.waitForTimeout(200);
    await page.locator('#btnReset').click();
    await page.waitForTimeout(200);
    assert.strictEqual(await page.evaluate(() => window.__capydoku.stats.cleared), 0, 'stats are reset');
    const kept = await page.evaluate(() => window.__capydoku.unlockedSkins());
    assert.ok(kept.includes('onsen') && kept.includes('perfect'), `unlocked capybaras survive a reset: ${kept}`);
    assert.strictEqual(await page.evaluate(() => window.__capydoku.activeSkin()), 'onsen', 'the equipped capybara is kept');
    await page.locator('#btnCloseSettings').click();
    await page.waitForTimeout(200);
    step('reset keeps 도감', kept.length + ' skins kept');
  }

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
  assert.strictEqual(await page.locator('#setAutoX').isChecked(), false, 'auto ✕ hint starts off');
  await page.screenshot({ path: '/workspace/tmp/hamdoku/settings.png' });
  await page.locator('#scrim').click({ position: { x: 10, y: 10 } });
  await page.waitForTimeout(200);
  step('settings sheet');

  // 13b. Auto ✕ hint is off by default; the switch still turns it on
  {
    await setMode('auto');
    s = await state();
    const row = [...Array(s.size).keys()].find((r) => {
      const cells = s.board.slice(r * s.size, (r + 1) * s.size);
      return !cells.includes(2);
    });
    const idx = row * s.size + s.solution[row];
    await page.waitForTimeout(400);
    await fastDoubleTap(idx); // ✕ → capybara in one quick double tap
    s = await state();
    assert.strictEqual(s.board[idx], 2, 'capybara placed in an empty row');
    assert.strictEqual(await page.locator('.xmark.auto').count(), 0, 'no faint auto ✕ by default');
    await page.screenshot({ path: '/workspace/tmp/hamdoku/no-auto-x.png' });

    await page.locator('#btnSettings').click();
    await page.getByText('✕ 자동 메모 표시').click();
    await page.locator('#btnCloseSettings').click();
    await page.waitForTimeout(200);
    assert.strictEqual(await page.evaluate(() => window.__capydoku.settings.autoX), true);
    assert.ok((await page.locator('.xmark.auto').count()) > 0, 'faint auto ✕ returns when switched on');
    await page.screenshot({ path: '/workspace/tmp/hamdoku/auto-x-on.png' });

    await page.locator('#btnSettings').click();
    await page.getByText('✕ 자동 메모 표시').click();
    await page.locator('#btnCloseSettings').click();
    await page.waitForTimeout(150);
    assert.strictEqual(await page.locator('.xmark.auto').count(), 0, 'switching it off clears the hints');
    step('auto ✕ hint', 'off by default, switch opts in and out');
  }

  // 14. Reload restores the in-progress board
  s = await state();
  const savedBoard = s.board.join(',');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__capydoku?.state);
  await page.waitForTimeout(300);
  s = await state();
  assert.strictEqual(s.size, 8, 'reload restores the 8×8 puzzle');
  assert.strictEqual(s.board.join(','), savedBoard, 'reload restores the board');
  assert.strictEqual(await page.evaluate(() => window.__capydoku.activeSkin()), 'onsen', 'reload keeps the equipped skin');
  assert.ok(await page.locator('.mode[data-mode="place"] .capi[data-skin="onsen"]').count(), 'the mode button still uses it');
  step('reload restore', 'board, level and equipped skin kept');

  // 14b. One-time migration: an install saved under the old default (autoX: true)
  {
    await page.evaluate(() => {
      localStorage.setItem(
        'capydoku.settings.v1',
        JSON.stringify({
          theme: 'light',
          colorblind: false,
          autoX: true,
          mode: 'auto',
          difficulty: 'hard',
          group: 'hard'
        })
      );
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__capydoku?.state);
    await page.waitForTimeout(250);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('capydoku.settings.v1')));
    assert.strictEqual(saved.autoX, false, 'an old autoX: true is migrated off');
    assert.strictEqual(saved.prefsVersion, 2, 'settings carry the new prefs version');
    assert.strictEqual(await page.evaluate(() => window.__capydoku.settings.autoX), false, 'live setting is off');
    assert.strictEqual(await page.locator('.xmark.auto').count(), 0, 'no faint auto ✕ after migration');

    // an explicit choice to turn it back on survives later reloads
    await page.locator('#btnSettings').click();
    await page.getByText('✕ 자동 메모 표시').click();
    await page.locator('#btnCloseSettings').click();
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__capydoku?.state);
    await page.waitForTimeout(250);
    assert.strictEqual(await page.evaluate(() => window.__capydoku.settings.autoX), true, 'opt-in is kept');
    await page.locator('#btnSettings').click();
    await page.getByText('✕ 자동 메모 표시').click();
    await page.locator('#btnCloseSettings').click();
    await page.waitForTimeout(150);
    step('settings migration', 'old autoX:true → off once, opt-in kept');
  }

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

  // 16b. Service worker version and update strategy
  {
    const sw = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const res = await fetch('./sw.js', { cache: 'no-store' });
      return {
        active: reg && reg.active ? reg.active.state : null,
        caches: await caches.keys(),
        text: await res.text()
      };
    });
    assert.ok(sw.caches.includes('capydoku-v6'), `cache should be capydoku-v6: ${sw.caches}`);
    assert.match(sw.text, /VERSION = 6/, 'sw.js carries version 6');
    assert.match(sw.text, /self\.skipWaiting\(\)/, 'install takes over immediately');
    assert.match(sw.text, /self\.clients\.claim\(\)/, 'activate claims the open page');
    assert.match(sw.text, /function networkFirst/, 'shell files are network-first');
    assert.match(sw.text, /CORE = \['index\.html', 'styles\.css', 'app\.js', 'engine\.js'\]/, 'core files listed');
    step('service worker', `${sw.caches.join(',')} · network-first shell · ${sw.active}`);
  }

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
  assert.ok(
    await page.evaluate(() => !!window.CapydokuEngine),
    'offline reload also gets app.js and engine.js from the cache'
  );
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
