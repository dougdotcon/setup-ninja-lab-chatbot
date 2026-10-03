import test from 'node:test';
import assert from 'node:assert/strict';
import { createTypesafeJevDecisionProvider } from '../server/infrastructure/typesafe-jev.js';

test('Typesafe Jev adapter sends a closed candidate choice through injected transport', async () => {
  let sent;
  const provider = createTypesafeJevDecisionProvider({ endpoint: 'https://jev.test/v1/systemone', timeout: () => undefined,
    fetchImpl: async (url, options) => {
      sent = { url, options, body: JSON.parse(options.body) };
      return { ok: true, json: async () => ({ model: 'jev-mock', answers: { selection: { type: 'choice', choice: 'candidate-1', confidence: 0.91 } }, usage: { input_tokens: 12, output_tokens: 3 } }) };
    } });
  const candidate = { id: 'candidate-1', totalPriceCents: 500_000, compatibility: { status: 'UNKNOWN' },
    unknownRules: ['motherboard-bios-support'], parts: { processor: { name: 'Ryzen CPU' }, graphicsCard: null } };
  const result = await provider.choose({ apiKey: 'mock-key', model: 'jev-mock' }, 'PC até 5 mil', { budgetCents: 500_000 }, [candidate]);
  assert.equal(result.candidateId, 'candidate-1');
  assert.equal(result.confidence, 0.91);
  assert.equal(result.inputTokens, 12);
  assert.equal(sent.url, 'https://jev.test/v1/systemone');
  assert.equal(sent.options.method, 'POST');
  assert.equal(sent.body.questions.selection.type, 'choice');
  assert.deepEqual(sent.body.state.candidates.map((item) => item.id), ['candidate-1']);
});

test('Typesafe Jev adapter rejects malformed choice payloads for deterministic fallback', async () => {
  const provider = createTypesafeJevDecisionProvider({ timeout: () => undefined,
    fetchImpl: async () => ({ ok: true, json: async () => ({ answers: { selection: { type: 'text', text: 'candidate-1' } } }) }) });
  await assert.rejects(provider.choose({ apiKey: 'mock' }, '', {}, []), /decision-invalid/);
});
