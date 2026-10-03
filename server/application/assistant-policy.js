import { compatibilityRuleLabel, compatibilityStatusLabel } from '../../shared/compatibility-labels.js';

const normalizeText = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const CHAT_MODES = Object.freeze(['listing', 'comparison', 'hardware-guide', 'clarification']);
const GUIDE_CATEGORY = 'guias de hardware';

export const INTERPRETATION_SCHEMA = Object.freeze({
  name: 'setupninja_interpretation',
  schema: {
    type: 'object', additionalProperties: false,
    properties: {
      purpose: { type: ['string', 'null'], enum: ['gaming', 'general', 'workstation', null] },
      memoryGB: { type: ['integer', 'null'] },
      dedicatedGpu: { type: ['boolean', 'null'] },
      preferredVendor: { type: ['string', 'null'], enum: ['amd', 'intel', null] },
      preferredCpu: { type: ['string', 'null'], enum: ['Ryzen 3', 'Ryzen 5', 'Ryzen 7', 'Ryzen 9',
        'Core i3', 'Core i5', 'Core i7', 'Core i9', null] },
    },
    required: ['purpose', 'memoryGB', 'dedicatedGpu', 'preferredVendor', 'preferredCpu'],
  },
});

export function buildReasonSchema(allowedReasons) {
  return { name: 'setupninja_build_reasons', schema: {
    type: 'object', additionalProperties: false,
    properties: { reasons: { type: 'array', maxItems: 3, items: { type: 'string', enum: [...allowedReasons] } } },
    required: ['reasons'],
  } };
}

export function chatPlanSchema(documents) {
  const guides = documents.filter((doc) => String(doc.category || '').toLowerCase() === GUIDE_CATEGORY);
  const guideIds = guides.map((doc) => String(doc.guide_id || doc.title));
  return { name: 'setupninja_chat_plan', schema: {
    type: 'object', additionalProperties: false,
    properties: {
      mode: { type: 'string', enum: [...CHAT_MODES] },
      sourceIds: { type: 'array', maxItems: 4, items: { type: 'string', enum: documents.map((doc) => String(doc.id)) } },
      guideId: { type: ['string', 'null'], enum: [...guideIds, null] },
    },
    required: ['mode', 'sourceIds', 'guideId'],
  } };
}

export function isHardwareScope(text) {
  return /(?:\b(?:pc|computador|hardware|placa|cpu|gpu|ram|mem[oó]ria|ssd|nvme|sata|processador|ryzen|intel|geforce|radeon|rtx|windows|linux|setup|montar|montagem|fonte|gabinete|cooler|monitor|teclado|mouse|headset|fone|jogo|fps|armazenamento|boot|bios|driver|wifi|wi-fi|ethernet|rede|am4|am5|lga)\b|compatib|tecnolog|perif[eé]ric|water.?cooler|temperatura|superaqu|mini.?itx)/i.test(String(text || ''));
}

export function isAllowedContextualFollowup(text) {
  const query = String(text || '').trim();
  if (!query || isHardwareScope(query)) return false;
  return /^(?:e\s+)?(?:qual|quais)\s+(?:(?:desses|dessas|deles|delas|dentre eles|op[cç][aã]o|produto|pe[cç]a|componente|modelo|placa|processador|mem[oó]ria|fonte|gabinete|ssd|gpu|pre[cç]o|valor|consumo|tamanho|capacidade|custa|serve|funciona)\b|(?:custa menos|é mais barato|vale a pena|tem em estoque|está em estoque))[^?!]{0,90}[?!.]?$/i.test(query)
    || /^(?:e\s+)?(?:esse|essa|isso|desses|dessas|dos dois|das duas|entre eles|entre elas)\s+(?:custa|consome|serve|funciona|é compat[ií]vel|vale a pena|instalo|instalar|atualizo|atualizar)\b[^?!]{0,60}[?!.]?$/i.test(query)
    || /^(?:e\s+)?(?:como|onde)\s+(?:instalo|instalar|atualizo|atualizar|conecto|configuro)\s+(?:isso|esse|essa|ele|ela|a pe[cç]a|o componente|o processador|a placa|a mem[oó]ria)\b[^?!]{0,50}[?!.]?$/i.test(query);
}

const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

export function validateInterpretation(raw) {
  let value;
  try { value = JSON.parse(raw); } catch { return null; }
  const keys = ['purpose', 'memoryGB', 'dedicatedGpu', 'preferredVendor', 'preferredCpu'];
  if (!exactKeys(value, keys)) return null;
  if (value.purpose !== null && !['gaming', 'general', 'workstation'].includes(value.purpose)) return null;
  if (value.memoryGB !== null && (!Number.isInteger(value.memoryGB) || value.memoryGB < 8 || value.memoryGB > 128)) return null;
  if (value.dedicatedGpu !== null && typeof value.dedicatedGpu !== 'boolean') return null;
  if (value.preferredVendor !== null && !['amd', 'intel'].includes(value.preferredVendor)) return null;
  if (value.preferredCpu !== null && (typeof value.preferredCpu !== 'string' || value.preferredCpu.length > 50
      || !/^(?:ryzen\s+[3579]|core\s+i[3579])(?:\s+\d{4,5}[a-z0-9]{0,4})?$/i.test(value.preferredCpu.trim()))) return null;
  return value;
}

export function createInterpretationMessages(request) {
  return [
    { role: 'system', content: 'Extraia preferências explícitas. Retorne somente um objeto JSON válido com estas cinco chaves exatas; não acrescente outras: {"purpose":null,"memoryGB":null,"dedicatedGpu":null,"preferredVendor":null,"preferredCpu":null}. Cada valor deve ser único e exato, nunca uma lista de alternativas. purpose: gaming para jogos, workstation para edição/trabalho, general para uso geral; use exatamente um desses três valores em minúsculas ou null. memoryGB deve ser um número inteiro ou null; dedicatedGpu deve ser true, false ou null; preferredVendor deve ser exatamente amd ou intel em minúsculas, ou null; preferredCpu deve ser um modelo/preferência curto do usuário, ou null. Use null quando não houver preferência explícita. Não retorne SKU, preço, estoque ou fatos técnicos.' },
    { role: 'user', content: String(request || '').replaceAll('<', '＜').replaceAll('>', '＞').slice(0, 900) },
  ];
}

export function allowedBuildReasons(candidate, requirements = {}) {
  const reasons = ['within-budget'];
  if (requirements.purpose === 'gaming') reasons.push('gaming-focus');
  if (requirements.purpose === 'workstation') reasons.push('workstation-focus');
  if (requirements.gpuPriority && candidate.parts.graphicsCard && Number(candidate.parts.graphicsCard.priceCents) > Number(candidate.parts.processor.priceCents)) reasons.push('gpu-priority');
  const ramGB = (candidate.parts.memory || []).reduce((sum, part) => sum + Number(part.attributes?.ramCapacity || 0) * Number(part.quantity || 1), 0);
  if (ramGB >= Number(requirements.memoryGB || 16)) reasons.push('memory-target');
  if (requirements.preferredGpuId && String(candidate.parts.graphicsCard?.id) === String(requirements.preferredGpuId)) reasons.push('requested-gpu');
  if (requirements.preferredCpu && candidate.parts.processor.name.toLowerCase().includes(requirements.preferredCpu.toLowerCase())) reasons.push('requested-cpu');
  if (candidate.compatibility.status === 'UNKNOWN') reasons.push('review-unknowns');
  return [...new Set(reasons)];
}

export function validateBuildPlan(raw, allowedReasons) {
  let value;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!exactKeys(value, ['reasons']) || !Array.isArray(value.reasons) || value.reasons.length > 3
      || value.reasons.some((item) => typeof item !== 'string' || !allowedReasons.includes(item))
      || new Set(value.reasons).size !== value.reasons.length) return null;
  return { reasons: value.reasons };
}

const reasonCopy = Object.freeze({
  'within-budget': 'O total está dentro do limite informado.',
  'gaming-focus': 'A seleção prioriza uma montagem voltada a jogos, conforme o pedido.',
  'workstation-focus': 'A seleção considera o uso de trabalho informado.',
  'gpu-priority': 'A placa de vídeo recebeu prioridade de investimento dentro das peças disponíveis.',
  'memory-target': 'A memória selecionada atende à capacidade pedida.',
  'requested-gpu': 'A placa de vídeo corresponde ao modelo solicitado.',
  'requested-cpu': 'O processador corresponde à preferência indicada.',
  'review-unknowns': 'Alguns encaixes permanecem sem confirmação porque a API não publica todos os dados necessários.',
});
const money = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents) / 100);

export function renderBuildExplanation(candidate, budgetCents, reasons, referenceBudget = false) {
  const parts = Object.values(candidate.parts).flatMap((value) => {
    const group = Array.isArray(value) ? value : value ? [value] : [];
    return group.map((part) => `${Number(part.quantity || 1) > 1 ? `${Number(part.quantity)}× ` : ''}${part.name} — ${money(Number(part.priceCents) * Number(part.quantity || 1))}`);
  });
  const validatedReasons = reasons.filter((reason) => Object.hasOwn(reasonCopy, reason));
  const explanation = `NinjaRUDEUS montou uma sugestão com itens do catálogo oficial.\n\n${parts.join('\n')}\n\nTotal do catálogo: ${money(candidate.totalPriceCents)} (limite ${money(budgetCents)}).`
    + (validatedReasons.length ? `\n\n${validatedReasons.map((reason) => reasonCopy[reason]).join(' ')}` : '')
    + (candidate.unknownRules.length ? `\n\nConfira antes da compra: ${candidate.unknownRules.map(compatibilityRuleLabel).join(', ')}. Dados não publicados não são confirmação de encaixe.` : '')
    + `\n\nCompatibilidade: ${compatibilityStatusLabel(candidate.compatibility.status)}.`;
  return referenceBudget ? `Você não informou um teto. Usei ${money(budgetCents)} apenas como referência inicial; posso ajustar ao orçamento que preferir.\n\n${explanation}` : explanation;
}

function asSource(document) {
  const guide = String(document.category || '').toLowerCase() === GUIDE_CATEGORY;
  return { id: String(document.id), title: String(document.title || '').slice(0, 240), category: String(document.category || '').slice(0, 120),
    kind: guide ? 'guide' : 'product', guideId: guide ? String(document.guide_id || document.title) : null };
}

export function createChatPlanMessages({ query, context = '', documents = [] }) {
  const sources = documents.map(asSource);
  const guides = sources.filter((source) => source.kind === 'guide');
  const system = guides.length
    ? 'Selecione o guia técnico cujo título responde à pergunta. Retorne JSON com mode="hardware-guide", sourceIds=[] e guideId igual ao ID do guia escolhido. Use mode="clarification" e guideId=null apenas se nenhum guia responder. Não escreva a resposta ao cliente nem invente fatos.'
    : 'Selecione produtos relevantes de availableSources. Retorne JSON com mode="listing" (opções) ou "comparison" (comparação), sourceIds com até quatro IDs e guideId=null. Se nenhuma fonte responder, use mode="clarification" e sourceIds=[]. Não escreva a resposta ao cliente nem invente fatos.';
  return [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify({ task: guides.length ? 'select_hardware_guide' : 'select_catalog_sources',
      question: String(query).slice(0, 1200), conversationContext: String(context).slice(-1200),
      availableSources: guides.length ? guides : sources }) },
  ];
}

export function validateChatPlan(raw, documents) {
  let value;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!exactKeys(value, ['mode', 'sourceIds', 'guideId']) || !CHAT_MODES.includes(value.mode)
      || !Array.isArray(value.sourceIds) || value.sourceIds.length > 4
      || value.sourceIds.some((id) => typeof id !== 'string')
      || new Set(value.sourceIds).size !== value.sourceIds.length
      || (value.guideId !== null && typeof value.guideId !== 'string')) return null;
  const sourceMap = new Map(documents.map((doc) => [String(doc.id), doc]));
  const picked = value.sourceIds.map((id) => sourceMap.get(id));
  if (picked.some((doc) => !doc)) return null;
  const guides = documents.filter((doc) => String(doc.category || '').toLowerCase() === GUIDE_CATEGORY);
  if (value.mode === 'hardware-guide') {
    const selectedGuide = guides.find((doc) => String(doc.guide_id || doc.title) === value.guideId);
    if (!selectedGuide) return null;
    if (picked.length && (picked.length !== 1 || picked[0].id !== selectedGuide.id)) return null;
  } else if (value.guideId !== null) return null;
  if (['listing', 'comparison'].includes(value.mode) && (!picked.length || picked.some((doc) => String(doc.category || '').toLowerCase() === GUIDE_CATEGORY))) return null;
  if (value.mode === 'clarification' && (picked.length || value.guideId !== null)) return null;
  return { ...value, sourceIds: [...value.sourceIds] };
}

const priceLabel = (document) => Number.isFinite(Number(document.price_brl))
  ? ` — ${money(Math.round(Number(document.price_brl) * 100))} no snapshot consultado` : ' — preço individual ausente no catálogo';

const SPEC_LABELS = Object.freeze({ socket: 'Soquete', sockets: 'Soquetes aceitos', tdp: 'TDP (W)',
  minimumPowerSupply: 'Requisito publicado da fonte', hasCooler: 'Cooler incluso', hasGpu: 'Vídeo integrado',
  maxRamCapacity: 'RAM máxima (GB)', ramType: 'Tipo de RAM', cpuType: 'Plataforma', ramSlotsQuantity: 'Slots de RAM',
  m2SlotsQuantity: 'Slots M.2', ramCapacity: 'Capacidade do módulo (GB)', modulesQuantity: 'Módulos por kit',
  gpuType: 'Tipo de GPU', gpu: 'Modelo de GPU', maxGpuSize: 'Comprimento máximo (mm)', formFactor: 'Formato publicado',
  maxCpuTdp: 'TDP máximo de CPU (W)', hasPFC: 'PFC', waterCoolerSizes: 'Radiadores aceitos (mm)',
  wifiType: 'Padrão Wi-Fi', bands: 'Bandas Wi-Fi', compatibility: 'Compatibilidade publicada' });

function sourceSpecifications(document) {
  let attributes;
  try { attributes = JSON.parse(document.attributes_json || '{}'); } catch { return []; }
  return Object.entries(SPEC_LABELS).filter(([key]) => attributes[key] !== undefined && attributes[key] !== null)
    .slice(0, 5).map(([key, label]) => {
      const value = attributes[key];
      const printable = Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? (value ? 'sim' : 'não') : String(value);
      return `${label}: ${printable}`;
    });
}

export function renderChatPlan(plan, documents) {
  if (!plan) return null;
  if (plan.mode === 'clarification') return 'NinjaRUDEUS: manda o modelo exato, o componente ou o objetivo da montagem. Sem essa pista, a bancada não vai chutar.';
  if (plan.mode === 'hardware-guide') {
    const guide = documents.find((doc) => String(doc.guide_id || doc.title) === plan.guideId && String(doc.category || '').toLowerCase() === GUIDE_CATEGORY);
    if (!guide) return null;
    return `NinjaRUDEUS na bancada. ${guide.title}:\n${guide.content}\n\nSiga também o manual do modelo específico; versões e disposição dos componentes variam. Fonte: ${guide.source_title}.`;
  }
  const selected = plan.sourceIds.map((id) => documents.find((doc) => String(doc.id) === id)).filter(Boolean);
  if (!selected.length) return null;
  const heading = plan.mode === 'comparison' ? 'NinjaRUDEUS comparou as opções recuperadas:' : 'NinjaRUDEUS encontrou no catálogo:';
  const entries = selected.map((doc) => {
    const facts = sourceSpecifications(doc);
    return `• ${doc.title}${priceLabel(doc)}${facts.length ? `\n  ${facts.join(' · ')}` : ''}`;
  });
  return `${heading}\n${entries.join('\n')}\n\nPreços e estoque refletem o último snapshot consultado. Para confirmar disponibilidade atual, abra a fonte de cada produto.`;
}

export function renderChatFallback(query, documents, { inScope = true, greeting = false } = {}) {
  if (greeting) return 'Salve! NinjaRUDEUS na área. Manda tua dúvida de PC, hardware, montagem ou produtos da Setup Ninja — assunto da bancada, beleza?';
  if (!inScope) return 'Esse assunto não pertence à minha bancada. Atendo tecnologia, hardware e produtos da Setup Ninja. Quer comparar uma peça ou tirar uma dúvida de montagem?';
  if (!documents.length) return 'Não achei informação confiável nas fontes consultadas, chefe. Sem chutar especificações: manda o modelo exato ou o componente que quer instalar.';
  const guide = documents.find((doc) => String(doc.category || '').toLowerCase() === GUIDE_CATEGORY);
  if (guide) return renderChatPlan({ mode: 'hardware-guide', guideId: String(guide.guide_id || guide.title), sourceIds: [] }, documents);
  return renderChatPlan({ mode: 'listing', sourceIds: documents.slice(0, 3).map((doc) => String(doc.id)), guideId: null }, documents);
}

export const isGreeting = (text) => /^(?:oi|olá|ola|opa|e aí|e ai|bom dia|boa tarde|boa noite|fala|salve|hello)[!?. ]*$/i.test(String(text || '').trim());
export const isPromptInjection = (text) => /\b(?:ignore|ignora|esqueça|esqueca|desconsidere)\s+(?:todas?\s+)?(?:as\s+)?(?:instru[çc]ões|regras|o prompt|prompt|personagem|sistema)\b/i.test(String(text || ''));
export const normalizedSourceText = normalizeText;
