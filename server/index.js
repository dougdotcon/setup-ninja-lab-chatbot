import express from 'express';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  getCatalog, getDatabaseStats, getSessionMessages, getSessionRuns,
  listTables, purgeExpiredSessions, readTable, recordInteraction, searchCatalog,
  clearSession, databasePath, getOfficialBuildData, saveBuild, getSessionBuilds, syncOfficialCatalog,
} from './database.js';
import { buildCandidates, validateCandidateChoice } from './domain/build.js';
import { cpuVendor } from './domain/compatibility.js';
import { CATEGORY_LABELS } from './domain/catalog.js';
import { interpretRequest, normalizeRequest } from '../shared/request.js';
import { defaultModelClient } from './infrastructure/model-client.js';
import { createOfficialCatalogClient } from './infrastructure/official-catalog-client.js';
import { defaultTypesafeJev } from './infrastructure/typesafe-jev.js';
import {
  allowedBuildReasons, buildReasonSchema, chatPlanSchema, createChatPlanMessages, createInterpretationMessages, INTERPRETATION_SCHEMA, isAllowedContextualFollowup, isGreeting,
  isHardwareScope, isPromptInjection, renderBuildExplanation, renderChatFallback,
  renderChatPlan, validateBuildPlan, validateChatPlan, validateInterpretation,
} from './application/assistant-policy.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const app = express();
const modelClient = defaultModelClient;
const catalogClient = createOfficialCatalogClient({ verifyHttps: modelClient.verifyHttps });
const port = Number(process.env.PORT || 4174);
const host = process.env.HOST || '127.0.0.1';
const sessionKeyPath = path.join(process.env.SETUPNINJA_DATA_DIR || path.join(root, 'data'), 'session-signing.key');
mkdirSync(path.dirname(sessionKeyPath), { recursive: true, mode: 0o750 });
if (!existsSync(sessionKeyPath)) {
  try { writeFileSync(sessionKeyPath, randomBytes(32), { flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
}
const hmacKey = readFileSync(sessionKeyPath);
if (hmacKey.length !== 32) throw new Error('Invalid session signing key');
chmodSync(sessionKeyPath, 0o600);
const llmSessions = new Map();
const decisionSessions = new Map();
const rates = new Map();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(express.json({ limit: '32kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https://cdn.dooca.store data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  next();
});
function originGuard(req, res, next) {
  const origin = req.get('origin');
  if (origin) {
    try { if (new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'Origem não permitida.' }); }
    catch { return res.status(403).json({ error: 'Origem não permitida.' }); }
  }
  next();
}
function signature(id) { return createHmac('sha256', hmacKey).update(id).digest('hex'); }
function readSessionId(req) {
  const value = req.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith('sn_session='))?.slice(11);
  if (!value || value.length > 120) return null;
  const [id, actual] = value.split('.');
  if (!id || !actual) return null;
  const a = Buffer.from(actual, 'hex');
  const b = Buffer.from(signature(id), 'hex');
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}
function useSession(req, res, next) {
  let id = readSessionId(req);
  if (!id) {
    id = randomBytes(24).toString('base64url');
    res.cookie('sn_session', id + '.' + signature(id), {
      httpOnly: true, secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax', maxAge: 86_400_000, path: '/',
    });
  }
  req.sessionId = id;
  const config = llmSessions.get(id);
  if (config && Date.now() > config.expiresAt) llmSessions.delete(id);
  else if (config) config.expiresAt = Date.now() + 3_600_000;
  next();
}
function rateLimit(max = 30) {
  return (req, res, next) => {
    // Rate limits are per endpoint; sharing one session bucket made harmless model/chat
    // calls consume the separate PC-build quota during normal conversation refinements.
    const key = `${req.sessionId || req.ip || 'unknown'}:${req.method}:${req.path}`;
    const now = Date.now();
    let entry = rates.get(key);
    if (!entry || entry.reset < now) { entry = { count: 0, reset: now + 60_000 }; rates.set(key, entry); }
    entry.count += 1;
    if (entry.count > max) return res.status(429).json({ error: 'Muitas tentativas. Aguarde um instante e tente de novo.' });
    next();
  };
}
function catalogSyncLimit(_req, res, next) {
  const key = 'catalog-sync-global';
  const now = Date.now();
  const entry = rates.get(key);
  if (entry && entry.reset > now) return res.status(429).json({ error: 'A sincronização do catálogo já foi solicitada recentemente.' });
  rates.set(key, { count: 1, reset: now + 60_000 });
  next();
}
function redact(text) {
  return String(text || '').slice(0, 2400)
    .replace(/(?:sk-(?:proj-)?[A-Za-z0-9_-]{12,}|sk-ant-[A-Za-z0-9_-]{12,})/g, '[credencial removida]')
    .replace(/bearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, 'Bearer [credencial removida]');
}

function buildSummary(candidate) {
  const labels = { processor: 'Processador', motherboard: 'Placa-mãe', memory: 'Memória', graphicsCard: 'Placa de vídeo', powerSupply: 'Fonte', case: 'Gabinete', storage: 'Armazenamento', cooler: 'Cooler' };
  const items = [];
  for (const [key, value] of Object.entries(candidate.parts)) {
    for (const part of Array.isArray(value) ? value : value ? [value] : []) items.push({
      id: String(part.id), category: labels[key] || key, name: part.name, quantity: Number(part.quantity || 1),
      unitPriceCents: Number(part.priceCents), totalPriceCents: Number(part.priceCents) * Number(part.quantity || 1),
      stockQuantity: Number(part.stockQuantity), url: part.productUrl, sourceUrl: part.sourceUrl,
    });
  }
  return { id: candidate.id, items, totalPriceCents: candidate.totalPriceCents, compatibility: candidate.compatibility,
    unknownRules: candidate.unknownRules, selectionPolicy: candidate.selectionPolicy };
}

const normalizeText = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function requestedGpuModel(text) {
  return String(text || '').match(/\b(?:rtx|gtx)\s*\d{3,4}(?:\s*ti)?\b|\b(?:rx)\s*\d{3,4}(?:\s*xt)?\b/i)?.[0]?.replace(/\s+/g, ' ').trim() || null;
}
app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'setupninja-demo', runtime: process.version, database: true }));
app.get('/api/session', useSession, (req, res) => {
  const config = llmSessions.get(req.sessionId);
  res.json({
    assistant: 'NinjaRUDEUS', providerConfigured: Boolean(config?.model), provider: config?.provider || null,
    model: config?.model || null, decisionProviderConfigured: Boolean(decisionSessions.get(req.sessionId)?.apiKey),
    personaScope: 'Produtos, hardware, tecnologia e configuração',
    database: getDatabaseStats(), publicDemo: true,
  });
});
app.get('/api/catalog', (req, res) => res.json(getCatalog({
  query: String(req.query.q || ''), category: String(req.query.category || ''),
  sort: String(req.query.sort || ''), limit: String(req.query.limit || ''),
})));
app.get('/api/build/options', (_req, res) => {
  const { products } = getOfficialBuildData();
  const optionCategories = {
    processor: 'processador', motherboard: 'placaMae', memory: 'memoria', graphicsCard: 'placaDeVideo',
    powerSupply: 'fonte', case: 'gabinete', storage: 'armazenamento', cooler: 'coolerParaProcessador',
  };
  const parts = Object.fromEntries(Object.entries(optionCategories).map(([slot, categoryKey]) => [slot,
    products.filter((item) => item.inStock && item.stockQuantity > 0 && item.categoryKeys.includes(categoryKey))
      .map((item) => ({ id: item.id, name: item.name, priceCents: item.priceCents,
        stockQuantity: item.stockQuantity, availableQuantity: item.stockQuantity, neededQuantity: 1,
        imageUrl: item.imageUrl, category: CATEGORY_LABELS[categoryKey], attributes: item.attributes }))]));
  res.json({ gpus: products.filter((item) => item.categoryKeys.includes('placaDeVideo')).map((item) => ({ id: item.id, name: item.name, priceCents: item.priceCents, stockQuantity: item.stockQuantity })),
    cpus: products.filter((item) => item.categoryKeys.includes('processador')).map((item) => ({ id: item.id, name: item.name, priceCents: item.priceCents, stockQuantity: item.stockQuantity })),
    parts,
    catalogSource: 'Catálogo oficial de Monte seu PC' });
});
app.get('/api/build/history', useSession, (req, res) => res.json({ builds: getSessionBuilds(req.sessionId) }));
app.post('/api/catalog/sync', originGuard, useSession, catalogSyncLimit, async (_req, res) => {
  try {
    const data = await catalogClient.fetch();
    res.json({ synced: true, catalog: syncOfficialCatalog(data, { force: true }), stats: getDatabaseStats() });
  } catch {
    res.status(502).json({ error: 'Não foi possível atualizar do catálogo oficial. A última versão íntegra permanece disponível.' });
  }
});
app.get('/api/inspect/report', useSession, (_req, res) => {
  const stats = getDatabaseStats();
  const sync = stats.latestOfficialSync;
  res.json({ store: 'https://monte-seu-pc.setupninja.com.br/produtos', collected_on: sync?.synced_at?.slice(0, 10) || stats.collectionDate,
    method: 'API JSON oficial de Monte seu PC, normalizada em transação SQLite; estoque filtrado por SKU.',
    coverage_note: `${sync?.products || stats.products} produtos únicos em ${stats.categories.length} departamentos. Listagens originais: ${sync?.inStockListings || 0} com estoque e ${sync?.outOfStockListings || 0} sem estoque; produtos duplicados entre departamentos foram consolidados por ID. Somente os ${sync?.available || stats.availableProducts} disponíveis entram na vitrine e no montador.`,
    categories_verified_in_store_departments: stats.categories.map((item) => `${item.name} (${item.availableCount} disponíveis / ${item.outOfStockCount} sem estoque)`) });
});
app.get('/api/inspect/tables', useSession, (_req, res) => res.json({ tables: listTables(), database: getDatabaseStats() }));
app.get('/api/inspect/table/:name', useSession, (req, res) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 25, 1), 50);
    const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);
    res.json(readTable(String(req.params.name), limit, offset));
  } catch { res.status(404).json({ error: 'Tabela não liberada. Consulte a lista permitida de tabelas.' }); }
});
app.get('/api/model/config', useSession, (req, res) => {
  const config = llmSessions.get(req.sessionId);
  res.json({ configured: Boolean(config?.model), model: config?.model || '', provider: config?.provider || 'openai',
    baseUrl: config?.baseUrl || 'https://api.openai.com/v1' });
});
app.get('/api/decision/config', useSession, (req, res) => {
  const config = decisionSessions.get(req.sessionId);
  res.json({ configured: Boolean(config?.apiKey), provider: config ? 'typesafe-jev' : null, model: config?.model || 'jev-latest' });
});
app.post('/api/decision/config', originGuard, useSession, rateLimit(6), (req, res) => {
  const apiKey = String(req.body?.apiKey || '').trim();
  if (!apiKey) { decisionSessions.delete(req.sessionId); return res.json({ configured: false, model: 'jev-latest' }); }
  if (apiKey.length < 12 || apiKey.length > 700) return res.status(422).json({ error: 'Credencial Typesafe inválida.' });
  decisionSessions.set(req.sessionId, { apiKey, model: 'jev-latest', expiresAt: Date.now() + 3_600_000 });
  res.json({ configured: true, provider: 'typesafe-jev', model: 'jev-latest', note: 'A credencial de decisão fica somente na memória desta sessão por até uma hora.' });
});
app.post('/api/decision/disconnect', originGuard, useSession, (req, res) => {
  decisionSessions.delete(req.sessionId);
  res.json({ configured: false });
});
app.post('/api/model/config', originGuard, useSession, rateLimit(8), (req, res) => {
  try {
    const provider = String(req.body?.provider || 'openai');
    if (!['openai', 'openai-compatible', 'ollama', 'lmstudio'].includes(provider)) throw Error('Selecione um provedor de conversa compatível.');
    const defaults = { openai: ['https://api.openai.com/v1', 'gpt-4o-mini'], 'openai-compatible': ['', ''],
      ollama: ['http://host.docker.internal:11434/v1', 'llama3.1'], lmstudio: ['http://host.docker.internal:1234/v1', 'local-model'] };
    const baseUrl = String(req.body?.baseUrl || defaults[provider][0]).trim();
    const model = String(req.body?.model || defaults[provider][1]).trim();
    const apiKey = String(req.body?.apiKey || '').trim();
    if (model.length > 120 || !/^[\w./:@+-]{2,120}$/.test(model)) throw Error('O nome do modelo não é válido.');
    const local = ['ollama', 'lmstudio'].includes(provider) && modelClient.localEndpoint(baseUrl);
    if (!baseUrl || (!local && (apiKey.length < 10 || apiKey.length > 700))) throw Error(local ? 'O endpoint local não está liberado pelo servidor.' : 'Informe uma credencial válida para esse provedor.');
    if (local && apiKey.length > 700) throw Error('A credencial é longa demais.');
    llmSessions.set(req.sessionId, { provider, baseUrl, model, apiKey, expiresAt: Date.now() + 3_600_000 });
    res.json({ configured: true, provider, model, baseUrl, note: 'A credencial, quando usada, ficará somente na memória desta sessão por até uma hora.' });
  } catch (error) { res.status(422).json({ error: String(error.message || 'Configuração inválida.').slice(0, 160) }); }
});
app.post('/api/model/disconnect', originGuard, useSession, (req, res) => {
  llmSessions.delete(req.sessionId);
  res.json({ disconnected: true });
});
app.post('/api/model/test', originGuard, useSession, rateLimit(4), async (req, res) => {
  const config = llmSessions.get(req.sessionId);
  if (!config?.model) return res.status(409).json({ error: 'Esta sessão ainda não tem conexão configurada.' });
  try {
    const result = await modelClient.complete(config, [
      { role: 'system', content: 'Você é NinjaRUDEUS, especialista em hardware e produtos Setup Ninja. Responda apenas OK em português.' },
      { role: 'user', content: 'Responda exatamente OK.' },
    ], 50);
    res.json({ ok: true, model: config.model, answer: result.answer.slice(0, 100) });
  } catch { res.status(502).json({ error: 'Não foi possível conectar. Confira URL HTTPS, nome do modelo e credencial.' }); }
});
app.get('/api/chat/history', useSession, (req, res) => res.json({ messages: getSessionMessages(req.sessionId) }));
app.get('/api/chat/runs', useSession, (req, res) => res.json({ runs: getSessionRuns(req.sessionId) }));
app.post('/api/chat/clear', originGuard, useSession, (req, res) => {
  clearSession(req.sessionId);
  res.json({ cleared: true });
});
app.post('/api/build', originGuard, useSession, rateLimit(5), async (req, res) => {
  const started = performance.now();
  const request = typeof req.body?.request === 'string' ? req.body.request.trim().slice(0, 900) : '';
  const requestIntent = interpretRequest(request);
  const priorBuildId = typeof req.body?.previousBuildId === 'string' ? req.body.previousBuildId.slice(0, 80) : '';
  const previousBuild = priorBuildId ? getSessionBuilds(req.sessionId).find((item) => item.id === priorBuildId) : null;
  const suppliedBudget = req.body?.budget !== undefined && req.body?.budget !== '' ? Number(req.body.budget) : null;
  const budgetCentsInput = Number.isFinite(suppliedBudget) ? Math.round(suppliedBudget * 100)
    : requestIntent.budgetCents ?? previousBuild?.requirements?.budgetCents ?? null;
  const referenceBudget = budgetCentsInput === null;
  // Sem teto declarado, esta é uma referência explicitamente informada na resposta,
  // e pode ser refinada; não a apresentamos como orçamento fornecido pelo cliente.
  const budgetValue = referenceBudget ? (/\b(?:rtx|rx)\s*50[789]0\b/i.test(request) ? 15_000 : 8_000) : budgetCentsInput / 100;
  if (!Number.isFinite(budgetValue) || budgetValue < 100 || budgetValue > 1_000_000) return res.status(422).json({ error: 'Informe um teto entre R$ 100 e R$ 1.000.000.' });
  const budgetCents = Math.round(budgetValue * 100);
  const memoryGB = Math.max(8, Math.min(128, Number.parseInt(req.body?.memoryGB, 10) || requestIntent.memoryGB || previousBuild?.requirements?.memoryGB || 16));
  const explicitGpu = typeof req.body?.gpuId === 'string' && req.body.gpuId.length <= 32 ? req.body.gpuId : null;
  const requestedVendor = ['amd', 'intel'].includes(req.body?.cpuVendor) ? req.body.cpuVendor : null;
  const requiredParts = {};
  const explicitRequiredParts = new Set();
  const refineTargets = new Set();
  for (const key of ['processor', 'motherboard', 'memory', 'graphicsCard', 'powerSupply', 'case', 'storage', 'cooler']) {
    const value = req.body?.requiredParts?.[key];
    if (typeof value === 'string' && /^\d{3,20}$/.test(value)) {
      requiredParts[key] = value;
      explicitRequiredParts.add(key);
      refineTargets.add(key);
    }
  }
  if (explicitGpu) refineTargets.add('graphicsCard');
  if (previousBuild) {
    const normalized = normalizeRequest(request);
    if (/\b(processador|cpu|ryzen|intel)\b/.test(normalized)) refineTargets.add('processor');
    if (/\b(placa de video|gpu|vga|nvidia|geforce|radeon|rtx|gtx)\b/.test(normalized)) refineTargets.add('graphicsCard');
    if (/\b(placa mae|motherboard)\b/.test(normalized)) refineTargets.add('motherboard');
    if (/\b(memoria|ram)\b/.test(normalized) || requestIntent.memoryGB) refineTargets.add('memory');
    if (/\b(fonte|psu)\b/.test(normalized)) refineTargets.add('powerSupply');
    if (/\b(gabinete|case)\b/.test(normalized)) refineTargets.add('case');
    if (/\b(ssd|armazenamento)\b/.test(normalized)) refineTargets.add('storage');
    if (/\b(cooler|water cooler)\b/.test(normalized)) refineTargets.add('cooler');
    for (const key of ['processor', 'motherboard', 'memory', 'graphicsCard', 'powerSupply', 'case', 'storage', 'cooler']) {
      if (refineTargets.has(key) || requiredParts[key]) continue;
      const picked = previousBuild.parts[key];
      const part = Array.isArray(picked) ? picked[0] : picked;
      if (part?.id) requiredParts[key] = String(part.id);
    }
  }
  const purpose = requestIntent.purpose || previousBuild?.requirements?.purpose || 'general';
  const processorModel = request.match(/\b(?:ryzen\s+[3579](?:\s+\d{4,5}[a-z0-9]{0,3})?|core\s+i[3579](?:-\d{4,5}[a-z]{0,2})?)\b/i)?.[0] || null;
  const gpuModel = requestedGpuModel(request);
  const excludedVendors = [...new Set([...(previousBuild?.requirements?.excludedVendors || []), ...requestIntent.excludedVendors])];
  const requirements = { budgetCents, memoryGB, purpose, referenceBudget,
    dedicatedGpu: Boolean(req.body?.dedicatedGpu || explicitGpu || requiredParts.graphicsCard || previousBuild?.parts?.graphicsCard || gpuModel || requestIntent.gpuPriority || purpose === 'gaming' || purpose === 'workstation' || /placa\s+de\s+video|gpu|dedicad[ao]|geforce|radeon/i.test(request)),
    preferredVendor: requestedVendor || requestIntent.preferredVendor ||
      (excludedVendors.includes(previousBuild?.requirements?.preferredVendor) ? null : previousBuild?.requirements?.preferredVendor) ||
      (excludedVendors.includes('intel') ? 'amd' : null),
    excludedVendors, gpuPriority: requestIntent.gpuPriority || Boolean(gpuModel || explicitGpu || /\b(?:nvidia|geforce|radeon)\b/i.test(request)) || purpose === 'workstation' || previousBuild?.requirements?.gpuPriority || false,
    preferredGpuVendor: /\b(?:nvidia|geforce)\b/i.test(request) ? 'nvidia' : /\b(?:radeon)\b/i.test(request) ? 'amd' : null,
    preferredCpu: processorModel, preferredGpuId: explicitGpu, requiredParts };
  if (requirements.preferredVendor && excludedVendors.includes(requirements.preferredVendor)) {
    return res.status(422).json({ error: 'As preferências de processador se contradizem; informe AMD ou Intel.' });
  }
  const language = llmSessions.get(req.sessionId);
  let modelIntent = null;
  let interpretation = { provider: 'deterministic-input', model: 'campos do formulário', called: false };
  if (language?.model && request) {
    try {
      const parsed = await modelClient.complete(language, createInterpretationMessages(request), 220, INTERPRETATION_SCHEMA);
      const parsedIntent = validateInterpretation(parsed.answer);
      if (!parsedIntent) throw Error('invalid-interpretation-schema');
      modelIntent = parsedIntent;
      interpretation = { provider: language.provider, model: language.model, called: true };
      const processorMayBeRefined = !previousBuild || refineTargets.has('processor');
      const cpuPreferenceWasRequested = parsedIntent.preferredCpu
        && normalizeRequest(request).includes(normalizeRequest(parsedIntent.preferredCpu));
      if (processorMayBeRefined && !explicitRequiredParts.has('processor')) {
        if (!requestedVendor && !requirements.preferredVendor && parsedIntent.preferredVendor && !excludedVendors.includes(parsedIntent.preferredVendor)) requirements.preferredVendor = parsedIntent.preferredVendor;
        if (!processorModel && cpuPreferenceWasRequested) requirements.preferredCpu = parsedIntent.preferredCpu.slice(0, 50);
      }
      if (parsedIntent.preferredCpu && !cpuPreferenceWasRequested) interpretation.ignoredPreferences = ['preferredCpu'];
      const memoryMayBeRefined = !previousBuild || refineTargets.has('memory');
      if (memoryMayBeRefined && !req.body?.memoryGB && !requestIntent.memoryGB && Number.isInteger(parsedIntent.memoryGB)) {
        requirements.memoryGB = Math.max(requirements.memoryGB, Math.min(128, parsedIntent.memoryGB));
      }
      if (!requestIntent.purpose && !previousBuild && parsedIntent.purpose) requirements.purpose = parsedIntent.purpose;
      if (parsedIntent.dedicatedGpu === true) requirements.dedicatedGpu = true;
    } catch { interpretation = { provider: language.provider, model: language.model, called: true, fallback: 'interpretação indisponível; usei filtros explícitos' }; }
  }
  let official;
  try { official = getOfficialBuildData(); }
  catch { return res.status(503).json({ error: 'O catálogo oficial está indisponível.' }); }
  if (explicitRequiredParts.has('processor')) {
    const selectedCpu = official.products.find((item) => String(item.id) === requiredParts.processor
      && item.categoryKeys.includes('processador') && item.inStock && item.stockQuantity > 0);
    const selectedCpuVendor = cpuVendor(selectedCpu);
    if (selectedCpuVendor) {
      const explicitlyRequestedVendor = requestedVendor || requestIntent.preferredVendor;
      if (excludedVendors.includes(selectedCpuVendor) || (explicitlyRequestedVendor && explicitlyRequestedVendor !== selectedCpuVendor)) {
        return res.status(422).json({ error: 'O processador selecionado contradiz uma preferência explícita de plataforma.' });
      }
      // An explicit processor SKU identifies the chosen platform and model. Do not
      // let preferences carried over from a previous build constrain this selection.
      requirements.preferredVendor = selectedCpuVendor;
      requirements.preferredCpu = selectedCpu.name;
    }
  }
  if (modelIntent?.preferredCpu && !processorModel && !explicitRequiredParts.has('processor')) {
    const match = official.products.some((item) => item.categoryKeys.includes('processador') && item.inStock
      && normalizeText(item.name).includes(normalizeText(modelIntent.preferredCpu)));
    if (!match) requirements.preferredCpu = null;
  }
  if (gpuModel && !explicitGpu) {
    const matched = official.products.filter((item) => item.categoryKeys.includes('placaDeVideo') && item.inStock && normalizeText(item.name).includes(normalizeText(gpuModel)));
    if (!matched.length) return res.status(422).json({ error: `Não encontrei uma placa ${gpuModel} disponível no catálogo oficial.` });
    requirements.preferredGpuId = matched.sort((a, b) => a.priceCents - b.priceCents)[0].id;
  }
  let candidates = buildCandidates({ ...official, budgetCents, purpose: requirements.purpose, memoryGB: requirements.memoryGB,
    dedicatedGpu: requirements.dedicatedGpu, preferredVendor: requirements.preferredVendor,
    preferredCpu: requirements.preferredCpu, preferredGpuId: explicitGpu || requirements.preferredGpuId,
    preferredGpuVendor: requirements.preferredGpuVendor, gpuPriority: requirements.gpuPriority,
    excludedVendors, requiredParts, limit: 4 });
  const dependentParts = { graphicsCard: ['powerSupply', 'case'], processor: ['motherboard', 'memory', 'powerSupply', 'cooler'],
    motherboard: ['processor', 'memory'], memory: ['motherboard'], powerSupply: [], case: [], storage: [], cooler: [] };
  const adjustedParts = [];
  if (!candidates.length && previousBuild && refineTargets.size) {
    for (const dependency of new Set([...refineTargets].flatMap((target) => dependentParts[target] || []))) {
      if (!requiredParts[dependency] || explicitRequiredParts.has(dependency)) continue;
      delete requiredParts[dependency]; adjustedParts.push(dependency);
      candidates = buildCandidates({ ...official, budgetCents, purpose: requirements.purpose, memoryGB: requirements.memoryGB,
        dedicatedGpu: requirements.dedicatedGpu, preferredVendor: requirements.preferredVendor,
        preferredCpu: requirements.preferredCpu, preferredGpuId: explicitGpu || requirements.preferredGpuId,
        preferredGpuVendor: requirements.preferredGpuVendor, gpuPriority: requirements.gpuPriority,
        excludedVendors, requiredParts, limit: 4 });
      if (candidates.length) break;
    }
  }
  if (!candidates.length) return res.status(422).json({ error: `Não encontrei uma montagem completa validada abaixo de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(budgetCents / 100)} com as peças selecionadas. Tente um orçamento maior ou remova uma preferência.` });
  let selected = candidates[0];
  const decisionConfig = decisionSessions.get(req.sessionId);
  let decision = { provider: 'deterministic', model: 'ranking de custo', confidence: null, fallback: true, called: false };
  let decisionUsage = { inputTokens: null, outputTokens: null };
  if (decisionConfig?.apiKey && candidates.length > 1) {
    try {
      const result = await defaultTypesafeJev.choose(decisionConfig, request, requirements, candidates);
      const validation = validateCandidateChoice(candidates, result, budgetCents, official.exceptions);
      if (validation.candidate) {
          selected = validation.candidate;
          decision = { provider: 'typesafe-jev', model: result.model, confidence: result.confidence, fallback: false, called: true };
          decisionUsage = { inputTokens: result.inputTokens, outputTokens: result.outputTokens };
      } else decision = { provider: 'deterministic', model: 'ranking de custo', confidence: result.confidence || null, fallback: true, called: true, reason: validation.reason };
    } catch { decision = { provider: 'deterministic', model: 'ranking de custo', confidence: null, fallback: true, called: true, reason: 'decisor indisponível' }; }
  }
  const allowedReasons = allowedBuildReasons(selected, requirements);
  let selectedReasons = allowedReasons.slice(0, 2);
  let generation = { provider: 'deterministic', model: 'montador local', called: false, fallback: true };
  let generationUsage = { inputTokens: null, outputTokens: null };
  if (language?.model) {
    try {
      const generated = await modelClient.complete(language, [
        { role: 'system', content: 'Selecione razões verdadeiras dentre os IDs permitidos. Não escreva texto. Responda JSON exato: {"reasons":["id"]}, no máximo três itens.' },
        { role: 'user', content: JSON.stringify({ task: 'BUILD_EXPLANATION_REASON_PLAN', purpose: requirements.purpose, allowedReasons }) },
      ], 100, buildReasonSchema(allowedReasons));
      const plan = validateBuildPlan(generated.answer, allowedReasons);
      if (plan) {
        selectedReasons = plan.reasons;
        generation = { provider: language.provider, model: language.model, called: true, fallback: false };
      } else generation = { provider: language.provider, model: language.model, called: true, fallback: true, reason: 'plano de razões inválido' };
      generationUsage = { inputTokens: generated.inputTokens, outputTokens: generated.outputTokens };
    } catch (error) { generation = { provider: language.provider, model: language.model, called: true, fallback: true,
      reason: ['provider-timeout', 'provider-unavailable', 'provider-failed', 'provider-invalid-json', 'provider-empty-answer'].includes(error.message)
        ? error.message : 'provider-error' }; }
  }
  const explanation = redact(renderBuildExplanation(selected, budgetCents, selectedReasons, referenceBudget));
  const buildId = randomBytes(16).toString('hex');
  try { saveBuild({ id: buildId, sessionId: req.sessionId, request: redact(request), candidate: selected, budgetCents, purpose: requirements.purpose,
    requirements, interpretation, decision, generation, explanation }); }
  catch { return res.status(503).json({ error: 'Não consegui persistir a montagem na sessão. Tente outra vez.' }); }
  const durationMs = Math.round(performance.now() - started);
  const changedParts = previousBuild ? ['processor', 'motherboard', 'memory', 'graphicsCard', 'powerSupply', 'case', 'storage', 'cooler'].filter((key) => {
    const oldValue = previousBuild.parts[key]; const oldPart = Array.isArray(oldValue) ? oldValue[0] : oldValue;
    const newValue = selected.parts[key]; const newPart = Array.isArray(newValue) ? newValue[0] : newValue;
    return oldPart?.id !== newPart?.id;
  }) : [];
  res.json({ buildId, selected: { ...buildSummary(selected), explanation }, candidates: candidates.map(buildSummary),
    refinement: previousBuild ? { requestedCategory: [...refineTargets].join(', ') || null, changedParts, relaxedDependencies: adjustedParts } : null,
    interpretation, decision: { ...decision, ...decisionUsage }, generation: { ...generation, ...generationUsage },
    telemetry: { durationMs, budgetCents, referenceBudget, actualTotalCents: selected.totalPriceCents, insideBudget: selected.totalPriceCents <= budgetCents,
      sources: 'official-monte-seu-pc', modelWasActuallyCalled: Boolean(interpretation.called || decision.called || generation.called) } });
});
app.post('/api/chat', originGuard, useSession, rateLimit(18), async (req, res) => {
  const query = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 1200) : '';
  if (query.length < 2) return res.status(400).json({ error: 'Escreva uma pergunta com pelo menos dois caracteres.' });
  const started = performance.now();
  const priorTurns = getSessionMessages(req.sessionId).slice(-8);
  const contextText = priorTurns.map((turn) => turn.role + ': ' + turn.content).join('\n').slice(-2400);
  const previousUserQuery = priorTurns.filter((turn) => turn.role === 'user').at(-1)?.content || '';
  const contextualScope = isAllowedContextualFollowup(query) && isHardwareScope(previousUserQuery);
  const scoped = isHardwareScope(query) || contextualScope;
  const hello = isGreeting(query);
  const blocked = isPromptInjection(query);
  const documents = scoped && !hello && !blocked
    ? searchCatalog([contextText, query].filter(Boolean).join('\n'), 8, query, previousUserQuery) : [];
  const provider = llmSessions.get(req.sessionId);
  let mode = 'demo_local';
  let providerCalled = false;
  let providerSucceeded = false;
  let answer = blocked
    ? 'Meu prompt está trancado no cofre, chefe. Atendo produtos, tecnologia, hardware e configuração de PC. Qual componente está pesquisando?'
    : renderChatFallback(query, documents, { inScope: scoped, greeting: hello });
  let usedDocuments = documents;
  let inputTokens = null;
  let outputTokens = null;
  let outcome = blocked ? 'prompt_injection_bloqueada'
    : (!scoped && !hello ? 'fora_escopo' : documents.length ? 'respondido' : 'sem_fontes');
  if (provider?.model && scoped && !hello && !blocked && documents.length) {
    try {
      providerCalled = true;
      const result = await modelClient.complete(provider, createChatPlanMessages({ query, context: contextText, documents }), 240, chatPlanSchema(documents));
      const plan = validateChatPlan(result.answer, documents);
      const rendered = renderChatPlan(plan, documents);
      if (rendered) {
        answer = rendered;
        usedDocuments = plan.sourceIds.length
          ? plan.sourceIds.map((id) => documents.find((doc) => String(doc.id) === id)).filter(Boolean)
          : plan.guideId ? documents.filter((doc) => String(doc.guide_id || doc.title) === plan.guideId) : [];
        providerSucceeded = true;
        mode = 'api_openai_compatível';
        outcome = 'respondido';
      } else {
        mode = 'demo_fallback_plano_inválido';
        outcome = 'fallback_plano_invalido';
      }
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
    } catch {
      mode = 'demo_fallback_api_indisponível';
      outcome = 'fallback_api_indisponivel';
    }
  }
  const citations = usedDocuments.slice(0, 8).map((item) => ({
    id: item.id, productId: item.product_id, title: item.title, category: item.category, url: item.source_url, rank: item.rank,
  }));
  const durationMs = Math.round(performance.now() - started);
  const model = providerSucceeded ? (provider?.model || 'modelo configurado') : 'NinjaRUDEUS demonstrativo local';
  try {
    recordInteraction({ sessionId: req.sessionId, query, answer, sources: citations,
      model, mode, durationMs, inputTokens, outputTokens, outcome });
  } catch { return res.status(503).json({ error: 'A base local está ocupada. Aguarde e tente de novo.' }); }
  res.json({
    answer: redact(answer), citations,
    telemetry: {
      assistant: 'NinjaRUDEUS', model, mode, providerCalled, retrieved: citations.length,
      durationMs, inputTokens, outputTokens, outcome,
      database: 'SQLite FTS5 · BM25', chainOfThoughtStored: false,
    },
  });
});

if (process.argv.includes('--seed-only')) {
  console.log(JSON.stringify({ products: getDatabaseStats().products, database: databasePath }));
  process.exit(0);
}
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(root, 'dist'), { maxAge: '12h', etag: true, index: false }));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(root, 'dist/index.html')));
} else {
  app.get('/', (_req, res) => res.send('Vite: abra http://127.0.0.1:5173/ durante o desenvolvimento.'));
}
setInterval(() => {
  const now = Date.now();
  for (const [id, config] of llmSessions) if (config.expiresAt <= now) llmSessions.delete(id);
  for (const [id, entry] of rates) if (entry.reset < now) rates.delete(id);
  purgeExpiredSessions();
}, 60_000).unref();
app.listen(port, host, () => {
  chmodSync(databasePath, 0o640);
  console.log('Setup Ninja em http://' + host + ':' + port + ' · SQLite e RAG prontos.');
  if (process.env.SETUPNINJA_SKIP_LIVE_SYNC === '1') return;
  catalogClient.fetch().then((payload) => {
    const result = syncOfficialCatalog(payload, { force: true });
    console.log(`Catálogo oficial atualizado: ${result.unique} produtos únicos; ${result.available} disponíveis.`);
  }).catch(() => console.warn('Sincronização oficial indisponível; usando o último snapshot íntegro.'));
});
