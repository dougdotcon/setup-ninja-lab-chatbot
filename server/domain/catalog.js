export const CATEGORY_LABELS = Object.freeze({
  processador: 'Processadores', coolerParaProcessador: 'Coolers para processador',
  memoria: 'Memória RAM', placaMae: 'Placas-mãe', placaDeVideo: 'Placas de vídeo',
  armazenamento: 'Armazenamento', gabinete: 'Gabinetes', fanParaGabinete: 'Ventoinhas',
  fonte: 'Fontes de alimentação', monitor: 'Monitores', teclado: 'Teclados',
  headset: 'Headsets', mouse: 'Mouses', mousepad: 'Mousepads', kitGamer: 'Kits gamer',
  adaptadorWifi: 'Adaptadores Wi-Fi', armazenamentoExterno: 'Armazenamento externo',
});

const IMAGE_PREFIX_FALLBACK = 'https://cdn.dooca.store/174137/products/';
export const CATEGORY_SLUGS = Object.freeze({
  processador: 'processadores', coolerParaProcessador: 'coolers-para-processador', memoria: 'memoria-ram',
  placaMae: 'placas-mae', placaDeVideo: 'placas-de-video', armazenamento: 'armazenamento', gabinete: 'gabinetes',
  fanParaGabinete: 'ventoinhas', fonte: 'fontes', monitor: 'monitores', teclado: 'teclados', headset: 'headsets',
  mouse: 'mouses', mousepad: 'mousepads', kitGamer: 'kits-gamer', adaptadorWifi: 'adaptadores-wifi',
  armazenamentoExterno: 'armazenamento-externo',
});
const canonicalImage = (image, prefix) => {
  const file = Array.isArray(image) ? image.find((value) => typeof value === 'string' && value.trim()) : image;
  if (typeof file !== 'string' || !file.trim()) return null;
  if (/^https:\/\//i.test(file)) return file;
  return prefix + file.replace(/^\/+/, '');
};
const positiveInteger = (value) => Number.isFinite(Number(value)) && Number(value) > 0 ? Math.floor(Number(value)) : 0;
const priceCents = (value) => Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.round(Number(value) * 100) : null;

export function normalizeCatalogPayload(payload) {
  if (!payload || typeof payload !== 'object' || !payload.produtosComEstoque || !payload.produtosSemEstoque) {
    throw new TypeError('Formato do catálogo oficial não reconhecido.');
  }
  const prefix = payload.urls?.IMAGE_URL_PREFIX || IMAGE_PREFIX_FALLBACK;
  if (!/^https:\/\//i.test(prefix)) throw new TypeError('Prefixo de imagens inválido.');
  const categories = Object.keys({ ...payload.produtosComEstoque, ...payload.produtosSemEstoque });
  const unknown = categories.filter((key) => !CATEGORY_LABELS[key]);
  if (unknown.length) throw new TypeError('O catálogo contém departamentos ainda não mapeados: ' + unknown.join(', '));

  const byId = new Map();
  const categoryStats = new Map(categories.map((key) => [key, { stock: 0, outOfStock: 0 }]));
  for (const [groupName, inStock] of [['produtosComEstoque', true], ['produtosSemEstoque', false]]) {
    const groups = payload[groupName];
    for (const [categoryKey, items] of Object.entries(groups)) {
      if (!Array.isArray(items)) throw new TypeError(`Departamento ${categoryKey} não contém uma lista.`);
      for (const item of items) {
        if (!item || (typeof item.id !== 'string' && typeof item.id !== 'number') || !item.name || priceCents(item.price) === null) {
          throw new TypeError(`Produto inválido no departamento ${categoryKey}.`);
        }
        const id = String(item.id);
        const prior = byId.get(id);
        if (prior && prior.inStock !== inStock) throw new TypeError(`Estoque contraditório para o produto ${id}.`);
        categoryStats.get(categoryKey)[inStock ? 'stock' : 'outOfStock'] += 1;
        const normalized = prior || {
          id, name: String(item.name).trim(), brand: String(item.brand || item.name.split(/\s+/).slice(0, 2).join(' ')).slice(0, 100),
          sku: item.sku == null ? null : String(item.sku), priceCents: priceCents(item.price),
          imageUrl: canonicalImage(item.image, prefix), productUrl: item.url ? `https://www.setupninja.com.br/${String(item.url).replace(/^\/+/, '')}` : null,
          sourceUrl: 'https://monte-seu-pc.setupninja.com.br/produtos', categoryKeys: [], categorySlug: CATEGORY_SLUGS[categoryKey],
          inStock, stockQuantity: inStock ? positiveInteger(item.stock) : 0,
          attributes: { ...item, id, stock: inStock ? positiveInteger(item.stock) : 0 },
          tags: Array.isArray(item.tags) ? [...new Set(item.tags.filter((tag) => typeof tag === 'string').map((tag) => tag.slice(0, 180)))].slice(0, 80) : [],
        };
        if (prior && (prior.priceCents !== priceCents(item.price) || prior.name !== String(item.name).trim())) {
          throw new TypeError(`Dados contraditórios para o produto duplicado ${id}.`);
        }
        if (!normalized.categoryKeys.includes(categoryKey)) normalized.categoryKeys.push(categoryKey);
        byId.set(id, normalized);
      }
    }
  }
  const products = [...byId.values()];
  if (products.length < 100) throw new TypeError('A resposta oficial está vazia ou incompleta; catálogo preservado.');
  const categoriesNormalized = categories.map((key) => ({
    id: CATEGORY_SLUGS[key], slug: CATEGORY_SLUGS[key], key, name: CATEGORY_LABELS[key], sourceUrl: 'https://monte-seu-pc.setupninja.com.br/produtos',
    listedInStock: categoryStats.get(key).stock, listedOutOfStock: categoryStats.get(key).outOfStock,
  }));
  return {
    products, categories: categoriesNormalized, exceptions: Array.isArray(payload.excecoes) ? payload.excecoes : [],
    lastUpdate: String(payload.lastUpdate || ''), source: 'official-monte-seu-pc',
    counts: { unique: products.length, available: products.filter((product) => product.inStock).length,
      unavailable: products.filter((product) => !product.inStock).length,
      inStockCategoryListings: Object.values(payload.produtosComEstoque).reduce((sum, rows) => sum + rows.length, 0),
      outOfStockCategoryListings: Object.values(payload.produtosSemEstoque).reduce((sum, rows) => sum + rows.length, 0) },
  };
}
