import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeCatalogPayload } from '../server/domain/catalog.js';
import { checkBuildCompatibility } from '../server/domain/compatibility.js';

const snapshot = JSON.parse(readFileSync(new URL('../data/catalog-api.snapshot.json', import.meta.url), 'utf8'));
const catalog = normalizeCatalogPayload(snapshot);
const part = (id, category, name, attributes = {}, more = {}) => ({
  id: String(id), category, name, attributes, inStock: true, stockQuantity: 5, priceCents: 10000, ...more,
});

test('official catalog is deduplicated by product id while preserving stock and category counts', () => {
  assert.equal(catalog.counts.inStockCategoryListings, 750);
  assert.equal(catalog.counts.outOfStockCategoryListings, 488);
  assert.equal(catalog.counts.unique, 1236);
  assert.equal(catalog.counts.available, 749);
  assert.equal(catalog.counts.unavailable, 487);
  assert.equal(catalog.categories.length, 17);
  assert.equal(catalog.products.find((item) => item.id === '28654197').categoryKeys.length, 2);
});

test('normalizer preserves cents, source, structured attributes, and first verified CDN image', () => {
  const memory = catalog.products.find((item) => item.id === '25889828');
  assert.equal(memory.priceCents, 47058);
  assert.equal(memory.categorySlug, 'memoria-ram');
  assert.equal(memory.attributes.ramCapacity, 8);
  assert.match(memory.imageUrl, /^https:\/\/cdn\.dooca\.store\/174137\/products\//);
  assert.equal(memory.inStock, true);
});

test('normalizer rejects partial/unknown or contradictory catalogs before replacement', () => {
  assert.throws(() => normalizeCatalogPayload({ produtosComEstoque: {}, produtosSemEstoque: {} }));
  const changed = structuredClone(snapshot);
  changed.produtosComEstoque.placaMae.push({ ...changed.produtosComEstoque.placaMae[0], id: 99999999 });
  changed.produtosComEstoque.placaMae[changed.produtosComEstoque.placaMae.length - 1].price = -1;
  assert.throws(() => normalizeCatalogPayload(changed));
});

test('compatibility reports a confirmed socket conflict as FAIL', () => {
  const result = checkBuildCompatibility({
    processor: part(1, 'processador', 'AMD Ryzen 5 5600 AM4', { socket: 'AM4', hasGpu: true, tdp: 65, minimumPowerSupply: [400] }),
    motherboard: part(2, 'placaMae', 'Placa Intel LGA1700 DDR4', { socket: 'LGA1700', cpuType: 'intel', ramType: 'ddr4', maxRamCapacity: 64, ramSlotsQuantity: 4 }),
    memory: [part(3, 'memoria', '16GB DDR4', { ramCapacity: 16, modulesQuantity: 1 })],
  });
  assert.equal(result.status, 'FAIL');
  assert.equal(result.rules.find((item) => item.id === 'cpu-motherboard-socket').status, 'FAIL');
});

test('documented RAM exception admits Intel and rejects AMD; unknown physical fit stays UNKNOWN', () => {
  const exception = [{ id: 25889840, moboCompatibility: ['intel'] }];
  const ram = part(25889840, 'memoria', 'Memória Kingston 8GB DDR4', { ramCapacity: 8, modulesQuantity: 1 });
  const board = part(1, 'placaMae', 'Placa DDR4 AM4', { socket: 'AM4', cpuType: 'amd', ramType: 'ddr4', maxRamCapacity: 32, ramSlotsQuantity: 2, m2SlotsQuantity: 1 });
  const amd = checkBuildCompatibility({ processor: part(2, 'processador', 'Ryzen AM4', { socket: 'AM4', cpuType: 'amd', hasGpu: true, tdp: 65, minimumPowerSupply: [400] }), motherboard: board, memory: [ram] }, exception);
  assert.equal(amd.rules.find((item) => item.id === 'memory-capacity-and-slots').status, 'FAIL');
  const intel = checkBuildCompatibility({ processor: part(3, 'processador', 'Intel LGA1200', { socket: 'LGA1200', cpuType: 'intel', hasGpu: true, tdp: 65, minimumPowerSupply: [400] }), motherboard: part(4, 'placaMae', 'Intel DDR4', { socket: 'LGA1200', cpuType: 'intel', ramType: 'ddr4', maxRamCapacity: 32, ramSlotsQuantity: 2 }), memory: [ram] }, exception);
  assert.equal(intel.rules.find((item) => item.id === 'memory-capacity-and-slots').status, 'PASS');
  assert.ok(intel.rules.some((item) => item.id === 'motherboard-case-form-factor' && item.status === 'UNKNOWN'));
});

test('power limits, CPU without iGPU, cooler sockets, and unavailable stock fail safely', () => {
  const cpu = part(1, 'processador', 'AMD CPU AM4', { socket: 'AM4', hasGpu: false, tdp: 105, minimumPowerSupply: [500] });
  const gpu = part(2, 'placaDeVideo', 'GPU', { minimumPowerSupply: [650], maxGpuSize: 255 });
  const psu = part(3, 'fonte', 'Fonte 500W', { maxCpuTdp: 65 });
  const cooler = part(4, 'coolerParaProcessador', 'Cooler', { sockets: ['lga1700'], tdp: 80 });
  const result = checkBuildCompatibility({ processor: cpu, graphicsCard: gpu, powerSupply: psu, cooler,
    case: part(5, 'gabinete', 'Gabinete', { maxGpuSize: 200 }) });
  assert.equal(result.rules.find((item) => item.id === 'integrated-graphics').status, 'PASS');
  const missingGpu = checkBuildCompatibility({ processor: cpu });
  assert.equal(missingGpu.rules.find((item) => item.id === 'integrated-graphics').status, 'FAIL');
  assert.equal(result.rules.find((item) => item.id === 'power-supply-capacity').status, 'FAIL');
  assert.equal(result.rules.find((item) => item.id === 'cpu-cooler-socket-tdp').status, 'FAIL');
  assert.equal(result.rules.find((item) => item.id === 'gpu-case-clearance').status, 'FAIL');
  const unavailable = checkBuildCompatibility({ processor: { ...cpu, inStock: false } });
  assert.equal(unavailable.rules.find((item) => item.id === 'selected-parts-in-stock').status, 'FAIL');
});
