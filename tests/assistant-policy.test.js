import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allowedBuildReasons, buildReasonSchema, chatPlanSchema, createChatPlanMessages, createInterpretationMessages,
  INTERPRETATION_SCHEMA, isAllowedContextualFollowup, isHardwareScope,
  renderBuildExplanation, renderChatPlan, validateBuildPlan, validateChatPlan,
  validateInterpretation,
} from '../server/application/assistant-policy.js';

const product = { id: 17, product_id: '123', title: 'SSD 1 TB modelo oficial', category: 'Armazenamento',
  content: 'SSD informado no catálogo.', attributes_json: '{"socket":"AM4","tdp":65}',
  source_title: 'API oficial Setup Ninja', source_url: 'https://monte-seu-pc.setupninja.com.br/produtos', price_brl: 399.9 };
const guide = { id: 26, product_id: null, guide_id: 'desktop-memory-install', title: 'Instalar memória RAM em um desktop',
  category: 'Guias de hardware', content: 'Desligue e desconecte a energia.', source_title: 'Kingston Technology',
  source_url: 'https://www.kingston.com/en/support/technical/how-to-install-memory-desktop-pc', price_brl: null };
const otherGuide = { ...guide, id: 27, guide_id: 'bios-cpu-support', title: 'Verificar BIOS' };

test('chat model can choose only retrieved source IDs and a closed answer mode', () => {
  const docs = [product, guide];
  const messages = createChatPlanMessages({ query: 'Como instalar memória?', documents: docs });
  assert.match(messages[0].content, /Não escreva a resposta ao cliente nem invente fatos/);
  assert.match(messages[0].content, /\{"mode":"clarification","sourceIds":\[\],"guideId":null\}/);
  assert.doesNotMatch(messages[0].content, /"mode":"listing\|comparison/);
  const accepted = validateChatPlan(JSON.stringify({ mode: 'listing', sourceIds: ['17'], guideId: null }), docs);
  assert.ok(accepted);
  const rendered = renderChatPlan(accepted, docs);
  assert.match(rendered, /SSD 1 TB modelo oficial/);
  assert.match(rendered, /R\$\s+399,90/);
  assert.match(rendered, /Soquete: AM4/);
  assert.doesNotMatch(rendered, /RTX 9999|1000 núcleos|1000 FPS/i);
  assert.equal(validateChatPlan('Sou ChatGPT. RTX 9999 tem 1000 FPS.', docs), null);
  assert.equal(validateChatPlan(JSON.stringify({ mode: 'listing', sourceIds: ['999'], guideId: null }), docs), null);
  assert.equal(validateChatPlan(JSON.stringify({ mode: 'hardware-guide', sourceIds: [], guideId: 'invented-guide' }), docs), null);
  assert.equal(validateChatPlan(JSON.stringify({ mode: 'hardware-guide', sourceIds: ['27'], guideId: 'desktop-memory-install' }), [guide, otherGuide]), null);
  assert.equal(validateChatPlan(JSON.stringify({ mode: 'comparison', sourceIds: ['17'], guideId: 'desktop-memory-install' }), docs), null);
});

test('hardware-guide answer is composed from a retrieved, cited guide', () => {
  const plan = validateChatPlan(JSON.stringify({ mode: 'hardware-guide', sourceIds: ['26'], guideId: 'desktop-memory-install' }), [guide]);
  assert.ok(plan);
  const answer = renderChatPlan(plan, [guide]);
  assert.match(answer, /desconecte a energia/);
  assert.match(answer, /Kingston Technology/);
  assert.doesNotMatch(answer, /1000 FPS|compatível com qualquer/i);
});

test('build explanation rejects free text and renders only allowed, validated reasons', () => {
  const candidate = { parts: { processor: { name: 'Ryzen 7 7700', priceCents: 2_000_00 }, memory: [] },
    totalPriceCents: 2_000_00, compatibility: { status: 'UNKNOWN' }, unknownRules: ['motherboard-bios-support'] };
  const allowed = allowedBuildReasons(candidate, { purpose: 'workstation', memoryGB: 32 });
  assert.ok(allowed.includes('workstation-focus'));
  assert.equal(validateBuildPlan('Ryzen 7 has 1000 FPS and 900W.', allowed), null);
  assert.equal(validateBuildPlan('{bad json', allowed), null);
  assert.equal(validateBuildPlan(JSON.stringify({ reasons: ['invented-benchmark'] }), allowed), null);
  const plan = validateBuildPlan(JSON.stringify({ reasons: ['workstation-focus', 'review-unknowns'] }), allowed);
  assert.ok(plan);
  const answer = renderBuildExplanation(candidate, 3_000_00, plan.reasons);
  assert.match(answer, /uso de trabalho informado/);
  assert.match(answer, /Dados não publicados/);
  assert.doesNotMatch(answer, /1000 FPS|900W/);
});

test('interpretation validates exact JSON schema with null for absent preferences', () => {
  assert.deepEqual(INTERPRETATION_SCHEMA.schema.required,
    ['purpose', 'memoryGB', 'dedicatedGpu', 'preferredVendor', 'preferredCpu']);
  assert.equal(INTERPRETATION_SCHEMA.schema.additionalProperties, false);
  assert.deepEqual(INTERPRETATION_SCHEMA.schema.properties.purpose.enum, ['gaming', 'general', 'workstation', null]);
  assert.deepEqual(INTERPRETATION_SCHEMA.schema.properties.preferredVendor.enum, ['amd', 'intel', null]);
  const interpretationMessages = createInterpretationMessages('Quero um PC com 32 GB.');
  assert.match(interpretationMessages[0].content, /Extraia preferências explícitas/);
  assert.match(interpretationMessages[0].content, /\{"purpose":null,"memoryGB":null,"dedicatedGpu":null,"preferredVendor":null,"preferredCpu":null\}/);
  assert.doesNotMatch(interpretationMessages[0].content, /"purpose":"gaming\|general/);
  assert.equal(interpretationMessages[1].content, 'Quero um PC com 32 GB.');
  assert.deepEqual(validateInterpretation(JSON.stringify({ purpose: null, memoryGB: null, dedicatedGpu: null,
    preferredVendor: null, preferredCpu: null })), { purpose: null, memoryGB: null, dedicatedGpu: null, preferredVendor: null, preferredCpu: null });
  assert.equal(validateInterpretation('{bad json'), null);
  assert.equal(validateInterpretation(JSON.stringify({ purpose: 'gaming', memoryGB: 16, dedicatedGpu: false,
    preferredVendor: null, preferredCpu: null, budgetCents: 100 })), null);
  assert.equal(validateInterpretation(JSON.stringify({ purpose: 'gaming', memoryGB: 1, dedicatedGpu: false,
    preferredVendor: null, preferredCpu: null })), null);
});

test('dynamic reason and chat schemas restrict enum values to validated candidates and retrieved sources', () => {
  const allowed = ['within-budget', 'memory-target'];
  assert.deepEqual(buildReasonSchema(allowed).schema.properties.reasons.items.enum, allowed);
  assert.equal(buildReasonSchema(allowed).schema.properties.reasons.maxItems, 3);
  const schema = chatPlanSchema([product, guide]);
  assert.equal(schema.schema.additionalProperties, false);
  assert.deepEqual(schema.schema.properties.mode.enum, ['listing', 'comparison', 'hardware-guide', 'clarification']);
  assert.deepEqual(schema.schema.properties.sourceIds.items.enum, ['17', '26']);
  assert.equal(schema.schema.properties.sourceIds.maxItems, 4);
  assert.deepEqual(schema.schema.properties.guideId.enum, ['desktop-memory-install', null]);
  assert.equal(validateBuildPlan(JSON.stringify({ reasons: ['invented-benchmark'] }), allowed), null);
  assert.equal(validateChatPlan(JSON.stringify({ mode: 'listing', sourceIds: ['999'], guideId: null }), [product, guide]), null);
});

test('contextual follow-up does not turn unrelated questions into hardware scope', () => {
  assert.equal(isAllowedContextualFollowup('E qual deles consome menos?'), true);
  assert.equal(isAllowedContextualFollowup('Qual é a capital do país?'), false);
  assert.equal(isAllowedContextualFollowup('E qual país venceu a copa?'), false);
});


test('generic verbs stay out of scope unless a hardware noun or trusted follow-up anchors them', () => {
  assert.equal(isHardwareScope('Como instalar chuveiro?'), false);
  assert.equal(isAllowedContextualFollowup('Como instalo isso?'), true);
  assert.equal(isAllowedContextualFollowup('Esse bolo foi com quais ingredientes?'), false);
  assert.equal(isAllowedContextualFollowup('Esse filme foi legal?'), false);
  assert.equal(isHardwareScope('Como instalar memória RAM?'), true);
});
