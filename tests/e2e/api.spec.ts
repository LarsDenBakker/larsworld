import { test, expect } from '@playwright/test';

const API = 'http://localhost:3000/api';

test.describe('Backend API', () => {
  test('ping returns 200', async ({ request }) => {
    const res = await request.get(`${API}/ping`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.message).toBeTruthy();
  });

  test('GET /chunk returns a valid 16x16 chunk', async ({ request }) => {
    const res = await request.get(`${API}/chunk?chunkX=0&chunkY=0&seed=test`);
    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(body.chunkX).toBe(0);
    expect(body.chunkY).toBe(0);
    expect(body.tiles).toHaveLength(16);
    for (const row of body.tiles) {
      expect(row).toHaveLength(16);
    }
  });

  test('POST /chunk returns a valid 16x16 chunk', async ({ request }) => {
    const res = await request.post(`${API}/chunk`, {
      data: { chunkX: 5, chunkY: 5, seed: 'hello' }
    });
    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(body.chunkX).toBe(5);
    expect(body.chunkY).toBe(5);
    expect(body.tiles).toHaveLength(16);
    for (const row of body.tiles) {
      expect(row).toHaveLength(16);
    }
  });

  test('chunk tiles have valid compact fields', async ({ request }) => {
    const res = await request.post(`${API}/chunk`, {
      data: { chunkX: 30, chunkY: 30, seed: 'validfields' }
    });
    const body = await res.json();

    for (const row of body.tiles) {
      for (const tile of row) {
        // tile type: 0=ocean, 1=land
        expect([0, 1]).toContain(tile.t);
        // elevation: 0-255
        expect(tile.e).toBeGreaterThanOrEqual(0);
        expect(tile.e).toBeLessThanOrEqual(255);
        // temperature: 0-255
        expect(tile.tmp).toBeGreaterThanOrEqual(0);
        expect(tile.tmp).toBeLessThanOrEqual(255);
        // moisture: 0-255
        expect(tile.m).toBeGreaterThanOrEqual(0);
        expect(tile.m).toBeLessThanOrEqual(255);
        // biome index: 0-11
        expect(tile.b).toBeGreaterThanOrEqual(0);
        expect(tile.b).toBeLessThanOrEqual(11);
        // river type: 0-10
        expect(tile.r).toBeGreaterThanOrEqual(0);
        expect(tile.r).toBeLessThanOrEqual(10);
        // lake flag: 0 or 1
        expect([0, 1]).toContain(tile.l);
      }
    }
  });

  test('ocean tiles have lower elevation than land tiles', async ({ request }) => {
    // Use a chunk we know has both ocean and land
    const res = await request.post(`${API}/chunks`, {
      data: {
        seed: '12345',
        chunks: Array.from({ length: 25 }, (_, i) => ({
          chunkX: Math.floor(i / 5),
          chunkY: i % 5
        }))
      }
    });
    const body = await res.json();

    const landElevations: number[] = [];
    const oceanElevations: number[] = [];
    for (const chunk of body.chunks) {
      for (const row of chunk.tiles) {
        for (const tile of row) {
          if (tile.t === 1) landElevations.push(tile.e);
          else oceanElevations.push(tile.e);
        }
      }
    }

    if (landElevations.length > 0 && oceanElevations.length > 0) {
      const avgLand = landElevations.reduce((a, b) => a + b, 0) / landElevations.length;
      const avgOcean = oceanElevations.reduce((a, b) => a + b, 0) / oceanElevations.length;
      expect(avgLand).toBeGreaterThan(avgOcean);
    }
  });

  test('rivers only appear on land tiles', async ({ request }) => {
    const res = await request.post(`${API}/chunks`, {
      data: {
        seed: '77777',
        chunks: Array.from({ length: 16 }, (_, i) => ({
          chunkX: Math.floor(i / 4) + 20,
          chunkY: (i % 4) + 20
        }))
      }
    });
    const body = await res.json();

    for (const chunk of body.chunks) {
      for (const row of chunk.tiles) {
        for (const tile of row) {
          if (tile.r !== 0) {
            // river tile must be land
            expect(tile.t).toBe(1);
          }
        }
      }
    }
  });

  test('generation is deterministic — same seed produces same tiles', async ({ request }) => {
    const payload = { chunkX: 10, chunkY: 10, seed: 'deterministic-seed' };
    const [r1, r2] = await Promise.all([
      request.post(`${API}/chunk`, { data: payload }),
      request.post(`${API}/chunk`, { data: payload })
    ]);
    const [b1, b2] = await Promise.all([r1.json(), r2.json()]);

    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        expect(b1.tiles[y][x]).toEqual(b2.tiles[y][x]);
      }
    }
  });

  test('different seeds produce different tiles', async ({ request }) => {
    const [r1, r2] = await Promise.all([
      request.post(`${API}/chunk`, { data: { chunkX: 0, chunkY: 0, seed: 'seedA' } }),
      request.post(`${API}/chunk`, { data: { chunkX: 0, chunkY: 0, seed: 'seedB' } })
    ]);
    const [b1, b2] = await Promise.all([r1.json(), r2.json()]);

    let differs = false;
    outer: for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (b1.tiles[y][x].t !== b2.tiles[y][x].t || b1.tiles[y][x].e !== b2.tiles[y][x].e) {
          differs = true;
          break outer;
        }
      }
    }
    expect(differs).toBe(true);
  });

  test('batch /chunks returns all requested chunks', async ({ request }) => {
    const requested = [
      { chunkX: 0, chunkY: 0 },
      { chunkX: 1, chunkY: 2 },
      { chunkX: 5, chunkY: 3 }
    ];
    const res = await request.post(`${API}/chunks`, {
      data: { chunks: requested, seed: 'batch-test' }
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.chunks).toHaveLength(3);

    for (const chunk of body.chunks) {
      expect(chunk.tiles).toHaveLength(16);
      for (const row of chunk.tiles) {
        expect(row).toHaveLength(16);
      }
    }
  });

  test('equatorial chunks have biome variety — not all arctic', async ({ request }) => {
    // Chunks near y=30 (tile y≈480-495) are near the equator in the 1000-tile reference space
    const res = await request.post(`${API}/chunks`, {
      data: {
        seed: '12345',
        chunks: Array.from({ length: 9 }, (_, i) => ({
          chunkX: Math.floor(i / 3) + 28,
          chunkY: (i % 3) + 28
        }))
      }
    });
    const body = await res.json();

    const biomes = new Set<number>();
    for (const chunk of body.chunks) {
      for (const row of chunk.tiles) {
        for (const tile of row) {
          if (tile.t === 1) biomes.add(tile.b); // only land biomes
        }
      }
    }
    // Near equator we should see warm biomes, not just arctic (4)
    const hasNonArcticBiome = [...biomes].some(b => b !== 4 && b !== 3); // not just arctic/tundra
    expect(hasNonArcticBiome).toBe(true);
  });

  test('temperature increases toward equatorial chunks', async ({ request }) => {
    // Polar chunks (y=0) should have lower temperature than equatorial chunks (y=30)
    const [polarRes, equatorRes] = await Promise.all([
      request.post(`${API}/chunk`, { data: { chunkX: 0, chunkY: 0, seed: 'temp-test' } }),
      request.post(`${API}/chunk`, { data: { chunkX: 0, chunkY: 31, seed: 'temp-test' } })
    ]);
    const [polar, equator] = await Promise.all([polarRes.json(), equatorRes.json()]);

    const avgTmp = (tiles: any[][]) => {
      const all = tiles.flat();
      return all.reduce((s: number, t: any) => s + t.tmp, 0) / all.length;
    };

    const polarTemp = avgTmp(polar.tiles);
    const equatorTemp = avgTmp(equator.tiles);

    expect(equatorTemp).toBeGreaterThan(polarTemp);
  });

  test('land-only chunks have no ocean-only biomes', async ({ request }) => {
    const res = await request.post(`${API}/chunk`, {
      data: { chunkX: 0, chunkY: 0, seed: 'biome-check' }
    });
    const body = await res.json();

    for (const row of body.tiles) {
      for (const tile of row) {
        if (tile.t === 0) {
          // ocean tile — biome should be deep_ocean(0) or shallow_ocean(1)
          expect([0, 1]).toContain(tile.b);
        }
      }
    }
  });

  test('invalid chunk coordinates return 400', async ({ request }) => {
    const res = await request.get(`${API}/chunk?chunkX=not_a_number&chunkY=0&seed=test`);
    expect(res.status()).toBe(400);
  });

  test('chunk coordinate range is validated', async ({ request }) => {
    // Coordinates outside -10000..10000 should return 400
    const res = await request.post(`${API}/chunk`, {
      data: { chunkX: 99999, chunkY: 0, seed: 'test' }
    });
    expect(res.status()).toBe(400);
  });

  test('batch /chunks returns 400 for empty chunks array', async ({ request }) => {
    const res = await request.post(`${API}/chunks`, {
      data: { chunks: [], seed: 'test' }
    });
    expect(res.status()).toBe(400);
  });

  test('batch /chunks with very large request returns partial results instead of 413', async ({ request }) => {
    // Request enough chunks to exceed the 6MB limit (~470 chunks × ~12KB each)
    const manyChunks = Array.from({ length: 600 }, (_, i) => ({
      chunkX: i % 30,
      chunkY: Math.floor(i / 30)
    }));

    const res = await request.post(`${API}/chunks`, {
      data: { chunks: manyChunks, seed: 'large-batch' }
    });

    // Should succeed (200) and return partial results rather than failing with 413
    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(body.chunks).toBeDefined();
    expect(Array.isArray(body.chunks)).toBe(true);
    // Should have generated some chunks but not all 600
    expect(body.chunks.length).toBeGreaterThan(0);
    expect(body.chunks.length).toBeLessThan(600);
    // partial flag should be set
    expect(body.partial).toBe(true);
    // total size should be within the 6MB limit
    expect(body.totalSizeBytes).toBeLessThanOrEqual(6 * 1024 * 1024);
  });

  test('batch /chunks within size limit returns all requested chunks and no partial flag', async ({ request }) => {
    const smallBatch = Array.from({ length: 5 }, (_, i) => ({
      chunkX: i,
      chunkY: 0
    }));

    const res = await request.post(`${API}/chunks`, {
      data: { chunks: smallBatch, seed: 'small-batch' }
    });

    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(body.chunks).toHaveLength(5);
    expect(body.partial).toBeFalsy();
  });

  test('lake tiles only appear on land tiles', async ({ request }) => {
    const res = await request.post(`${API}/chunks`, {
      data: {
        seed: '12345',
        chunks: Array.from({ length: 25 }, (_, i) => ({
          chunkX: Math.floor(i / 5) + 20,
          chunkY: (i % 5) + 20
        }))
      }
    });
    expect(res.status()).toBe(200);
    const body = await res.json();

    for (const chunk of body.chunks) {
      for (const row of chunk.tiles) {
        for (const tile of row) {
          if (tile.l === 1) {
            // lake tile must be land
            expect(tile.t).toBe(1);
          }
        }
      }
    }
  });
});
