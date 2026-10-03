import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeCatalogPayload } from '../server/domain/catalog.js';

const root = fileURLToPath(new URL('..', import.meta.url));

test('official hardware guides survive catalog synchronization and remain searchable', async () => {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'setupninja-guides-'));
  process.env.SETUPNINJA_DATA_DIR = dataDir;
  try {
    const database = await import('../server/database.js');
    const snapshot = JSON.parse(readFileSync(path.join(root, 'data/catalog-api.snapshot.json'), 'utf8'));
    const officialProducts = new Map(normalizeCatalogPayload(snapshot).products.map((product) => [product.id, product]));
    const initialGuide = database.searchCatalog('memoria RAM instalar desktop', 12).find((row) => row.guide_id === 'desktop-memory-install');
    assert.ok(initialGuide);
    assert.match(initialGuide.source_url, /kingston\.com/);
    const productSearch = database.searchCatalog('Qual SSD de 1 TB para meu PC vocês têm?', 8);
    assert.ok(productSearch.length > 0);
    assert.ok(productSearch.every((row) => row.guide_id === null), 'busca de produto não deve misturar guias sem intenção instrucional');
    assert.ok(productSearch.every((row) => officialProducts.get(row.product_id)?.inStock),
      'quando SSD e PC aparecem juntos, a categoria explícita de SSD deve filtrar somente produtos oficiais em estoque');
    const underBudget = database.searchCatalog('SSD armazenamento', 8, 'até R$ 500', 'armazenamento');
    assert.ok(underBudget.length > 0);
    assert.ok(underBudget.every((row) => row.product_id !== null && Number(row.price_brl) <= 500));
    const biosGuide = database.searchCatalog('BIOS processador suporte', 8).find((row) => row.guide_id === 'bios-cpu-support');
    assert.ok(biosGuide, 'FTS5 deve indexar conteúdo do guia técnico');
    const guidesBefore = database.listTables().find((table) => table.name === 'knowledge_chunks').rows;
    database.syncOfficialCatalog(snapshot, { force: true });
    const retrievable = database.searchCatalog('memoria RAM instalar desktop', 12).find((row) => row.guide_id === 'desktop-memory-install');
    assert.ok(retrievable, 'o sync do catálogo não deve remover guias sem product_id');
    assert.equal(database.listTables().find((table) => table.name === 'knowledge_chunks').rows, guidesBefore);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
