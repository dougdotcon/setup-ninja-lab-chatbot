const defaultEndpoint = 'https://api.typesafe.ai/v1/systemone';

export function createTypesafeJevDecisionProvider({
  fetchImpl = globalThis.fetch,
  endpoint = defaultEndpoint,
  timeout = (milliseconds) => AbortSignal.timeout(milliseconds),
} = {}) {
  return {
    async choose(config, request, requirements, candidates) {
      const criteria = Object.fromEntries(candidates.map((candidate) => [candidate.id,
        `Total ${candidate.totalPriceCents} centavos; CPU ${candidate.parts.processor.name}; GPU ${candidate.parts.graphicsCard?.name || 'integrado'}; regras ${candidate.compatibility.status}; incertezas ${candidate.unknownRules.join(', ') || 'nenhuma'}.`]));
      const response = await fetchImpl(endpoint, { method: 'POST', redirect: 'error', signal: timeout(12_000),
        headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ model: config.model || 'jev-latest', state: { userRequest: request, requirements,
          candidates: candidates.map((item) => ({ id: item.id, totalPriceCents: item.totalPriceCents, compatibility: item.compatibility.status })) },
        questions: { selection: { type: 'choice', instructions: 'Escolha a montagem mais adequada ao pedido, respeitando o teto e as preferências declaradas. Entre opções viáveis, considere a adequação para o objetivo e as incertezas publicadas.', criteria } } }) });
      if (!response.ok) throw Error('decision-provider-failed');
      const data = await response.json();
      const answer = data?.answers?.selection;
      if (!answer || answer.type !== 'choice' || typeof answer.choice !== 'string') throw Error('decision-invalid');
      return { candidateId: answer.choice, confidence: Number(answer.confidence), model: String(data.model || config.model || 'jev-latest'),
        inputTokens: Number.isFinite(data.usage?.input_tokens) ? data.usage.input_tokens : null,
        outputTokens: Number.isFinite(data.usage?.output_tokens) ? data.usage.output_tokens : null };
    },
  };
}

export const defaultTypesafeJev = createTypesafeJevDecisionProvider();
