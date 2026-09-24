import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeStarsGained7d,
  recordSnapshot,
  serializeStarHistory,
  shiftDate,
} from '../src/lib/starHistory.js';

const TODAY = '2026-09-24';
const REPO = 'demo-owner/demo-project';

function snapshot(daysAgo, stars) {
  return { date: shiftDate(TODAY, -daysAgo), stars: { [REPO]: stars } };
}

test('涨星取「最近的、且已满 7 天」那次快照做基线', () => {
  const history = [snapshot(30, 10), snapshot(14, 18), snapshot(7, 20), snapshot(2, 27)];
  // 2 天前那次不满 7 天，不能当基线
  assert.equal(computeStarsGained7d(history, REPO, 28, TODAY), 8);
});

test('历史不足 7 天时返回 null，而不是拿 0 冒充', () => {
  assert.equal(computeStarsGained7d([snapshot(3, 20)], REPO, 28, TODAY), null);
  assert.equal(computeStarsGained7d([], REPO, 28, TODAY), null);
  // 仓库是后来才收录的，老快照里没有它
  assert.equal(computeStarsGained7d([snapshot(8, 20)], 'other/repo', 5, TODAY), null);
  // 拿不到当前 star 数（离线构建）同样算没有数据
  assert.equal(computeStarsGained7d([snapshot(8, 20)], REPO, null, TODAY), null);
});

test('star 数回落不会算出负数', () => {
  assert.equal(computeStarsGained7d([snapshot(8, 30)], REPO, 28, TODAY), 0);
});

test('记快照会覆盖同一天并丢掉过期数据', () => {
  const history = [snapshot(40, 1), snapshot(10, 3), snapshot(1, 4)];
  const next = recordSnapshot(history, TODAY, { [REPO]: 5 });

  assert.deepEqual(
    next.map((item) => item.date),
    [shiftDate(TODAY, -10), shiftDate(TODAY, -1), TODAY],
  );
  assert.equal(next.at(-1).stars[REPO], 5);

  // 同一天重跑：覆盖而不是追加
  const again = recordSnapshot(next, TODAY, { [REPO]: 6 });
  assert.equal(again.length, next.length);
  assert.equal(again.at(-1).stars[REPO], 6);
});

test('序列化后能原样读回', () => {
  const history = [snapshot(1, 5)];
  assert.deepEqual(JSON.parse(serializeStarHistory(history)).snapshots, history);
});