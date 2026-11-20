import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PORTALS_PER_STAGE,
  generateStage,
  getWorldIndexForStage,
  TILE_SIZE,
} from './stageGenerator';

test('All 100 stages generate 5 long areas (5 portals) across 5 worlds with valid clear spawns and bosses', () => {
  for (let s = 1; s <= 100; s++) {
    const data = generateStage(s);
    assert.equal(data.stageNumber, s);
    assert.equal(data.worldIndex, getWorldIndexForStage(s));
    assert.equal(data.isBossStage, s % 5 === 0);
    assert.equal(data.areas.length, PORTALS_PER_STAGE, `Stage ${s} must have 5 portal areas`);

    for (let aIdx = 0; aIdx < data.areas.length; aIdx++) {
      const area = data.areas[aIdx];
      assert.equal(area.areaIndex, aIdx);
      if (!area.isBossArea) {
        assert.ok(area.cols >= 52, `Stage ${s} area ${aIdx + 1} should be long (>= 52 cols)`);
      }
      assert.ok(area.portalX > area.spawnX + TILE_SIZE * 20, `Stage ${s} area ${aIdx + 1} portal must be at far end`);

      // Spawn floor must be solid and air above spawn must be clear >= 3 tiles wide
      const spawnCol = Math.floor(area.spawnX / TILE_SIZE);
      const groundRow = Math.floor(area.spawnY / TILE_SIZE);
      for (let c = Math.max(0, spawnCol - 1); c <= spawnCol + 2; c++) {
        assert.equal(area.tiles[groundRow][c], 1, `Stage ${s} A${aIdx + 1} col ${c} should have solid ground at spawn`);
        assert.equal(area.tiles[groundRow - 1][c], 0, `Stage ${s} A${aIdx + 1} col ${c} should be clear above spawn`);
        assert.equal(area.tiles[groundRow - 2][c], 0, `Stage ${s} A${aIdx + 1} col ${c} should have headroom at spawn`);
      }

      assert.ok(area.enemies.length >= 1, `Stage ${s} area ${aIdx + 1} should have enemies`);
    }

    if (data.isBossStage) {
      const finalArea = data.areas[PORTALS_PER_STAGE - 1];
      assert.equal(finalArea.isBossArea, true);
      assert.ok(finalArea.enemies.some((e) => e.kind === 'boss'), `Boss stage ${s} final area must contain boss`);
    }
  }
});

test('Stages feature at least 4 distinct enemy archetypes across early progression', () => {
  const seen = new Set<string>();
  for (let s = 1; s <= 10; s++) {
    const data = generateStage(s);
    for (const area of data.areas) {
      for (const e of area.enemies) seen.add(e.kind);
    }
  }
  assert.ok(seen.size >= 4, `Expected >=4 enemy archetypes, saw ${[...seen].join(',')}`);
});
