import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('a bundled snapshot cannot roll a newer persisted official catalog backward', async () => {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'setupninja-catalog-'));
  process.env.SETUPNINJA_DATA_DIR = dataDir;
  try {
    const { getOfficialBuildData, syncOfficialCatalog } = await import('../server/database.js');
    const bundled = JSON.parse(readFileSync(new URL('../data/catalog-api.snapshot.json', import.meta.url), 'utf8'));
    const updated = structuredClone(bundled);
    updated.lastUpdate = '2026-10-03T23:59:59.000Z';
    const product = updated.produtosComEstoque.processador[0];
    const prior = getOfficialBuildData().products.find((item) => item.id === String(product.id));
    assert.ok(prior);
    product.price = Number(product.price) + 1;
    const fresh = syncOfficialCatalog(updated, { force: true });
    assert.equal(fresh.unchanged, false);
    const changed = getOfficialBuildData().products.find((item) => item.id === String(product.id));
    assert.notEqual(changed.priceCents, prior.priceCents);
    const stale = syncOfficialCatalog(bundled, { force: true });
    assert.equal(stale.ignoredStale, true);
    assert.equal(getOfficialBuildData().products.find((item) => item.id === String(product.id)).priceCents, changed.priceCents);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
