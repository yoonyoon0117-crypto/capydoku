/*
 * Capydoku — app shell.
 * iPhone-first UI for the puzzle engine: tap/drag input, tangerine lives,
 * undo, hints, daily challenge, dark mode, colour-blind patterns and local
 * save data. No ads, no tracking, no network calls.
 */
(function () {
  'use strict';

  var E = window.CapydokuEngine;
  if (!E) {
    document.body.innerHTML = '<p style="padding:24px;font-family:sans-serif">엔진을 불러오지 못했어요. 새로고침해 주세요.</p>';
    return;
  }

  var CAPY_SVG = [
    '<svg class="capi" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">',
    '<ellipse cx="14.5" cy="17.5" rx="7" ry="5.6" fill="#8d6242"/>',
    '<ellipse cx="49.5" cy="17.5" rx="7" ry="5.6" fill="#8d6242"/>',
    '<ellipse cx="14.5" cy="17.5" rx="3.2" ry="2.6" fill="#c08c6b"/>',
    '<ellipse cx="49.5" cy="17.5" rx="3.2" ry="2.6" fill="#c08c6b"/>',
    '<rect x="4.5" y="12" width="55" height="46" rx="16" fill="#b8865f"/>',
    '<rect x="13" y="34" width="38" height="21" rx="10.5" fill="#ecd2b2"/>',
    '<ellipse cx="28" cy="43.5" rx="1.7" ry="1.4" fill="#7a5540"/>',
    '<ellipse cx="36" cy="43.5" rx="1.7" ry="1.4" fill="#7a5540"/>',
    '<path d="M32 45.5v2.2M32 47.7c-1.4 1.8-3.4 1.8-4.6.4M32 47.7c1.4 1.8 3.4 1.8 4.6.4" stroke="#7a5540" stroke-width="1.5" fill="none" stroke-linecap="round"/>',
    '<circle cx="20.5" cy="29.5" r="2.7" fill="#3f2a1e"/>',
    '<circle cx="43.5" cy="29.5" r="2.7" fill="#3f2a1e"/>',
    '<circle cx="21.4" cy="28.6" r="0.9" fill="#fff8f0"/>',
    '<circle cx="44.4" cy="28.6" r="0.9" fill="#fff8f0"/>',
    '<ellipse cx="12.8" cy="37" rx="3.2" ry="2.1" fill="#e79c86" opacity="0.75"/>',
    '<ellipse cx="51.2" cy="37" rx="3.2" ry="2.1" fill="#e79c86" opacity="0.75"/>',
    '<circle cx="48.5" cy="11" r="6.2" fill="#ff9f43"/>',
    '<circle cx="46.8" cy="9.4" r="1.8" fill="#ffc078" opacity="0.9"/>',
    '<path d="M48.6 5.1c1.8-2.5 4.4-2.8 6.4-2-.9 2.6-3.3 3.8-6.4 2z" fill="#77b56a"/>',
    '</svg>'
  ].join('');

  var X_SVG = '<svg class="xmark" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
  var X_SVG_AUTO = '<svg class="xmark auto" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 7.5l9 9M16.5 7.5l-9 9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';

  /* 🎉 win burst — colourful confetti popping out around the finished board */
  var PARTY_COLORS = ['#ff8a5b', '#ffd166', '#7bd389', '#6cb6ff', '#ff9ecb', '#b79bff'];

  var KEY = {
    settings: 'capydoku.settings.v1',
    stats: 'capydoku.stats.v1',
    progress: 'capydoku.progress.v1'
  };
  var DEFAULT_SETTINGS = {
    theme: 'auto',
    colorblind: false,
    autoX: false,
    mode: 'auto',
    difficulty: 'easy',
    group: 'easy',
    prefsVersion: 2
  };
  var DEFAULT_STATS = { cleared: 0, best: {}, streak: 0, lastDaily: null, dailyDone: {} };

  var el = {};
  var storedSettings = readJSON(KEY.settings, {});
  if (!storedSettings || typeof storedSettings !== 'object') storedSettings = {};
  if (storedSettings.prefsVersion !== DEFAULT_SETTINGS.prefsVersion) {
    /* v3: the faint auto ✕ hint is off by default now, so a value saved while
       the old default was on (true) is dropped as well — otherwise an already
       open browser keeps drawing the hints. The settings switch opts back in. */
    storedSettings.autoX = false;
    storedSettings.prefsVersion = DEFAULT_SETTINGS.prefsVersion;
    writeJSON(KEY.settings, storedSettings);
  }
  var settings = merge(DEFAULT_SETTINGS, storedSettings);
  var stats = merge(DEFAULT_STATS, readJSON(KEY.stats, {}));
  if (!stats.best || typeof stats.best !== 'object') stats.best = {};
  if (!stats.dailyDone || typeof stats.dailyDone !== 'object') stats.dailyDone = {};

  var state = null;
  var blocked = null;
  var cellEls = [];
  /* cells whose auto ✕ was dismissed by the player; cleared whenever the
     placed capybaras change, since the hint is then about something else */
  var mutedHints = Object.create(null);
  var lastCapySig = '';
  var timerHandle = null;
  var toastHandle = null;
  var saveHandle = null;
  var activeSheet = null;
  var pendingConfirm = null;
  var drag = null;
  /* 자동 순환: a second tap inside this window on the same cell is a double
     tap (capybara attempt), anything later is a fresh single tap */
  var DOUBLE_TAP_MS = 350;
  var lastTap = null;

  // ------------------------------------------------------------ small utils

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function merge(base, extra) {
    var out = {};
    Object.keys(base).forEach(function (k) {
      out[k] = base[k];
    });
    Object.keys(extra || {}).forEach(function (k) {
      out[k] = extra[k];
    });
    return out;
  }

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* private mode or full storage — keep playing */
    }
  }

  function todayKey() {
    return E.dateKeySeoul(new Date());
  }

  function formatTime(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function puzzleRef() {
    return { size: state.size, regions: state.regions };
  }

  function capybaras() {
    var out = [];
    for (var i = 0; i < state.board.length; i++) if (state.board[i] === 2) out.push(i);
    return out;
  }

  function isSolutionCell(index) {
    return state.solution[E.rowOf(state.size, index)] === E.colOf(state.size, index);
  }

  function hasProgress() {
    return !!state && !state.solved && state.board.some(function (v) {
      return v !== 0;
    });
  }

  // ------------------------------------------------------------------ theme

  function prefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function effectiveDark() {
    if (settings.theme === 'dark') return true;
    if (settings.theme === 'light') return false;
    return prefersDark();
  }

  function applyTheme() {
    var dark = effectiveDark();
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#171310' : '#fdf6ee');
    el.btnTheme.textContent = dark ? '☀️' : '🌙';
    el.btnTheme.setAttribute('aria-label', dark ? '라이트 모드로 전환' : '다크 모드로 전환');
    if (el.setDark) el.setDark.checked = dark;
  }

  // ------------------------------------------------------------- puzzle flow

  function newSeed(diffKey) {
    return 'random-' + diffKey + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function startPuzzle(diffKey, daily, options) {
    options = options || {};
    lastTap = null;
    var diff = E.difficultyByKey(diffKey || settings.difficulty);
    var dateKey = todayKey();
    var seed = options.seed || (daily ? 'daily-' + dateKey + '-' + diff.key : newSeed(diff.key));

    var puzzle;
    if (options.puzzle) {
      puzzle = options.puzzle;
    } else {
      try {
        puzzle = E.generatePuzzle(diff.size, seed);
      } catch (err) {
        toast('퍼즐을 만드는 데 문제가 생겼어요. 다시 시도해 주세요.');
        return;
      }
    }

    settings.difficulty = diff.key;
    settings.group = diff.group;
    writeJSON(KEY.settings, settings);

    state = {
      difficulty: diff.key,
      size: puzzle.size,
      regions: puzzle.regions,
      solution: puzzle.solution,
      seed: seed,
      daily: !!daily,
      dailyKey: daily ? dateKey : null,
      board: options.board ? options.board.slice() : new Array(puzzle.size * puzzle.size).fill(0),
      seeds: typeof options.seeds === 'number' ? options.seeds : 3,
      hints: options.hints || 0,
      elapsedMs: options.elapsedMs || 0,
      runningSince: null,
      history: [],
      solved: !!options.solved
    };

    hideWinBanner();
    buildBoard();
    recomputeBlocked();
    renderAll();
    sizeBoard();

    if (state.solved) {
      showWinBanner(elapsed());
    } else {
      startTimer();
    }
    saveProgressNow();
    updateDailyBadge();
  }

  function restartPuzzle() {
    if (!state) return;
    var keepDaily = state.daily;
    startPuzzle(state.difficulty, keepDaily, keepDaily ? {} : { seed: state.seed });
  }

  function elapsed() {
    if (!state) return 0;
    return state.elapsedMs + (state.runningSince ? Date.now() - state.runningSince : 0);
  }

  function startTimer() {
    if (!state || state.solved) return;
    if (!state.runningSince) state.runningSince = Date.now();
    if (!timerHandle) {
      timerHandle = setInterval(function () {
        if (state && !state.solved) el.timer.textContent = formatTime(elapsed());
      }, 500);
    }
    el.timer.textContent = formatTime(elapsed());
  }

  function pauseTimer() {
    if (!state) return;
    if (state.runningSince) {
      state.elapsedMs += Date.now() - state.runningSince;
      state.runningSince = null;
    }
    el.timer.textContent = formatTime(elapsed());
  }

  // ------------------------------------------------------------------ board

  function buildBoard() {
    var n = state.size;
    el.board.style.setProperty('--n', n);
    el.board.classList.toggle('cb', !!settings.colorblind);
    el.board.innerHTML = '';
    cellEls = [];
    var frag = document.createDocumentFragment();

    for (var i = 0; i < n * n; i++) {
      var r = Math.floor(i / n);
      var c = i % n;
      var cell = document.createElement('div');
      cell.className = 'cell r' + state.regions[i];
      cell.dataset.i = String(i);
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', (r + 1) + '행 ' + (c + 1) + '열');
      if (r === 0 || state.regions[i - n] !== state.regions[i]) cell.classList.add('edge-t');
      if (c === 0 || state.regions[i - 1] !== state.regions[i]) cell.classList.add('edge-l');
      if (c === n - 1) cell.classList.add('edge-r');
      if (r === n - 1) cell.classList.add('edge-b');
      frag.appendChild(cell);
      cellEls.push(cell);
    }
    el.board.appendChild(frag);
  }

  function recomputeBlocked() {
    var capy = capybaras();
    var sig = capy.join(',');
    if (sig !== lastCapySig) {
      lastCapySig = sig;
      mutedHints = Object.create(null);
    }
    blocked = E.blockedCells(puzzleRef(), capy);
  }

  function muteHint(index) {
    if (blocked && blocked[index]) mutedHints[index] = true;
  }

  function renderBoard() {
    for (var i = 0; i < cellEls.length; i++) {
      var v = state.board[i];
      var html = '';
      if (v === 2) html = CAPY_SVG;
      else if (v === 1) html = X_SVG;
      else if (settings.autoX && blocked[i] && !mutedHints[i]) html = X_SVG_AUTO;
      var cell = cellEls[i];
      if (cell.__html !== html) {
        cell.innerHTML = html;
        cell.__html = html;
      }
      cell.classList.toggle('filled', v === 2);
      cell.classList.toggle('marked', v === 1);
    }
  }

  function renderSeeds(popIndex) {
    var out = '';
    for (var i = 0; i < 3; i++) {
      out += '<span class="seed' + (i >= state.seeds ? ' spent' : '') + (popIndex === i ? ' pop' : '') + '">🍊</span>';
    }
    el.seeds.innerHTML = out;
  }

  function renderStatus() {
    renderSeeds();
    el.timer.textContent = formatTime(elapsed());
    var left = state.size - capybaras().length;
    el.remain.textContent = state.size + '×' + state.size + ' · ' + Math.max(0, left) + ' 남음';
  }

  function renderDifficulty() {
    var activeGroup = settings.group || 'easy';
    $$('.level-tab').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.group === activeGroup);
    });
    var list = E.DIFFICULTIES.filter(function (d) {
      return d.group === activeGroup;
    });
    el.diffs.style.setProperty('--cols', list.length);
    el.diffs.innerHTML = list
      .map(function (d) {
        var active = state && state.difficulty === d.key ? ' active' : '';
        return (
          '<button class="diff' + active + '" type="button" data-diff="' + d.key + '">' +
          '<b>' + d.label + '</b><span>' + d.size + '×' + d.size + '</span></button>'
        );
      })
      .join('');
  }

  function renderModes() {
    $$('.mode').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.mode === settings.mode);
    });
  }

  function renderAll() {
    renderStatus();
    renderBoard();
    renderModes();
    renderDifficulty();
  }

  // ------------------------------------------------------------ move handling

  function pushHistory(items) {
    if (!items || !items.length) return;
    state.history.push({ type: 'cells', items: items });
    if (state.history.length > 400) state.history.shift();
  }

  function setCell(index, value) {
    var from = state.board[index];
    if (from === value) return;
    state.board[index] = value;
    pushHistory([{ i: index, from: from, to: value }]);
  }

  function markCell(index) {
    if (state.board[index] !== 0) return null;
    state.board[index] = 1;
    return { i: index, from: 0, to: 1 };
  }

  /* a memo drag paints ✕ across empty cells, or erases ✕ across marked ones
     depending on the cell the gesture started on */
  function dragCell(index) {
    if (drag && drag.erasing) {
      if (state.board[index] !== 1) return null;
      state.board[index] = 0;
      muteHint(index);
      return { i: index, from: 1, to: 0 };
    }
    return markCell(index);
  }

  function afterChange() {
    recomputeBlocked();
    renderStatus();
    renderBoard();
    saveProgress();
  }

  function tapCell(index) {
    if (!state || state.solved) {
      if (state && state.solved) toast('이미 완성한 퍼즐이에요. 새 퍼즐을 시작해 보세요!');
      return;
    }
    if (settings.mode === 'place') return handlePlace(index);
    if (settings.mode === 'memo') return toggleMemo(index);
    return autoTap(index);
  }

  /* 자동 순환: one tap on an empty cell marks it ✕, one tap on ✕ erases the
     mark (no tangerine), and a quick double tap — on an empty cell or on ✕ —
     is a capybara attempt. A wrong attempt costs a tangerine and the cell is
     left empty. One tap on a placed capybara removes it. */
  function autoTap(index) {
    var now = Date.now();
    var value = state.board[index];
    var quick = !!lastTap && lastTap.index === index && now - lastTap.time < DOUBLE_TAP_MS;

    if (value === 2) {
      lastTap = null;
      setCell(index, 0);
      afterChange();
      return;
    }

    if (quick) {
      /* the second tap of a double tap is a capybara attempt. A wrong attempt
         must leave the cell empty, so any ✕ the first tap left is cleared. */
      lastTap = null;
      if (value === 1 && !isSolutionCell(index)) {
        setCell(index, 0);
        muteHint(index);
        afterChange();
      }
      handlePlace(index);
      return;
    }

    lastTap = { index: index, time: now };
    if (value === 0) {
      setCell(index, 1);
    } else {
      setCell(index, 0);
      muteHint(index);
    }
    afterChange();
  }

  function toggleMemo(index) {
    if (state.board[index] === 0) {
      setCell(index, 1);
    } else if (state.board[index] === 1) {
      setCell(index, 0);
      muteHint(index);
    } else {
      setCell(index, 0);
    }
    afterChange();
  }

  function handlePlace(index) {
    if (state.solved) return;
    var current = state.board[index];
    if (current === 2) {
      setCell(index, 0);
      afterChange();
      return;
    }
    if (isSolutionCell(index)) {
      setCell(index, 2);
      afterChange();
      checkWin();
    } else {
      mistake(index);
    }
  }

  function mistakeReason(index, conflicts) {
    if (!conflicts.length) return '이 칸엔 카피바라가 없어요';
    var size = state.size;
    var r = E.rowOf(size, index);
    var c = E.colOf(size, index);
    var rid = state.regions[index];
    var touching = false;
    var line = false;
    var region = false;
    for (var k = 0; k < conflicts.length; k++) {
      var o = conflicts[k];
      var orow = E.rowOf(size, o);
      var ocol = E.colOf(size, o);
      if (orow === r || ocol === c) line = true;
      if (state.regions[o] === rid) region = true;
      if (orow !== r && ocol !== c && Math.abs(orow - r) <= 1 && Math.abs(ocol - c) <= 1) touching = true;
    }
    if (touching) return '너무 가까워요! 대각선도 안 돼요';
    if (line) return '같은 줄에 이미 카피바라가 있어요';
    if (region) return '같은 구역에 이미 카피바라가 있어요';
    return '이 칸엔 카피바라가 없어요';
  }

  function mistake(index) {
    state.seeds = Math.max(0, state.seeds - 1);
    var conflicts = E.conflictingCells(puzzleRef(), capybaras(), index);
    var message = mistakeReason(index, conflicts);

    renderStatus();
    renderSeeds(state.seeds);
    var cell = cellEls[index];
    cell.classList.add('wrong');
    setTimeout(function () {
      cell.classList.remove('wrong');
    }, 620);
    conflicts.forEach(function (c) {
      var target = cellEls[c];
      if (!target) return;
      target.classList.add('conflict');
      setTimeout(function () {
        target.classList.remove('conflict');
      }, 960);
    });

    toast(message + ' 🍊 -1');
    vibrate(state.seeds === 0 ? [20, 60, 20] : 20);
    saveProgress();

    if (state.seeds === 0) {
      setTimeout(function () {
        if (state && state.seeds === 0 && !state.solved) openSheet('sheetSeeds');
      }, 760);
    }
  }

  function vibrate(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) {
      /* ignore */
    }
  }

  function checkWin() {
    if (E.isSolved(state.regions, state.size, capybaras())) finishPuzzle();
  }

  function finishPuzzle() {
    if (!state || state.solved) return;
    pauseTimer();
    state.solved = true;
    var time = elapsed();

    stats.cleared = (stats.cleared || 0) + 1;
    var prevBest = stats.best[state.difficulty];
    if (!prevBest || time < prevBest) stats.best[state.difficulty] = time;

    var streakLine = '–';
    if (state.daily) {
      var today = todayKey();
      var yesterday = E.dateKeySeoul(new Date(Date.now() - 86400000));
      if (stats.lastDaily !== today) {
        stats.streak = stats.lastDaily === yesterday ? (stats.streak || 0) + 1 : 1;
        stats.lastDaily = today;
      }
      stats.dailyDone[today + ':' + state.difficulty] = true;
      streakLine = '🔥 ' + (stats.streak || 1) + '일';
    } else if (stats.streak) {
      streakLine = '🔥 ' + stats.streak + '일';
    }

    writeJSON(KEY.stats, stats);
    updateDailyBadge();
    saveProgressNow();

    el.winTime.textContent = formatTime(time);
    el.winBest.textContent = formatTime(stats.best[state.difficulty]);
    el.winStreak.textContent = streakLine;
    el.winSub.textContent = state.daily
      ? '오늘의 퍼즐을 풀었어요. 카피바라가 귤을 찾았어요 🍊'
      : '카피바라가 귤을 찾았어요 🍊';
    openSheet('sheetWin');
    partyBurst();
    vibrate([12, 40, 12, 40, 24]);
  }

  /* Confetti pops outward around the board square (🎉, not tangerines falling
     from the sky). It is a short, pointer-transparent layer above the scrim and
     below the win sheet, removed as soon as the pieces have landed. */
  function partyBurst() {
    if (!el.board || !el.overlay) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var previous = document.querySelector('.party');
    if (previous) previous.remove();

    var rect = el.board.getBoundingClientRect();
    if (!rect.width) return;
    var layer = document.createElement('div');
    layer.className = 'party';
    layer.setAttribute('aria-hidden', 'true');
    layer.style.left = rect.left + 'px';
    layer.style.top = rect.top + 'px';
    layer.style.width = rect.width + 'px';
    layer.style.height = rect.height + 'px';

    var count = 46;
    var reach = Math.max(110, rect.width * 0.52);
    var frag = document.createDocumentFragment();
    for (var i = 0; i < count; i++) {
      var piece = document.createElement('i');
      var sparkle = i === 5 || i === 17 || i === 29 || i === 41;
      /* a fountain around the square: most pieces arc up and out over the
         board, the rest shoot sideways, none of them drop from the sky */
      var angle;
      if (i < 32) {
        angle = -Math.PI * (0.05 + (0.9 * i) / 32) + (Math.random() - 0.5) * 0.16;
      } else {
        angle = (i % 2 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.7;
      }
      var distance = reach * (0.72 + Math.random() * 0.62);
      if (sparkle) {
        piece.className = 'party-bit sparkle';
        piece.textContent = '✦';
        piece.style.color = i % 2 ? '#ffe08a' : '#ff9ecb';
        piece.style.fontSize = 15 + Math.random() * 7 + 'px';
      } else {
        piece.className = 'party-bit' + (i % 3 === 0 ? ' round' : '');
        piece.style.background = PARTY_COLORS[i % PARTY_COLORS.length];
        piece.style.width = 5 + Math.random() * 6 + 'px';
        piece.style.height = 8 + Math.random() * 6 + 'px';
      }
      piece.style.setProperty('--dx', Math.round(Math.cos(angle) * distance) + 'px');
      piece.style.setProperty('--dy', Math.round(Math.sin(angle) * distance) + 'px');
      piece.style.setProperty('--rot', Math.round(Math.random() * 620 - 310) + 'deg');
      piece.style.animationDelay = (Math.random() * 0.22).toFixed(2) + 's';
      piece.style.animationDuration = (1.05 + Math.random() * 0.45).toFixed(2) + 's';
      frag.appendChild(piece);
    }
    layer.appendChild(frag);

    /* under the sheets so the modal text and buttons stay crisp */
    var sheet = el.overlay.querySelector('.sheet');
    if (sheet) el.overlay.insertBefore(layer, sheet);
    else el.overlay.appendChild(layer);

    setTimeout(function () {
      if (layer.parentNode) layer.parentNode.removeChild(layer);
    }, 1900);
  }

  function undo() {
    if (!state || !state.history.length) {
      toast('되돌릴 동작이 없어요');
      return;
    }
    var entry = state.history.pop();
    var items = entry.items || [];
    for (var i = 0; i < items.length; i++) state.board[items[i].i] = items[i].from;
    state.solved = false;
    lastTap = null;
    hideWinBanner();
    afterChange();
  }

  function hint() {
    if (!state || state.solved) return;
    var options = [];
    for (var r = 0; r < state.size; r++) {
      var idx = r * state.size + state.solution[r];
      if (state.board[idx] !== 2) options.push(idx);
    }
    if (!options.length) return;
    var pick = options[Math.floor(Math.random() * options.length)];
    var from = state.board[pick];
    state.board[pick] = 2;
    state.hints += 1;
    lastTap = null;
    pushHistory([{ i: pick, from: from, to: 2 }]);
    afterChange();
    var cell = cellEls[pick];
    if (cell) {
      cell.classList.add('hinted');
      setTimeout(function () {
        cell.classList.remove('hinted');
      }, 1100);
    }
    toast('💡 ' + (E.rowOf(state.size, pick) + 1) + '행 ' + (E.colOf(state.size, pick) + 1) + '열 — 여기엔 카피바라가 살아요');
    checkWin();
  }

  // ------------------------------------------------------------------ toast

  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.add('show');
    clearTimeout(toastHandle);
    toastHandle = setTimeout(function () {
      el.toast.classList.remove('show');
    }, 2100);
  }

  // ----------------------------------------------------------------- sheets

  function openSheet(id) {
    el.overlay.hidden = false;
    $$('.sheet').forEach(function (sheet) {
      sheet.hidden = sheet.id !== id;
    });
    activeSheet = id;
    if (state && !state.solved) pauseTimer();
    var sheet = document.getElementById(id);
    if (sheet) sheet.scrollTop = 0;
  }

  function closeSheet() {
    el.overlay.hidden = true;
    $$('.sheet').forEach(function (sheet) {
      sheet.hidden = true;
    });
    activeSheet = null;
    pendingConfirm = null;
    if (state && !state.solved && !document.hidden) startTimer();
    saveProgress();
  }

  function askConfirm(title, sub, action) {
    el.restartTitle.textContent = title;
    el.restartSub.textContent = sub;
    pendingConfirm = action;
    openSheet('sheetRestart');
  }

  // -------------------------------------------------------------- statistics

  function updateDailyBadge() {
    var today = todayKey();
    var done = stats.dailyDone[today + ':' + settings.difficulty];
    if (done) {
      el.dailyBadge.hidden = false;
      el.dailyBadge.textContent = '완료';
    } else if (stats.streak) {
      el.dailyBadge.hidden = false;
      el.dailyBadge.textContent = stats.streak + '일';
    } else {
      el.dailyBadge.hidden = true;
    }
  }

  function renderSettings() {
    el.setCb.checked = !!settings.colorblind;
    el.setAutoX.checked = !!settings.autoX;
    applyTheme();
    el.statCleared.textContent = String(stats.cleared || 0);
    el.statStreak.textContent = String(stats.streak || 0);
    var bests = Object.keys(stats.best || {})
      .filter(function (k) {
        return typeof stats.best[k] === 'number';
      })
      .sort(function (a, b) {
        return stats.best[a] - stats.best[b];
      });
    if (bests.length) {
      var key = bests[0];
      var label = E.difficultyByKey(key).label;
      el.statBest.textContent = formatTime(stats.best[key]);
      el.bestNote.innerHTML = bests
        .map(function (k) {
          return E.difficultyByKey(k).label + ' ' + formatTime(stats.best[k]);
        })
        .join(' · ');
      el.bestNote.dataset.lead = label;
    } else {
      el.statBest.textContent = '–';
      el.bestNote.textContent = '난이도별 최고 기록은 퍼즐을 완성하면 쌓여요.';
    }
  }

  // -------------------------------------------------------------- persistence

  function saveProgressNow() {
    if (!state) return;
    writeJSON(KEY.progress, {
      v: 1,
      difficulty: state.difficulty,
      size: state.size,
      seed: state.seed,
      daily: state.daily,
      dailyKey: state.dailyKey,
      r: E.encodeRegions(state.regions),
      s: E.encodeSolution(state.solution),
      board: state.board,
      seeds: state.seeds,
      hints: state.hints,
      elapsedMs: elapsed(),
      solved: state.solved,
      mode: settings.mode,
      savedAt: Date.now()
    });
  }

  function saveProgress() {
    clearTimeout(saveHandle);
    saveHandle = setTimeout(saveProgressNow, 350);
  }

  function restoreProgress() {
    var saved = readJSON(KEY.progress, null);
    if (!saved || !saved.r || !saved.s) return false;
    if (!saved.size || saved.size < 5 || saved.size > 10) return false;
    if (String(saved.r).length !== saved.size * saved.size) return false;
    if (String(saved.s).length !== saved.size) return false;
    if (!Array.isArray(saved.board) || saved.board.length !== saved.size * saved.size) return false;
    if (typeof saved.dailyKey === 'string' && saved.dailyKey && saved.dailyKey !== todayKey() && saved.daily) {
      // Yesterday's daily stays playable, it just stops being "today".
    }
    if (saved.mode) settings.mode = saved.mode;

    try {
      startPuzzle(saved.difficulty, !!saved.daily, {
        seed: saved.seed,
        puzzle: {
          size: saved.size,
          regions: E.decodeRegions(saved.r),
          solution: E.decodeSolution(saved.s)
        },
        board: saved.board,
        seeds: saved.seeds,
        hints: saved.hints,
        elapsedMs: saved.elapsedMs,
        solved: saved.solved
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------------------------------------------------------------- layout

  function sizeBoard() {
    var wrap = document.querySelector('.board-wrap');
    if (!wrap) return;
    var rect = wrap.getBoundingClientRect();
    var max = Math.min(rect.width || 360, rect.height || 420, 430);
    var size = Math.max(240, Math.floor(max));
    document.documentElement.style.setProperty('--board-size', size + 'px');
  }

  // ----------------------------------------------------------------- events

  function cellFromPoint(x, y) {
    var node = document.elementFromPoint(x, y);
    if (!node) return -1;
    var cell = node.closest ? node.closest('.cell') : null;
    if (!cell || !el.board.contains(cell)) return -1;
    return Number(cell.dataset.i);
  }

  function onPointerDown(e) {
    if (!state || state.solved) return;
    if (e.button !== undefined && e.button !== 0) return;
    var index = cellFromPoint(e.clientX, e.clientY);
    if (index < 0) return;
    e.preventDefault();
    drag = {
      start: index,
      last: index,
      moved: false,
      painting:
        settings.mode === 'memo'
          ? state.board[index] !== 2
          : settings.mode === 'auto' && state.board[index] === 0,
      erasing: settings.mode === 'memo' && state.board[index] === 1,
      items: [],
      pointerId: e.pointerId
    };
    try {
      el.board.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ignore */
    }
  }

  function onPointerMove(e) {
    if (!drag) return;
    if (!drag.moved) {
      var startCell = cellEls[drag.start];
      var rect = startCell.getBoundingClientRect();
      var dx = e.clientX - (rect.left + rect.width / 2);
      var dy = e.clientY - (rect.top + rect.height / 2);
      if (Math.sqrt(dx * dx + dy * dy) < 12) return;
      drag.moved = true;
      if (drag.painting) {
        var first = dragCell(drag.start);
        if (first) drag.items.push(first);
        renderBoard();
      }
    }
    var index = cellFromPoint(e.clientX, e.clientY);
    if (index < 0 || index === drag.last) return;
    drag.last = index;
    if (drag.painting && settings.mode !== "place") {
      var item = dragCell(index);
      if (item) {
        drag.items.push(item);
        renderBoard();
      }
    }
  }

  function onPointerUp() {
    if (!drag) return;
    var finished = drag;
    drag = null;
    if (finished.moved) {
      /* a drag is not a tap: the next tap starts a fresh single tap */
      lastTap = null;
      if (finished.items.length) {
        pushHistory(finished.items);
        recomputeBlocked();
        renderBoard();
        renderStatus();
        saveProgress();
      }
    } else {
      tapCell(finished.start);
    }
  }

  function bindEvents() {
    el.board.addEventListener('pointerdown', onPointerDown);
    el.board.addEventListener('pointermove', onPointerMove);
    el.board.addEventListener('pointerup', onPointerUp);
    el.board.addEventListener('pointercancel', onPointerUp);
    el.board.addEventListener('contextmenu', function (e) {
      e.preventDefault();
    });

    el.tabRandom.addEventListener('click', function () {
      if (state && state.daily) {
        if (hasProgress()) {
          askConfirm('새 퍼즐을 시작할까요?', '지금 풀던 퍼즐은 사라져요.', function () {
            closeSheet();
            startPuzzle(settings.difficulty, false);
          });
        } else {
          startPuzzle(settings.difficulty, false);
        }
      } else if (hasProgress()) {
        askConfirm('새 퍼즐을 시작할까요?', '지금 풀던 퍼즐은 사라져요.', function () {
          closeSheet();
          startPuzzle(settings.difficulty, false);
        });
      } else {
        startPuzzle(settings.difficulty, false);
      }
    });

    el.tabDaily.addEventListener('click', function () {
      var alreadyToday = state && state.daily && state.dailyKey === todayKey() && state.difficulty === settings.difficulty;
      if (alreadyToday && !state.solved) {
        toast('오늘의 퍼즐을 이미 풀고 있어요');
        return;
      }
      var launch = function () {
        closeSheet();
        startPuzzle(settings.difficulty, true);
      };
      if (hasProgress()) askConfirm('오늘의 퍼즐을 시작할까요?', '지금 풀던 퍼즐은 사라져요.', launch);
      else launch();
    });

    $('#levelSwitch').addEventListener('click', function (e) {
      var btn = e.target.closest('.level-tab');
      if (!btn) return;
      settings.group = btn.dataset.group;
      writeJSON(KEY.settings, settings);
      renderDifficulty();
    });

    el.diffs.addEventListener('click', function (e) {
      var btn = e.target.closest('.diff');
      if (!btn) return;
      var key = btn.dataset.diff;
      if (!key || (state && state.difficulty === key && !state.daily)) return;
      var launch = function () {
        closeSheet();
        startPuzzle(key, false);
      };
      if (hasProgress()) askConfirm(E.difficultyByKey(key).label + ' 퍼즐을 시작할까요?', '지금 풀던 퍼즐은 사라져요.', launch);
      else launch();
    });

    $('#modes').addEventListener('click', function (e) {
      var btn = e.target.closest('.mode');
      if (!btn) return;
      settings.mode = btn.dataset.mode;
      lastTap = null;
      writeJSON(KEY.settings, settings);
      renderModes();
    });

    el.btnTheme.addEventListener('click', function () {
      settings.theme = effectiveDark() ? 'light' : 'dark';
      writeJSON(KEY.settings, settings);
      applyTheme();
      if (activeSheet === 'sheetSettings') renderSettings();
    });

    el.btnSettings.addEventListener('click', function () {
      renderSettings();
      openSheet('sheetSettings');
    });

    el.btnUndo.addEventListener('click', undo);
    el.btnHint.addEventListener('click', hint);
    el.btnRestart.addEventListener('click', function () {
      if (!state) return;
      if (!hasProgress()) {
        restartPuzzle();
        toast('퍼즐을 새로 시작했어요');
        return;
      }
      askConfirm('처음부터 다시 시작할까요?', '지금까지 놓은 카피바라와 메모가 사라져요.', function () {
        closeSheet();
        restartPuzzle();
      });
    });

    el.scrim.addEventListener('click', closeSheet);
    el.btnCloseSettings.addEventListener('click', closeSheet);

    el.btnNextPuzzle.addEventListener('click', function () {
      closeSheet();
      startPuzzle(settings.difficulty, false);
    });
    el.btnCloseWin.addEventListener('click', function () {
      closeSheet();
      if (state && state.solved) showWinBanner(elapsed());
    });

    el.btnRevive.addEventListener('click', function () {
      closeSheet();
      if (!state) return;
      state.seeds = 3;
      renderSeeds();
      saveProgress();
      toast('🍊 귤 3개를 충전했어요!');
    });
    el.btnRestartFromSeeds.addEventListener('click', function () {
      closeSheet();
      restartPuzzle();
    });

    el.btnRestartConfirm.addEventListener('click', function () {
      var action = pendingConfirm;
      closeSheet();
      if (action) action();
    });
    el.btnRestartCancel.addEventListener('click', closeSheet);

    el.btnWinBannerNew.addEventListener('click', function () {
      startPuzzle(settings.difficulty, false);
    });

    el.setDark.addEventListener('change', function () {
      settings.theme = el.setDark.checked ? 'dark' : 'light';
      writeJSON(KEY.settings, settings);
      applyTheme();
    });
    el.setCb.addEventListener('change', function () {
      settings.colorblind = el.setCb.checked;
      writeJSON(KEY.settings, settings);
      el.board.classList.toggle('cb', settings.colorblind);
    });
    el.setAutoX.addEventListener('change', function () {
      settings.autoX = el.setAutoX.checked;
      settings.prefsVersion = DEFAULT_SETTINGS.prefsVersion;
      writeJSON(KEY.settings, settings);
      renderBoard();
    });
    el.btnReset.addEventListener('click', function () {
      stats = JSON.parse(JSON.stringify(DEFAULT_STATS));
      writeJSON(KEY.stats, stats);
      renderSettings();
      updateDailyBadge();
      toast('기록을 초기화했어요');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (activeSheet === 'sheetWin') {
          closeSheet();
        } else if (activeSheet) {
          closeSheet();
        }
      }
      if (activeSheet) return;
      if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        undo();
      }
      if (e.key === 'h') hint();
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        pauseTimer();
        saveProgressNow();
      } else if (state && !state.solved && !activeSheet) {
        startTimer();
      }
    });

    window.addEventListener('pagehide', saveProgressNow);

    window.addEventListener('resize', sizeBoard);
    window.addEventListener('orientationchange', function () {
      setTimeout(sizeBoard, 120);
    });

    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () {
        if (settings.theme === 'auto') {
          applyTheme();
          if (activeSheet === 'sheetSettings') renderSettings();
        }
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }

    document.addEventListener('gesturestart', function (e) {
      e.preventDefault();
    });
  }

  // -------------------------------------------------------------- win banner

  function showWinBanner(time) {
    el.winBannerText.textContent = '완성! ' + formatTime(time);
    el.winBanner.hidden = false;
  }

  function hideWinBanner() {
    el.winBanner.hidden = true;
  }

  // -------------------------------------------------------------------- boot

  function cacheElements() {
    el.board = $('#board');
    el.timer = $('#timer');
    el.seeds = $('#seeds');
    el.remain = $('#remain');
    el.toast = $('#toast');
    el.winBanner = $('#winBanner');
    el.winBannerText = $('#winBannerText');
    el.btnWinBannerNew = $('#btnWinBannerNew');
    el.diffs = $('#diffs');
    el.tabRandom = $('#tabRandom');
    el.tabDaily = $('#tabDaily');
    el.dailyBadge = $('#dailyBadge');
    el.btnTheme = $('#btnTheme');
    el.btnSettings = $('#btnSettings');
    el.btnUndo = $('#btnUndo');
    el.btnHint = $('#btnHint');
    el.btnRestart = $('#btnRestart');
    el.overlay = $('#overlay');
    el.scrim = $('#scrim');
    el.restartTitle = $('#restartTitle');
    el.restartSub = $('#sheetRestart .win-sub');
    el.btnRestartConfirm = $('#btnRestartConfirm');
    el.btnRestartCancel = $('#btnRestartCancel');
    el.winTime = $('#winTime');
    el.winBest = $('#winBest');
    el.winStreak = $('#winStreak');
    el.winSub = $('#winSub');
    el.btnNextPuzzle = $('#btnNextPuzzle');
    el.btnCloseWin = $('#btnCloseWin');
    el.btnRevive = $('#btnRevive');
    el.btnRestartFromSeeds = $('#btnRestartFromSeeds');
    el.setDark = $('#setDark');
    el.setCb = $('#setCb');
    el.setAutoX = $('#setAutoX');
    el.statCleared = $('#statCleared');
    el.statStreak = $('#statStreak');
    el.statBest = $('#statBest');
    el.bestNote = $('#bestNote');
    el.btnReset = $('#btnReset');
    el.btnCloseSettings = $('#btnCloseSettings');
    el.brandBadge = $('#brandBadge');
    el.winCapi = $('#winCapi');
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    var reg = null;
    /* iPhone home-screen apps keep the page alive for days, so ask for a new
       sw.js on every open and whenever the app comes back to the foreground.
       The worker itself serves the core files network-first, so once it is
       updated a reload picks up the deployed code. */
    var checkUpdate = function () {
      if (!reg) return;
      reg.update().catch(function () {
        /* offline is fine — the cached app keeps playing */
      });
    };
    window.addEventListener('load', function () {
      navigator.serviceWorker
        .register('./sw.js')
        .then(function (r) {
          reg = r;
          checkUpdate();
        })
        .catch(function () {
          /* offline support is a bonus, never a blocker */
        });
    });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) checkUpdate();
    });
  }

  function boot() {
    cacheElements();
    el.brandBadge.innerHTML = CAPY_SVG;
    el.winCapi.innerHTML = CAPY_SVG;
    var placeMode = $('.mode[data-mode="place"]');
    if (placeMode) placeMode.innerHTML = '<span class="mode-capi">' + CAPY_SVG + '</span>카피바라';

    applyTheme();
    renderModes();
    bindEvents();
    renderDifficulty();

    if (!restoreProgress()) startPuzzle(settings.difficulty, false);
    requestAnimationFrame(sizeBoard);
    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        sizeBoard();
      }).observe(document.querySelector('.board-wrap'));
    }
    registerSW();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // Exposed for automated UI tests only.
  window.__capydoku = {
    get state() {
      return state;
    },
    get settings() {
      return settings;
    },
    get stats() {
      return stats;
    },
    engine: E,
    startPuzzle: startPuzzle,
    tapCell: tapCell,
    mistake: mistake,
    hint: hint,
    undo: undo,
    isSolutionCell: isSolutionCell
  };
})();
