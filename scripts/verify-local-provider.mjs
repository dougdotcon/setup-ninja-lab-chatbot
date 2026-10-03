import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { normalizeCatalogPayload } from '../server/domain/catalog.js';

const appUrl = process.env.SETUPNINJA_VALIDATE_APP_URL || 'https://setupninja.douvras.com';
const baseUrl = process.env.SETUPNINJA_VALIDATE_BASE_URL || 'http://host.docker.internal:11434/v1';
const model = process.env.SETUPNINJA_VALIDATE_MODEL || 'qwen2.5:0.5b';
const provider = process.env.SETUPNINJA_VALIDATE_PROVIDER || 'ollama';
const reportPath = process.env.SETUPNINJA_VALIDATE_REPORT || '/tmp/setupninja-real-llm-report.json';
const report = { startedAt: new Date().toISOString(), appUrl, provider, model, cases: [] };
const catalog = normalizeCatalogPayload(await (await fetch('https://monte-seu-pc.setupninja.com.br/produtos', { signal: AbortSignal.timeout(20_000) })).json());
const official = new Map(catalog.products.map((item) => [item.id, item]));
async function api(cookie, route, body) {
  const response = await fetch(appUrl + route, { method: body === undefined ? 'GET' : 'POST',
    signal: AbortSignal.timeout(180_000), headers: { ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
function verified(data, ceiling) {
  assert.ok(data.buildId);
  assert.notEqual(data.selected.compatibility.status, 'FAIL');
  const total = data.selected.items.reduce((sum, item) => sum + item.totalPriceCents, 0);
  assert.equal(total, data.selected.totalPriceCents);
  assert.ok(total <= (ceiling ?? data.telemetry.budgetCents));
  for (const item of data.selected.items) {
    const source = official.get(item.id);
    assert.ok(source?.inStock, `SKU indisponível/inventado ${item.id}`);
    assert.ok(item.quantity <= source.stockQuantity);
    assert.equal(item.unitPriceCents, source.priceCents);
    assert.equal(item.totalPriceCents, item.unitPriceCents * item.quantity);
  }
  assert.equal(data.interpretation.called, true);
  assert.equal(data.generation.called, true);
  return Object.fromEntries(data.selected.items.map((item) => [item.category, item]));
}
const cases = [
  { name: 'gamer-5000', request: 'Quero montar um PC gamer de até R$ 5.000.', ceiling: 500_000 },
  { name: 'sem-intel-1440p', request: 'Quero um PC para jogar em 1440p, mas não quero Intel. Até R$ 7.000.', ceiling: 700_000,
    check: (parts) => assert.match(parts.Processador.name, /AMD|Ryzen/i) },
  { name: 'prioridade-gpu', request: 'Tenho R$ 7.000. Prefiro gastar mais na placa de vídeo.', ceiling: 700_000,
    check: (parts) => assert.ok(parts['Placa de vídeo'].unitPriceCents > parts.Processador.unitPriceCents) },
  { name: 'ryzen7-edicao-sem-teto', request: 'Quero um computador com Ryzen 7 e 32 GB de RAM para trabalhar com edição de vídeo.',
    check: (parts, data) => { assert.match(parts.Processador.name, /Ryzen 7/i); assert.ok(parts.Memória.quantity * official.get(parts.Memória.id).attributes.ramCapacity >= 32); assert.equal(data.telemetry.referenceBudget, true); } },
  { name: 'rtx5070-sem-teto', request: 'Monte um PC com uma RTX 5070.',
    check: (parts, data) => { assert.match(parts['Placa de vídeo'].name, /RTX\s*5070/i); assert.equal(data.telemetry.referenceBudget, true); } },
  { name: 'refinamento-preserva32', request: 'Monte um PC gamer de até R$ 6.000 com Ryzen e 32 GB de RAM.', ceiling: 600_000,
    refine: 'Pode trocar a placa de vídeo por uma NVIDIA?', check: (parts) => assert.ok(parts.Memória.quantity * official.get(parts.Memória.id).attributes.ramCapacity >= 32) },
];
const refresh = await api(null, '/api/catalog/sync', {});
assert.equal(refresh.status, 200, JSON.stringify(refresh.data));
let accepted = 0;
let acceptedInterpretations = 0;
for (const scenario of cases) {
  const cookie = (await api(null, '/api/session')).cookie;
  try {
    const config = await api(cookie, '/api/model/config', { provider, model, baseUrl });
    assert.equal(config.status, 200, JSON.stringify(config.data));
    const response = await api(cookie, '/api/build', { request: scenario.request });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    let result = response.data;
    let parts = verified(result, scenario.ceiling);
    scenario.check?.(parts, result);
    if (scenario.refine) {
      const refined = await api(cookie, '/api/build', { request: scenario.refine, previousBuildId: result.buildId });
      assert.equal(refined.status, 200, JSON.stringify(refined.data));
      result = refined.data;
      parts = verified(result, scenario.ceiling);
      scenario.check?.(parts, result);
      assert.match(parts['Placa de vídeo'].name, /NVIDIA|GeForce|RTX|GTX/i);
    }
    if (!result.generation.fallback) accepted += 1;
    if (!result.interpretation.fallback) acceptedInterpretations += 1;
    report.cases.push({ name: scenario.name, passed: true, totalPriceCents: result.selected.totalPriceCents,
      items: result.selected.items, interpretation: result.interpretation, generation: result.generation,
      telemetry: result.telemetry, explanation: result.selected.explanation });
    console.log(`${scenario.name}: total R$ ${(result.selected.totalPriceCents / 100).toFixed(2)}; interpretação=${JSON.stringify(result.interpretation)}; geração=${JSON.stringify(result.generation)}`);
  } catch (error) {
    report.cases.push({ name: scenario.name, passed: false, error: error.message });
    console.log(`${scenario.name}: FAIL ${error.message}`);
  } finally { await api(cookie, '/api/model/disconnect', {}); }
}
const cookie = (await api(null, '/api/session')).cookie;
try {
  await api(cookie, '/api/model/config', { provider, model, baseUrl });
  const impossible = await api(cookie, '/api/build', { request: 'Monte um PC com RTX 5070 de até R$ 5.000.' });
  assert.equal(impossible.status, 422);
  report.cases.push({ name: 'rtx5070-orcamento-impossivel', passed: true, error: impossible.data.error });
  const guide = await api(cookie, '/api/chat', { message: 'Como instalar memória RAM no PC com segurança?' });
  assert.equal(guide.status, 200);
  assert.equal(guide.data.telemetry.providerCalled, true);
  assert.ok(guide.data.telemetry.mode.startsWith('api') && !guide.data.telemetry.mode.includes('fallback'));
  assert.ok(guide.data.citations.some((source) => source.url?.includes('kingston.com')), 'o guia deve citar a fonte técnica recuperada');
  assert.match(guide.data.answer, /RAM|memória/i);
  report.cases.push({ name: 'guia-hardware-rag', passed: true, ...guide.data });
  const offTopic = await api(cookie, '/api/chat', { message: 'E qual é a melhor receita de bolo?' });
  assert.equal(offTopic.data.telemetry.outcome, 'fora_escopo');
  assert.equal(offTopic.data.telemetry.providerCalled, false);
  report.cases.push({ name: 'follow-up-fora-escopo', passed: true, ...offTopic.data });
} catch (error) {
  report.cases.push({ name: 'rag-e-recusa', passed: false, error: error.message });
} finally { await api(cookie, '/api/model/disconnect', {}); }
report.acceptedModelGenerations = accepted;
report.acceptedModelInterpretations = acceptedInterpretations;
report.finishedAt = new Date().toISOString();
writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`Evidência salva em ${reportPath}; respostas estruturadas aceitas: ${accepted}`);
assert.ok(accepted > 0, 'o runtime real precisa gerar ao menos uma resposta aceita, não apenas fallback');
assert.ok(acceptedInterpretations > 0, 'o runtime real precisa interpretar ao menos uma solicitação sem fallback');
assert.ok(report.cases.every((item) => item.passed), 'existem falhas nos cenários reais');
