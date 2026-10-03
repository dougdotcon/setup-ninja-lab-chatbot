import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { CATEGORY_LABELS, CATEGORY_SLUGS, normalizeCatalogPayload } from './domain/catalog.js';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const databaseDir = path.resolve(process.env.SETUPNINJA_DATA_DIR || path.join(projectRoot, 'data'));
mkdirSync(databaseDir, { recursive: true, mode: 0o750 });
export const databasePath = path.join(databaseDir, 'setupninja.sqlite');
const database = new DatabaseSync(databasePath);
database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

database.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE,
    parent_id TEXT REFERENCES categories(id), product_count INTEGER NOT NULL DEFAULT 0, source_url TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, brand TEXT NOT NULL DEFAULT 'Setup Ninja',
    sku TEXT, price_brl REAL, list_price_brl REAL, installment_price_brl REAL,
    installments INTEGER, description TEXT NOT NULL DEFAULT '', image_url TEXT,
    product_url TEXT NOT NULL, source_url TEXT NOT NULL,
    availability TEXT NOT NULL DEFAULT 'Consultar na loja', scraped_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS product_categories (
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, category_id)
  );
  CREATE TABLE IF NOT EXISTS product_specs (
    id INTEGER PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    spec_key TEXT NOT NULL, spec_value TEXT NOT NULL, source_url TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id INTEGER PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL,
    category TEXT NOT NULL, source_title TEXT NOT NULL, source_url TEXT NOT NULL,
    product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
    scraped_at TEXT NOT NULL
  );
  CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
    title, content, category, source_title, content='knowledge_chunks', content_rowid='id',
    tokenize='unicode61 remove_diacritics 2'
  );
  CREATE TRIGGER IF NOT EXISTS knowledge_ai AFTER INSERT ON knowledge_chunks BEGIN
    INSERT INTO knowledge_fts(rowid, title, content, category, source_title)
    VALUES (new.id, new.title, new.content, new.category, new.source_title);
  END;
  CREATE TRIGGER IF NOT EXISTS knowledge_ad AFTER DELETE ON knowledge_chunks BEGIN
    INSERT INTO knowledge_fts(knowledge_fts, rowid, title, content, category, source_title)
    VALUES ('delete', old.id, old.title, old.content, old.category, old.source_title);
  END;
  CREATE TABLE IF NOT EXISTS scrape_runs (
    id INTEGER PRIMARY KEY, started_at TEXT NOT NULL, finished_at TEXT NOT NULL,
    source_url TEXT NOT NULL, product_count INTEGER NOT NULL, categories_found INTEGER NOT NULL,
    status TEXT NOT NULL, extraction_note TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY, created_at TEXT NOT NULL, last_active_at TEXT NOT NULL,
    expires_at TEXT NOT NULL, message_count INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY, session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS rag_runs (
    id INTEGER PRIMARY KEY, session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL, query TEXT NOT NULL, retrieved_count INTEGER NOT NULL,
    sources_json TEXT NOT NULL, model_name TEXT NOT NULL, mode TEXT NOT NULL,
    duration_ms INTEGER NOT NULL, input_tokens INTEGER, output_tokens INTEGER, outcome TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_products_category ON product_categories(category_id, product_id);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_rag_runs_session ON rag_runs(session_id, created_at DESC);
`);

function ensureColumn(table, column, definition) {
  const present = database.prepare(`PRAGMA table_info("${table}")`).all().some((item) => item.name === column);
  if (!present) database.exec(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
}
for (const [column, definition] of Object.entries({
  price_cents: 'INTEGER', stock_quantity: 'INTEGER NOT NULL DEFAULT 0', in_stock: 'INTEGER NOT NULL DEFAULT 1',
  category_key: 'TEXT', category_name: 'TEXT', attributes_json: "TEXT NOT NULL DEFAULT '{}'",
  tags_json: "TEXT NOT NULL DEFAULT '[]'", source_kind: "TEXT NOT NULL DEFAULT 'demo'",
})) ensureColumn('products', column, definition);
for (const [column, definition] of Object.entries({
  available_count: 'INTEGER NOT NULL DEFAULT 0', out_of_stock_count: 'INTEGER NOT NULL DEFAULT 0',
  source_kind: "TEXT NOT NULL DEFAULT 'demo'",
})) ensureColumn('categories', column, definition);
database.exec(`
  CREATE TABLE IF NOT EXISTS catalog_sync_runs (
    id INTEGER PRIMARY KEY, source TEXT NOT NULL, last_update TEXT NOT NULL, synced_at TEXT NOT NULL,
    products INTEGER NOT NULL, available INTEGER NOT NULL, unavailable INTEGER NOT NULL, status TEXT NOT NULL,
    in_stock_listings INTEGER NOT NULL DEFAULT 0, out_of_stock_listings INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS catalog_compatibility_exceptions (
    product_id TEXT PRIMARY KEY, motherboard_compatibility_json TEXT NOT NULL, source_last_update TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pc_builds (
    id TEXT PRIMARY KEY, session_id TEXT NOT NULL, created_at TEXT NOT NULL, total_price_cents INTEGER NOT NULL,
    budget_cents INTEGER, purpose TEXT NOT NULL, requirements_json TEXT NOT NULL, parts_json TEXT NOT NULL,
    compatibility_json TEXT NOT NULL, decision_provider TEXT NOT NULL, decision_model TEXT NOT NULL,
    decision_confidence REAL, decision_fallback INTEGER NOT NULL, generation_provider TEXT NOT NULL,
    generation_model TEXT NOT NULL, explanation TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pc_build_parts (
    build_id TEXT NOT NULL REFERENCES pc_builds(id) ON DELETE CASCADE, product_id TEXT NOT NULL,
    category_key TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price_cents INTEGER NOT NULL,
    PRIMARY KEY(build_id, product_id)
  );
  CREATE INDEX IF NOT EXISTS idx_pc_builds_session ON pc_builds(session_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_products_availability_category ON products(in_stock, category_key, price_cents);
`);
ensureColumn('catalog_sync_runs', 'in_stock_listings', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('catalog_sync_runs', 'out_of_stock_listings', 'INTEGER NOT NULL DEFAULT 0');

const catalogSnapshotPath = path.join(projectRoot, 'data/catalog-api.snapshot.json');
const catalogRun = database.prepare(`INSERT INTO catalog_sync_runs
  (source, last_update, synced_at, products, available, unavailable, status, in_stock_listings, out_of_stock_listings)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
export function syncOfficialCatalog(payload, { force = false } = {}) {
  const normalized = normalizeCatalogPayload(payload);
  const previous = database.prepare('SELECT last_update FROM catalog_sync_runs WHERE source = ? ORDER BY id DESC LIMIT 1').get(normalized.source);
  const existingOfficial = Number(database.prepare("SELECT COUNT(*) AS count FROM products WHERE source_kind = 'official-monte-seu-pc'").get().count);
  const legacyProducts = Number(database.prepare("SELECT COUNT(*) AS count FROM products WHERE source_kind <> 'official-monte-seu-pc'").get().count);
  if (!force && previous?.last_update === normalized.lastUpdate && existingOfficial === normalized.products.length && legacyProducts === 0) {
    return { ...normalized.counts, lastUpdate: normalized.lastUpdate, unchanged: true };
  }
  const now = new Date().toISOString();
  const insertCategory = database.prepare(`INSERT INTO categories
    (id, name, slug, parent_id, product_count, source_url, available_count, out_of_stock_count, source_kind)
    VALUES (?, ?, ?, NULL, 0, ?, 0, 0, 'official-monte-seu-pc')
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, slug=excluded.slug, source_url=excluded.source_url, source_kind='official-monte-seu-pc'`);
  const insertProduct = database.prepare(`INSERT INTO products
    (id, name, brand, sku, price_brl, list_price_brl, installment_price_brl, installments, description, image_url,
      product_url, source_url, availability, scraped_at, price_cents, stock_quantity, in_stock, category_key,
      category_name, attributes_json, tags_json, source_kind)
    VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'official-monte-seu-pc')`);
  const insertLink = database.prepare('INSERT INTO product_categories (product_id, category_id) VALUES (?, ?)');
  const insertSpec = database.prepare('INSERT INTO product_specs (product_id, spec_key, spec_value, source_url) VALUES (?, ?, ?, ?)');
  const insertChunk = database.prepare(`INSERT INTO knowledge_chunks
    (title, content, category, source_title, source_url, product_id, scraped_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare("DELETE FROM knowledge_chunks WHERE product_id IN (SELECT id FROM products WHERE source_kind <> 'official-monte-seu-pc')").run();
    database.prepare("DELETE FROM products WHERE source_kind <> 'official-monte-seu-pc'").run();
    database.prepare("DELETE FROM product_categories WHERE category_id IN (SELECT id FROM categories WHERE source_kind <> 'official-monte-seu-pc')").run();
    database.prepare("UPDATE categories SET parent_id=NULL WHERE parent_id IN (SELECT id FROM categories WHERE source_kind <> 'official-monte-seu-pc')").run();
    database.prepare("UPDATE categories SET parent_id=NULL WHERE source_kind <> 'official-monte-seu-pc'").run();
    database.prepare("DELETE FROM categories WHERE source_kind <> 'official-monte-seu-pc'").run();
    database.prepare("DELETE FROM scrape_runs WHERE status <> 'oficial'").run();
    database.prepare("DELETE FROM knowledge_chunks WHERE product_id IN (SELECT id FROM products WHERE source_kind = 'official-monte-seu-pc')").run();
    database.prepare("DELETE FROM products WHERE source_kind = 'official-monte-seu-pc'").run();
    database.prepare("DELETE FROM categories WHERE source_kind = 'official-monte-seu-pc' AND id NOT IN (" + normalized.categories.map(() => '?').join(',') + ')').run(...normalized.categories.map((item) => item.id));
    database.prepare("DELETE FROM catalog_compatibility_exceptions WHERE 1=1").run();
    for (const category of normalized.categories) insertCategory.run(category.id, category.name, category.slug, category.sourceUrl);
    for (const product of normalized.products) {
      const categoryName = product.categoryKeys.map((key) => CATEGORY_LABELS[key]).join(' · ');
      const attributes = JSON.stringify(product.attributes);
      const tags = JSON.stringify(product.tags);
      const description = [product.name, product.sku && `SKU ${product.sku}`, categoryName,
        `Preço do catálogo: R$ ${(product.priceCents / 100).toFixed(2)}`,
        product.inStock ? `Estoque informado: ${product.stockQuantity}` : 'Sem estoque no snapshot consultado',
        ...product.tags.slice(0, 16)].filter(Boolean).join('. ');
      insertProduct.run(product.id, product.name, product.brand, product.sku, product.priceCents / 100,
        description, product.imageUrl, product.productUrl || product.sourceUrl, product.sourceUrl,
        product.inStock ? `Em estoque (${product.stockQuantity})` : 'Sem estoque no snapshot', now,
        product.priceCents, product.stockQuantity, product.inStock ? 1 : 0,
        product.categoryKeys[0], categoryName, attributes, tags);
      for (const categoryId of new Set(product.categoryKeys.map((key) => normalized.categories.find((category) => category.key === key)?.id).filter(Boolean))) {
        insertLink.run(product.id, categoryId);
      }
      for (const [key, value] of Object.entries(product.attributes)) {
        if (['id', 'name', 'image', 'tags', 'stock'].includes(key) || value == null) continue;
        insertSpec.run(product.id, key, Array.isArray(value) || typeof value === 'object' ? JSON.stringify(value) : String(value), product.productUrl || product.sourceUrl);
      }
      insertChunk.run(product.name, description, categoryName, 'Catálogo oficial — ' + categoryName,
        product.productUrl || product.sourceUrl, product.id, now);
    }
    for (const exception of normalized.exceptions) {
      if (!exception || exception.id == null || !Array.isArray(exception.moboCompatibility)) continue;
      database.prepare(`INSERT INTO catalog_compatibility_exceptions
        (product_id, motherboard_compatibility_json, source_last_update) VALUES (?, ?, ?)`)
        .run(String(exception.id), JSON.stringify(exception.moboCompatibility), normalized.lastUpdate);
    }
    database.prepare(`UPDATE categories SET product_count = (
      SELECT COUNT(DISTINCT pc.product_id) FROM product_categories pc WHERE pc.category_id = categories.id
    ), available_count = (
      SELECT COUNT(DISTINCT pc.product_id) FROM product_categories pc JOIN products p ON p.id=pc.product_id
      WHERE pc.category_id = categories.id AND p.in_stock=1
    ), out_of_stock_count = (
      SELECT COUNT(DISTINCT pc.product_id) FROM product_categories pc JOIN products p ON p.id=pc.product_id
      WHERE pc.category_id = categories.id AND p.in_stock=0
    )`).run();
    catalogRun.run(normalized.source, normalized.lastUpdate, now, normalized.products.length,
      normalized.counts.available, normalized.counts.unavailable, 'ok', normalized.counts.inStockCategoryListings,
      normalized.counts.outOfStockCategoryListings);
    database.prepare(`INSERT INTO scrape_runs (started_at, finished_at, source_url, product_count, categories_found, status, extraction_note)
      VALUES (?, ?, ?, ?, ?, 'oficial', ?)`).run(now, now, normalized.source, normalized.products.length, normalized.categories.length,
      `API oficial: ${normalized.counts.available} em estoque, ${normalized.counts.unavailable} indisponíveis; duplicatas consolidadas por ID.`);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return { ...normalized.counts, lastUpdate: normalized.lastUpdate, unchanged: false };
}

const bundledCatalog = JSON.parse(readFileSync(catalogSnapshotPath, 'utf8'));
syncOfficialCatalog(bundledCatalog);

// Operador público pode inspecionar somente catálogo/coleta; históricos são isolados por sessão.
export const allowedTables = [
  'categories', 'products', 'product_categories', 'product_specs',
  'knowledge_chunks', 'knowledge_fts', 'scrape_runs'
];
export const getTableInfo = database.prepare(
  'SELECT sql FROM sqlite_master WHERE name = ? AND type IN (\'table\',\'view\')'
);
export function listTables() {
  return allowedTables.map((name) => {
    const schema = getTableInfo.get(name)?.sql || '';
    const { count } = database.prepare(`SELECT COUNT(*) AS count FROM "${name}"`).get();
    return { name, rows: Number(count), columns: database.prepare(`PRAGMA table_info("${name}")`).all(), schema };
  });
}

export function readTable(name, limit = 50, offset = 0) {
  if (!allowedTables.includes(name)) throw new Error('Tabela indisponível.');
  const total = Number(database.prepare(`SELECT COUNT(*) AS total FROM "${name}"`).get().total);
  const rows = database.prepare(`SELECT * FROM "${name}" LIMIT ? OFFSET ?`).all(limit, offset);
  return { name, rows, total, limit, offset };
}

const getSession = database.prepare('SELECT id FROM chat_sessions WHERE id = ? AND expires_at > ?');
const insertSession = database.prepare(
  'INSERT INTO chat_sessions (id, created_at, last_active_at, expires_at) VALUES (?, ?, ?, ?)'
);
const touchSession = database.prepare(
  'UPDATE chat_sessions SET last_active_at = ?, expires_at = ?, message_count = message_count + 1 WHERE id = ?'
);
const insertMessage = database.prepare(
  'INSERT INTO chat_messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)'
);
const insertRagRun = database.prepare(`INSERT INTO rag_runs
  (session_id, created_at, query, retrieved_count, sources_json, model_name, mode, duration_ms,
   input_tokens, output_tokens, outcome)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const searchSql = database.prepare(`SELECT k.id, k.title, k.content, k.category,
    k.source_title, k.source_url, k.product_id,
    bm25(knowledge_fts, 8.0, 5.0, 2.0, 1.2) AS rank,
    p.price_brl
  FROM knowledge_fts JOIN knowledge_chunks k ON k.id = knowledge_fts.rowid
  LEFT JOIN products p ON p.id = k.product_id
  WHERE knowledge_fts MATCH ? AND (p.id IS NULL OR p.in_stock = 1)
  ORDER BY rank ASC LIMIT ?`);

const synonyms = new Map([
  ['pc', 'computador'], ['computador', 'pc'], ['gpu', 'grafica'], ['vga', 'grafica'],
  ['placa', 'grafica'], ['processador', 'ryzen'], ['cpu', 'ryzen'], ['ram', 'memoria'],
  ['ssd', 'armazenamento'], ['hd', 'armazenamento'], ['tela', 'monitor'],
  ['display', 'monitor'], ['fone', 'headset'], ['foneouvido', 'headset'],
  ['mouse', 'mouse'], ['teclado', 'teclado'], ['preco', 'pix'], ['valor', 'pix'],
  ['barato', 'menor'], ['fones', 'headset'], ['periferico', 'perifericos'],
  ['memoria', 'ram'], ['sata', 'ssd'], ['nvme', 'ssd'], ['placadevideo', 'gpu'],
]);
const ignoreTerms = new Set([
  'com', 'uma', 'uns', 'das', 'dos', 'para', 'pelo', 'pela', 'qual', 'quais',
  'mais', 'menos', 'sobre', 'esse', 'essa', 'tem', 'uma', 'que', 'aqui', 'loja',
  'melhor', 'melhores', 'bom', 'boa', 'quero', 'queria', 'gostaria', 'setup',
  'ninja', 'quanto', 'onde', 'perto', 'meu', 'minha', 'qual', 'preciso', 'pode',
  'entre', 'ate', 'R$', 'pix', 'sem', 'juros', 'do', 'da', 'de', 'e', 'ou', 'em',
]);
function tokenToSearch(term) {
  if (ignoreTerms.has(term) || term.length < 2) return [];
  const expanded = new Set([term]);
  const synonym = synonyms.get(term);
  if (synonym) expanded.add(synonym);
  if (term === 'grafica') for (const variant of ['geforce', 'radeon', 'rtx']) expanded.add(variant);
  if (term === 'monitor') expanded.add('polegadas');
  return [...expanded].map((item) => `"${item.replaceAll('"', '""')}"*`);
}
export function searchCatalog(query, topK = 6, filterQuery = query, categoryContext = filterQuery) {
  const normalized = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const original = normalized.match(/[a-z0-9]+/g) || [];
  const terms = [...new Set(original.flatMap(tokenToSearch))];
  if (terms.length === 0) return [];
  let documents = [];
  try { documents = searchSql.all(terms.join(' OR '), 80); }
  catch { return []; }

  const budgetText = filterQuery.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const budgetMatch = budgetText.match(/(?:ate|maximo|orcamento|budget)\s*(?:de)?\s*(?:r\$)?\s*([0-9.]+(?:,[0-9]{1,2})?|[0-9]{3,6})(?:\s*mil)?/);
  const fallbackBudget = budgetText.match(/(?:r\$\s?)([0-9.]+(?:,[0-9]{1,2})?)(?:\s*mil)?/);
  const budgetIsMil = /(?:ate|maximo|orcamento|budget|r\$)[^0-9]{0,20}[0-9.]+\s*mil/.test(budgetText);
  const budget = Number((budgetMatch?.[1] || fallbackBudget?.[1] || '').replaceAll('.', '').replace(',', '.')) * (budgetIsMil ? 1000 : 1);
  const detectCategory = (text) => {
    const q = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (/\b(pc|computador|computadores|desktop)\b/.test(q)) return 'pc gamer';
    if (/\b(headset|headsets|fone|fones)\b/.test(q)) return 'headset';
    if (/\b(teclado|teclados)\b/.test(q)) return 'teclado';
    if (/\b(mouse|mouses)\b/.test(q)) return 'mouse';
    if (/\b(caixa|caixas|soundbar|som)\b/.test(q)) return 'caixa de som';
    return null;
  };
  const categoryFilter = detectCategory(filterQuery) || detectCategory(categoryContext);
  if (categoryFilter === 'pc gamer') documents = documents.filter((doc) => doc.category.toLowerCase().startsWith('pc gamer'));
  else if (categoryFilter) documents = documents.filter((doc) => doc.category.toLowerCase().includes(categoryFilter));
  if (budget > 0) documents = documents.filter((doc) => Number.isFinite(doc.price_brl) && doc.price_brl <= budget);
  const boundedK = Math.min(Math.max(topK, 1), 12);
  return documents.sort((a, b) => a.rank - b.rank).slice(0, boundedK);
}

export function recordInteraction({ sessionId, query, answer, sources = [], model = 'demo-local',
  mode = 'demo', durationMs = 0, inputTokens = null, outputTokens = null, outcome = 'respondido' }) {
  const timestamp = new Date();
  const now = timestamp.toISOString();
  const expiry = new Date(timestamp.getTime() + 24 * 60 * 60 * 1000).toISOString();
  if (!getSession.get(sessionId, now)) insertSession.run(sessionId, now, now, expiry);
  else touchSession.run(now, expiry, sessionId);
  const scrub = (value) => String(value || '').slice(0, 2400)
    .replace(/(?:sk-(?:proj-)?[A-Za-z0-9_-]{12,}|sk-ant-[A-Za-z0-9_-]{12,})/g, '[credencial removida]')
    .replace(/bearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, 'Bearer [credencial removida]');
  insertMessage.run(sessionId, 'user', scrub(query), now);
  insertMessage.run(sessionId, 'assistant', scrub(answer), now);
  const total = Number(database.prepare('SELECT message_count FROM chat_sessions WHERE id = ?').get(sessionId).message_count);
  const loggedSources = sources.map(({ id, productId, title, url, category, rank }) => ({
    id, productId, title: scrub(title), url, category: scrub(category), score: Math.round((Number(rank) || 0) * 10000) / 10000,
  }));
  insertRagRun.run(sessionId, now, scrub(query), loggedSources.length,
    JSON.stringify(loggedSources), scrub(model), mode, Math.max(0, Math.round(durationMs)),
    inputTokens, outputTokens, outcome);
}

export function getSessionRuns(sessionId, limit = 30) {
  return database.prepare(`SELECT id, created_at, query, retrieved_count, sources_json,
      model_name, mode, duration_ms, input_tokens, output_tokens, outcome
    FROM rag_runs WHERE session_id = ? ORDER BY id DESC LIMIT ?`).all(sessionId, limit)
    .map((run) => ({ ...run, sources: JSON.parse(run.sources_json), sources_json: undefined }));
}

export function getSessionMessages(sessionId) {
  return database.prepare(`SELECT id, role, content, created_at
    FROM chat_messages WHERE session_id = ? ORDER BY id ASC`).all(sessionId);
}

export function clearSession(sessionId) {
  database.prepare('DELETE FROM rag_runs WHERE session_id = ?').run(sessionId);
  database.prepare('DELETE FROM chat_messages WHERE session_id = ?').run(sessionId);
  database.prepare('DELETE FROM chat_sessions WHERE id = ?').run(sessionId);
}

export function getCatalog(filters = {}) {
  const conditions = [];
  const values = [];
  conditions.push("p.in_stock = 1 AND p.source_kind = 'official-monte-seu-pc'");
  if (filters.category && filters.category !== 'todos') {
    conditions.push('(c.slug = ? OR c.name = ?)');
    values.push(filters.category, filters.category);
  }
  if (filters.query) {
    conditions.push('(p.name LIKE ? OR p.brand LIKE ? OR p.description LIKE ?)');
    const value = `%${filters.query.slice(0, 100)}%`;
    values.push(value, value, value);
  }
  const search = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const order = filters.sort === 'price-asc' ? 'ORDER BY p.price_brl IS NULL, p.price_brl ASC'
    : filters.sort === 'price-desc' ? 'ORDER BY p.price_brl IS NULL, p.price_brl DESC'
      : 'ORDER BY p.price_brl IS NULL, p.price_brl ASC, p.name COLLATE NOCASE';
  const limit = Math.min(Math.max(Number.parseInt(filters.limit || '60', 10) || 60, 1), 120);
  const rows = database.prepare(`SELECT p.*, MIN(c.name) AS category
    FROM products p JOIN product_categories pc ON pc.product_id = p.id
    JOIN categories c ON c.id = pc.category_id
    ${search} GROUP BY p.id ${order} LIMIT ?`).all(...values, limit);
  const count = database.prepare(`SELECT COUNT(DISTINCT p.id) AS total
    FROM products p JOIN product_categories pc ON pc.product_id = p.id
    JOIN categories c ON c.id = pc.category_id ${search}`).get(...values);
  return { rows, total: Number(count.total), categories: getCategories() };
}

export function getOfficialBuildData() {
  const productRows = database.prepare(`SELECT p.*, c.slug AS category_slug FROM products p
    JOIN product_categories pc ON pc.product_id=p.id JOIN categories c ON c.id=pc.category_id
    WHERE p.source_kind='official-monte-seu-pc' AND p.in_stock=1`).all();
  const byId = new Map();
  const keyForSlug = Object.fromEntries(Object.entries(CATEGORY_SLUGS).map(([key, slug]) => [slug, key]));
  for (const row of productRows) {
    const product = byId.get(row.id) || { id: row.id, name: row.name, brand: row.brand, sku: row.sku,
      priceCents: row.price_cents, imageUrl: row.image_url, productUrl: row.product_url, sourceUrl: row.source_url,
      inStock: Boolean(row.in_stock), stockQuantity: row.stock_quantity, attributes: JSON.parse(row.attributes_json || '{}'),
      tags: JSON.parse(row.tags_json || '[]'), categoryKeys: [] };
    const key = keyForSlug[row.category_slug];
    if (key && !product.categoryKeys.includes(key)) product.categoryKeys.push(key);
    byId.set(row.id, product);
  }
  const exceptions = database.prepare('SELECT product_id, motherboard_compatibility_json FROM catalog_compatibility_exceptions').all()
    .map((row) => ({ id: row.product_id, moboCompatibility: JSON.parse(row.motherboard_compatibility_json) }));
  return { products: [...byId.values()], exceptions };
}

export function saveBuild({ id, sessionId, candidate, budgetCents, purpose, requirements, decision, generation, explanation }) {
  const createdAt = new Date().toISOString();
  const insert = database.prepare(`INSERT INTO pc_builds
    (id, session_id, created_at, total_price_cents, budget_cents, purpose, requirements_json, parts_json,
     compatibility_json, decision_provider, decision_model, decision_confidence, decision_fallback,
     generation_provider, generation_model, explanation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertPart = database.prepare(`INSERT INTO pc_build_parts (build_id, product_id, category_key, quantity, unit_price_cents)
    VALUES (?, ?, ?, ?, ?)`);
  database.exec('BEGIN IMMEDIATE');
  try {
    insert.run(id, sessionId, createdAt, candidate.totalPriceCents, budgetCents ?? null, purpose,
      JSON.stringify(requirements), JSON.stringify(candidate.parts), JSON.stringify(candidate.compatibility),
      decision.provider, decision.model, decision.confidence ?? null, decision.fallback ? 1 : 0,
      generation.provider, generation.model, explanation);
    for (const value of Object.values(candidate.parts)) for (const part of Array.isArray(value) ? value : value ? [value] : []) {
      insertPart.run(id, String(part.id), part.categoryKeys?.[0] || part.category, Number(part.quantity || 1), Number(part.priceCents));
    }
    database.exec('COMMIT');
  } catch (error) { database.exec('ROLLBACK'); throw error; }
  return { id, createdAt };
}

export function getSessionBuilds(sessionId, limit = 30) {
  return database.prepare(`SELECT id, created_at, total_price_cents, budget_cents, purpose,
    requirements_json, parts_json, compatibility_json, decision_provider, decision_model,
    decision_confidence, decision_fallback, generation_provider, generation_model, explanation
    FROM pc_builds WHERE session_id=? ORDER BY created_at DESC LIMIT ?`).all(sessionId, limit).map((row) => ({
      ...row, requirements: JSON.parse(row.requirements_json), parts: JSON.parse(row.parts_json),
      compatibility: JSON.parse(row.compatibility_json), requirements_json: undefined, parts_json: undefined,
      compatibility_json: undefined, decision_fallback: Boolean(row.decision_fallback),
    }));
}

export function getCategories() {
  return database.prepare("SELECT id, name, slug, parent_id, product_count AS count, available_count AS availableCount, out_of_stock_count AS outOfStockCount FROM categories WHERE source_kind='official-monte-seu-pc' ORDER BY name").all();
}

export function getDatabaseStats() {
  const latestOfficialSync = database.prepare("SELECT last_update, synced_at, products, available, unavailable, in_stock_listings AS inStockListings, out_of_stock_listings AS outOfStockListings FROM catalog_sync_runs WHERE source='official-monte-seu-pc' ORDER BY id DESC LIMIT 1").get() || null;
  return {
    products: Number(database.prepare("SELECT COUNT(*) AS total FROM products WHERE source_kind='official-monte-seu-pc'").get().total),
    availableProducts: Number(database.prepare("SELECT COUNT(*) AS total FROM products WHERE source_kind='official-monte-seu-pc' AND in_stock=1").get().total),
    unavailableProducts: Number(database.prepare("SELECT COUNT(*) AS total FROM products WHERE source_kind='official-monte-seu-pc' AND in_stock=0").get().total),
    latestOfficialSync,
    categories: getCategories(),
    chunks: Number(database.prepare('SELECT COUNT(*) AS total FROM knowledge_chunks').get().total),
    databaseFile: 'data/setupninja.sqlite',
    collectionDate: latestOfficialSync?.synced_at?.slice(0, 10) || latestOfficialSync?.last_update?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    method: 'SQLite FTS5 · BM25 · remove_diacritics 2',
  };
}

export function purgeExpiredSessions() {
  database.prepare('DELETE FROM chat_sessions WHERE expires_at <= ?').run(new Date().toISOString());
}
