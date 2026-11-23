/*
 * Engine tests: run with `node --test test/engine.test.js`.
 *
 * Verifies, for every level from 5×5 to 10×10, that generated puzzles have
 * connected regions of legal size, a valid solution, and exactly one solution;
 * that seeds are deterministic; that the daily seed follows the Seoul date;
 * that the bundled fallback pool is sound; and that generation stays fast.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const Engine = require(path.join(__dirname, '..', 'engine.js'));

function solutionCells(puzzle) {
  return puzzle.solution.map((col, row) => row * puzzle.size + col);
}

function cellsByRegion(puzzle) {
  const cells = Array.from({ length: puzzle.size }, () => []);
  puzzle.regions.forEach((rid, i) => cells[rid].push(i));
  return cells;
}

function assertConnected(size, regions, rid, cells) {
  const inside = new Set(cells);
  const seen = new Set([cells[0]]);
  const queue = [cells[0]];
  while (queue.length) {
    const cur = queue.pop();
    const r = Math.floor(cur / size);
    const c = cur % size;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
      const ni = rr * size + cc;
      if (inside.has(ni) && !seen.has(ni)) {
        seen.add(ni);
        queue.push(ni);
      }
    }
  }
  assert.strictEqual(seen.size, cells.length, `region ${rid} is not connected`);
}

function checkPuzzle(puzzle, label) {
  const { size, regions, solution } = puzzle;
  assert.strictEqual(regions.length, size * size, `${label}: region map size`);

  const cells = cellsByRegion(puzzle);
  assert.strictEqual(cells.length, size, `${label}: region count`);
  const rules = Engine.rulesFor(size);
  cells.forEach((list, rid) => {
    assert.ok(list.length >= 1, `${label}: region ${rid} is empty`);
    assert.ok(
      list.length >= rules.minRegion,
      `${label}: region ${rid} has ${list.length} cells, min is ${rules.minRegion}`
    );
    assert.ok(
      list.length <= rules.maxRegion,
      `${label}: region ${rid} has ${list.length} cells, max is ${rules.maxRegion}`
    );
    assertConnected(size, regions, rid, list);
  });

  const capybaras = solutionCells(puzzle);
  assert.ok(Engine.isSolved(regions, size, capybaras), `${label}: stored solution is invalid`);

  const solved = Engine.solve(regions, size, 5);
  assert.strictEqual(solved.count, 1, `${label}: expected exactly one solution, got ${solved.count}`);
  assert.deepStrictEqual(solved.solutions[0], solution, `${label}: solver found another solution`);

  assert.deepStrictEqual(
    solution.slice().sort((a, b) => a - b),
    Array.from({ length: size }, (_, i) => i),
    `${label}: one capybara per column`
  );
  for (let r = 0; r + 1 < size; r++) {
    assert.ok(Math.abs(solution[r] - solution[r + 1]) > 1, `${label}: touching at row ${r}`);
  }
}

test('level table spans 5×5 to 10×10 in two clear groups', () => {
  assert.deepStrictEqual(
    Engine.DIFFICULTIES.map((d) => d.size),
    [5, 6, 7, 8, 9, 10]
  );
  assert.deepStrictEqual(
    Engine.DIFFICULTIES.map((d) => d.label),
    ['초급', '쉬움', '보통', '어려움', '전문가', '마스터']
  );
  assert.deepStrictEqual(
    Engine.DIFFICULTIES.map((d) => d.group),
    ['easy', 'easy', 'hard', 'hard', 'hard', 'hard']
  );
});

test('5×5 has valid non-touching placements to build on', () => {
  // The classic 5-queens style placement the level was designed around.
  const sample = [0, 2, 4, 1, 3];
  for (let r = 0; r + 1 < 5; r++) {
    assert.ok(Math.abs(sample[r] - sample[r + 1]) > 1);
  }
  const puzzle = Engine.generatePuzzle(5, 'beginner-check');
  checkPuzzle(puzzle, '5×5');
  assert.strictEqual(puzzle.size, 5);
  assert.strictEqual(puzzle.regions.length, 25);
});

for (const size of [5, 6, 7, 8, 9, 10]) {
  test(`${size}×${size}: unique, connected and within region size rules`, () => {
    const seeds = size >= 9 ? 8 : 12;
    for (let i = 0; i < seeds; i++) {
      const puzzle = Engine.generatePuzzle(size, `test-${size}-${i}`);
      checkPuzzle(puzzle, `${size}×${size} seed ${i}`);
      const perRegion = new Array(size).fill(0);
      solutionCells(puzzle).forEach((idx) => perRegion[puzzle.regions[idx]]++);
      assert.deepStrictEqual(perRegion, new Array(size).fill(1), 'one capybara per region');
    }
  });
}

test('beginner boards stay friendly, hard boards avoid tiny regions', () => {
  const beginner = Engine.generatePuzzle(5, 'beginner-friendly');
  const beginnerSizes = Engine.regionSizes(beginner.regions, 5);
  assert.ok(Math.min(...beginnerSizes) >= 1);
  assert.strictEqual(beginnerSizes.reduce((a, b) => a + b, 0), 25);

  for (const size of [8, 9, 10]) {
    const puzzle = Engine.generatePuzzle(size, `balance-${size}`);
    const sizes = Engine.regionSizes(puzzle.regions, size);
    assert.ok(Math.min(...sizes) >= Engine.rulesFor(size).minRegion, `${size}: no tiny regions`);
    const twos = sizes.filter((s) => s === 2).length;
    assert.ok(twos <= Math.ceil(size / 2), `${size}: too many 2-cell regions (${twos})`);
  }
});

test('same seed gives the same puzzle on every run', () => {
  for (const size of [5, 7, 9, 10]) {
    const a = Engine.generatePuzzle(size, `deterministic-${size}`);
    const b = Engine.generatePuzzle(size, `deterministic-${size}`);
    assert.deepStrictEqual(a.regions, b.regions);
    assert.deepStrictEqual(a.solution, b.solution);
  }
});

test('different seeds give different puzzles', () => {
  const a = Engine.generatePuzzle(8, 'seed-a');
  const b = Engine.generatePuzzle(8, 'seed-b');
  assert.notDeepStrictEqual(a.regions, b.regions);
});

test('daily seeds follow the Seoul date and stay stable', () => {
  const key = Engine.dateKeySeoul(new Date('2026-11-23T00:30:00+09:00'));
  assert.strictEqual(key, '2026-11-23');
  // 15:30 UTC is already the next day in Seoul.
  assert.strictEqual(Engine.dateKeySeoul(new Date('2026-11-23T15:30:00Z')), '2026-11-24');

  for (const size of [5, 6, 7, 8, 9, 10]) {
    const seed = `daily-${key}-${size}`;
    const a = Engine.generatePuzzle(size, seed);
    const b = Engine.generatePuzzle(size, seed);
    assert.deepStrictEqual(a.regions, b.regions);
    // Daily puzzles exist at every level, including 9×9 and 10×10.
    checkPuzzle(a, `daily ${size}×${size}`);
  }

  const day1 = Engine.generatePuzzle(10, 'daily-2026-11-23-master');
  const day2 = Engine.generatePuzzle(10, 'daily-2026-11-24-master');
  assert.notDeepStrictEqual(day1.regions, day2.regions);
});

test('bundled fallback pool is valid, unique and deterministic', () => {
  for (const size of [5, 6, 7, 8, 9, 10]) {
    const pool = Engine.FALLBACK_POOL[size];
    assert.ok(pool.length >= 8, `fallback pool for ${size}`);
    for (const entry of pool) {
      const puzzle = {
        size,
        regions: Engine.decodeRegions(entry.r),
        solution: Engine.decodeSolution(entry.s)
      };
      checkPuzzle(puzzle, `fallback ${size}`);
    }
  }
});

test('generation stays inside the performance budget', () => {
  const budgets = { 5: 100, 6: 100, 7: 150, 8: 150, 9: 400, 10: 400 };
  for (const size of [5, 6, 7, 8, 9, 10]) {
    const times = [];
    for (let i = 0; i < 8; i++) {
      const start = process.hrtime.bigint();
      Engine.generatePuzzle(size, `perf-${size}-${i}`);
      times.push(Number(process.hrtime.bigint() - start) / 1e6);
    }
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)];
    console.log(
      `${size}×${size} generation: median ${median.toFixed(1)}ms, max ${times[times.length - 1].toFixed(1)}ms`
    );
    assert.ok(median < budgets[size] / 2, `${size}×${size} median ${median.toFixed(1)}ms`);
    assert.ok(
      times[times.length - 1] < budgets[size],
      `${size}×${size} slowest ${times[times.length - 1].toFixed(1)}ms exceeds ${budgets[size]}ms`
    );
  }
});

test('rule helpers find conflicts and blocked cells', () => {
  const puzzle = Engine.generatePuzzle(6, 'helpers');
  const { size, regions } = puzzle;
  const capybaras = solutionCells(puzzle);

  const blocked = Engine.blockedCells(puzzle, capybaras);
  for (let i = 0; i < size * size; i++) {
    if (capybaras.includes(i)) assert.strictEqual(blocked[i], 0);
    else assert.strictEqual(blocked[i], 1);
  }

  const extra = puzzle.solution[1] * 1; // row 1's column, placed in row 0
  const conflicts = Engine.conflictingCells(puzzle, capybaras, extra);
  assert.ok(conflicts.length > 0);

  assert.ok(Engine.isSolved(regions, size, capybaras));
  assert.ok(!Engine.isSolved(regions, size, capybaras.slice(0, size - 1)));
});

test('region encoding round-trips for all board sizes', () => {
  for (const size of [5, 9, 10]) {
    const puzzle = Engine.generatePuzzle(size, `encode-${size}`);
    const encoded = Engine.encodeRegions(puzzle.regions);
    assert.strictEqual(encoded.length, size * size);
    assert.deepStrictEqual(Engine.decodeRegions(encoded), puzzle.regions);
    assert.strictEqual(
      Engine.decodeSolution(Engine.encodeSolution(puzzle.solution)).join(','),
      puzzle.solution.join(',')
    );
  }
});
