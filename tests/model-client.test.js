import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createModelClient } from '../server/infrastructure/model-client.js';

async function invokeTimeout({ provider, baseUrl, env = {} }) {
  let requestTimeout;
  const fakeRequest = (options, onResponse) => {
    requestTimeout = options.timeout;
    const request = new EventEmitter();
    request.end = () => queueMicrotask(() => {
      const response = new EventEmitter();
      response.statusCode = 200;
      onResponse(response);
      response.emit('data', Buffer.from(JSON.stringify({ choices: [{ message: { content: '{}' } }] })));
      response.emit('end');
    });
    request.destroy = (error) => request.emit('error', error);
    return request;
  };
  const client = createModelClient({ env: { SETUPNINJA_LOCAL_LLM_URLS: 'http://127.0.0.1:11434/v1', ...env },
    lookup: async () => [{ address: '8.8.8.8', family: 4 }],
    httpRequest: fakeRequest, httpsRequest: fakeRequest });
  await client.complete({ provider, baseUrl, model: 'mock-model' }, [], 20, true);
  return requestTimeout;
}

test('model client uses longer default timeout for local providers and configurable bounded override', async () => {
  assert.equal(await invokeTimeout({ provider: 'ollama', baseUrl: 'http://127.0.0.1:11434/v1' }), 60_000);
  assert.equal(await invokeTimeout({ provider: 'openai', baseUrl: 'https://llm.example/v1' }), 25_000);
  assert.equal(await invokeTimeout({ provider: 'lmstudio', baseUrl: 'http://127.0.0.1:11434/v1',
    env: { SETUPNINJA_LLM_TIMEOUT_MS: '5000' } }), 5_000);
  assert.equal(await invokeTimeout({ provider: 'ollama', baseUrl: 'http://127.0.0.1:11434/v1',
    env: { SETUPNINJA_LLM_TIMEOUT_MS: '180000' } }), 120_000);
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
