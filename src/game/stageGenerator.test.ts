import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KILLS_TO_OPEN_EXIT,
  PORTALS_PER_STAGE,
  TILE_SIZE,
  generateStage,
  getBiomeForStage,
  getWorldIndexForStage,
} from './stageGenerator';

test('All 100 stages generate 5 long roguelike areas, 6 biomes, moving platforms, monkey bars, water, and 5-kill exit portals', () => {
  const seenBiomes = new Set<string>();
  const seenMovingAxes = new Set<string>();
  let sawWaterTile = false;
  let sawMonkeyBar = false;

  for (let s = 1; s <= 100; s++) {
    const data = generateStage(s);
    assert.equal(data.stageNumber, s);
    assert.equal(data.worldIndex, getWorldIndexForStage(s));
    assert.equal(data.biome.id, getBiomeForStage(s).id);
    seenBiomes.add(data.biome.id);
    assert.equal(data.isBossStage, s % 5 === 0);
    assert.equal(data.areas.length, PORTALS_PER_STAGE, `Stage ${s} must have 5 portal areas`);

    for (let aIdx = 0; aIdx < data.areas.length; aIdx++) {
      const area = data.areas[aIdx];
      assert.equal(area.areaIndex, aIdx);
      if (!area.isBossArea) {
        assert.ok(area.cols >= 68, `Stage ${s} area ${aIdx + 1} should be long (>= 68 cols)`);
        // Multiple portals per roguelike area (2 warp + 1 exit)
        assert.ok(area.portals.length >= 3, `Stage ${s} A${aIdx + 1} should have multiple portals`);
        const exitPortal = area.portals.find((p) => p.kind === 'exit');
        assert.ok(exitPortal, `Stage ${s} A${aIdx + 1} must have exit portal`);
        assert.equal(exitPortal.requiredKills, KILLS_TO_OPEN_EXIT);
        assert.equal(KILLS_TO_OPEN_EXIT, 5);
      }

      for (const mp of area.movingPlatforms) {
        seenMovingAxes.add(mp.axis);
      }
      for (const row of area.tiles) {
        for (const tile of row) {
          if (tile === 8) sawWaterTile = true;
          if (tile === 7) sawMonkeyBar = true;
        }
      }

      // Spawn floor must be solid and air above spawn must be clear >= 3 tiles wide
      const spawnCol = Math.floor(area.spawnX / TILE_SIZE);
      const groundRow = Math.floor(area.spawnY / TILE_SIZE);
      for (let c = Math.max(0, spawnCol - 1); c <= spawnCol + 2; c++) {
        assert.equal(area.tiles[groundRow][c], 1, `Stage ${s} A${aIdx + 1} col ${c} should have solid ground at spawn`);
        assert.equal(area.tiles[groundRow - 1][c], 0, `Stage ${s} A${aIdx + 1} col ${c} should be clear above spawn`);
        assert.equal(area.tiles[groundRow - 2][c], 0, `Stage ${s} A${aIdx + 1} col ${c} should have headroom at spawn`);
      }

      assert.ok(area.enemies.length >= (area.isBossArea ? 2 : 7), `Stage ${s} area ${aIdx + 1} should have enemies`);
      for (const enemy of area.enemies) {
        assert.ok(enemy.enemyLevel >= s, `Enemy in stage ${s} must carry enemyLevel >= ${s}`);
      }
    }

    if (data.isBossStage) {
      const finalArea = data.areas[PORTALS_PER_STAGE - 1];
      assert.equal(finalArea.isBossArea, true);
      const boss = finalArea.enemies.find((e) => e.kind === 'boss');
      assert.ok(boss, `Boss stage ${s} final area must contain boss`);
      if (s === 100) {
        assert.equal(boss.bossDef?.isFinalBoss, true);
        assert.equal(boss.name, 'Abyss Emperor');
      }
    }
  }

  assert.equal(seenBiomes.size, 6, 'All 6 biomes must appear across stages');
  assert.equal(seenMovingAxes.has('x'), true);
  assert.equal(seenMovingAxes.has('y'), true);
  assert.equal(sawWaterTile, true);
  assert.equal(sawMonkeyBar, true);
});

test('Stages feature at least 20 distinct keroco monsters across early-mid progression', () => {
  const seen = new Set<string>();
  for (let s = 1; s <= 30; s++) {
    const data = generateStage(s);
    for (const area of data.areas) {
      for (const e of area.enemies) {
        if (e.kerocoId) seen.add(e.kerocoId);
      }
    }
  }
  assert.ok(seen.size >= 20, `Expected >=20 unique keroco monsters, saw ${seen.size}`);
});

