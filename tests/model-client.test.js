import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createModelClient } from '../server/infrastructure/model-client.js';

async function invokeModel({ provider, baseUrl, env = {}, format = true }) {
  let requestTimeout;
  let responseFormat;
  const fakeRequest = (options, onResponse) => {
    requestTimeout = options.timeout;
    const request = new EventEmitter();
    request.end = (body) => {
      responseFormat = JSON.parse(body).response_format;
      queueMicrotask(() => {
      const response = new EventEmitter();
      response.statusCode = 200;
      onResponse(response);
      response.emit('data', Buffer.from(JSON.stringify({ choices: [{ message: { content: '{}' } }] })));
      response.emit('end');
      });
    };
    request.destroy = (error) => request.emit('error', error);
    return request;
  };
  const client = createModelClient({ env: { SETUPNINJA_LOCAL_LLM_URLS: 'http://127.0.0.1:11434/v1', ...env },
    lookup: async () => [{ address: '8.8.8.8', family: 4 }],
    httpRequest: fakeRequest, httpsRequest: fakeRequest });
  await client.complete({ provider, baseUrl, model: 'mock-model' }, [], 20, format);
  return { requestTimeout, responseFormat };
}

test('model client uses longer default timeout for local providers and configurable bounded override', async () => {
  assert.equal((await invokeModel({ provider: 'ollama', baseUrl: 'http://127.0.0.1:11434/v1' })).requestTimeout, 60_000);
  assert.equal((await invokeModel({ provider: 'openai', baseUrl: 'https://llm.example/v1' })).requestTimeout, 25_000);
  assert.equal((await invokeModel({ provider: 'lmstudio', baseUrl: 'http://127.0.0.1:11434/v1',
    env: { SETUPNINJA_LLM_TIMEOUT_MS: '5000' } })).requestTimeout, 5_000);
  assert.equal((await invokeModel({ provider: 'ollama', baseUrl: 'http://127.0.0.1:11434/v1',
    env: { SETUPNINJA_LLM_TIMEOUT_MS: '180000' } })).requestTimeout, 120_000);
});

test('structured schemas are sent to providers with support; generic OpenAI-compatible falls back to JSON mode', async () => {
  const format = { name: 'tiny', schema: { type: 'object', additionalProperties: false,
    properties: { answer: { type: 'string', enum: ['ok'] } }, required: ['answer'] } };
  const expected = { type: 'json_schema', json_schema: { name: 'tiny', strict: true, schema: format.schema } };
  for (const [provider, baseUrl] of [['openai', 'https://llm.example/v1'],
    ['ollama', 'http://127.0.0.1:11434/v1'], ['lmstudio', 'http://127.0.0.1:11434/v1']]) {
    const result = await invokeModel({ provider, baseUrl, format });
    assert.deepEqual(result.responseFormat, expected, `${provider} must receive the closed schema`);
  }
  const compatible = await invokeModel({ provider: 'openai-compatible', baseUrl: 'https://llm.example/v1', format });
  assert.deepEqual(compatible.responseFormat, { type: 'json_object' });
});

test('model client reports timeout distinctly so callers can fall back cleanly', async () => {
  const client = createModelClient({ env: { SETUPNINJA_LOCAL_LLM_URLS: 'http://127.0.0.1:11434/v1' },
    httpRequest: () => {
      const request = new EventEmitter();
      request.end = () => queueMicrotask(() => request.emit('timeout'));
      request.destroy = (error) => request.emit('error', error);
      return request;
    } });
  await assert.rejects(client.complete({ provider: 'ollama', baseUrl: 'http://127.0.0.1:11434/v1', model: 'mock' }, []), /provider-timeout/);
});
