import { request as defaultHttpsRequest } from 'node:https';
import { request as defaultHttpRequest } from 'node:http';
import { lookup as defaultLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export function createModelClient({
  env = process.env,
  lookup = defaultLookup,
  httpsRequest = defaultHttpsRequest,
  httpRequest = defaultHttpRequest,
} = {}) {
  function publicAddress(address) {
    const family = isIP(address);
    if (family === 6) return /^2[0-9a-f]{3}:/i.test(address) && !/^2001:db8:/i.test(address);
    if (family !== 4) return false;
    const [a, b, c] = address.split('.').map(Number);
    return a !== 0 && a !== 10 && a !== 127 && a < 224
      && !(a === 100 && b >= 64 && b <= 127) && !(a === 169 && b === 254)
      && !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && b === 168)
      && !(a === 192 && b === 0 && (c === 0 || c === 2))
      && !(a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
      && !(a === 203 && b === 0 && c === 113);
  }

  async function verifyHttps(raw) {
    if (typeof raw !== 'string' || raw.length > 500) throw Error('Use uma URL HTTPS pública válida.');
    let url;
    try { url = new URL(raw); } catch { throw Error('Use uma URL HTTPS pública válida.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
      throw Error('Use somente HTTPS público, sem senha nem parâmetros.');
    }
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    if (hostname === 'localhost' || /\.(localhost|internal|local)$/.test(hostname)) throw Error('Endereços privados não são permitidos.');
    const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }]
      : await lookup(hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some((record) => !publicAddress(record.address))) throw Error('A URL precisa resolver para endereços públicos.');
    return { url, address: addresses[0], hostname };
  }

  function localEndpoint(baseUrl) {
    const permitted = String(env.SETUPNINJA_LOCAL_LLM_URLS || '').split(',').map((item) => item.trim()).filter(Boolean);
    let url;
    try { url = new URL(baseUrl); } catch { return null; }
    if (!permitted.includes(url.origin + url.pathname.replace(/\/$/, ''))) return null;
    if (url.protocol !== 'http:' || !['host.docker.internal', 'localhost', '127.0.0.1'].includes(url.hostname) || url.username || url.password || url.search || url.hash) return null;
    return url;
  }

  function timeoutFor(isLocal) {
    const configured = Number(env.SETUPNINJA_LLM_TIMEOUT_MS);
    if (Number.isFinite(configured) && configured > 0) return Math.min(120_000, Math.max(5_000, Math.round(configured)));
    return isLocal ? 60_000 : 25_000;
  }

  function complete(config, messages, maxTokens = 500, jsonMode = false) {
    const local = ['ollama', 'lmstudio'].includes(config.provider) ? localEndpoint(config.baseUrl) : null;
    const endpoint = local ? Promise.resolve({ url: local, address: null, hostname: local.hostname, requestFn: httpRequest })
      : verifyHttps(config.baseUrl).then((result) => ({ ...result, requestFn: httpsRequest }));
    return endpoint.then(({ url, address, hostname, requestFn }) => new Promise((resolve, reject) => {
      const body = JSON.stringify({ model: config.model, messages, max_tokens: maxTokens, temperature: 0.22,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}) });
      const request = requestFn({
        hostname, port: Number(url.port || 443),
        path: url.pathname.replace(/\/+$/, '') + '/chat/completions', method: 'POST',
        servername: isIP(hostname) ? undefined : hostname, timeout: timeoutFor(Boolean(local)), agent: false,
        ...(address ? { lookup(_host, options, callback) {
          if (options?.all) return callback(null, [address]);
          callback(null, address.address, address.family);
        } } : {}),
        headers: { ...(config.apiKey ? { authorization: 'Bearer ' + config.apiKey } : {}), 'content-type': 'application/json',
          accept: 'application/json', 'content-length': Buffer.byteLength(body), 'user-agent': 'SetupNinja-Demo/1.0' },
      }, (response) => {
        let size = 0;
        const chunks = [];
        response.on('data', (chunk) => {
          size += chunk.length;
          if (size > 256_000) return request.destroy(Error('response-too-large'));
          chunks.push(chunk);
        });
        response.on('end', () => {
          if (response.statusCode < 200 || response.statusCode >= 300) return reject(Error('provider-failed'));
          let data;
          try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
          catch { return reject(Error('provider-invalid-json')); }
          const answer = data?.choices?.[0]?.message?.content;
          if (typeof answer !== 'string' || !answer.trim()) return reject(Error('provider-empty-answer'));
          resolve({ answer: answer.trim().slice(0, 6200),
            inputTokens: Number.isFinite(data.usage?.prompt_tokens) ? data.usage.prompt_tokens : null,
            outputTokens: Number.isFinite(data.usage?.completion_tokens) ? data.usage.completion_tokens : null });
        });
      });
      request.on('timeout', () => request.destroy(Error('provider-timeout')));
      request.on('error', (error) => reject(error?.message === 'provider-timeout' ? error : Error('provider-unavailable')));
      request.on('response', (response) => { if (response.statusCode >= 300 && response.statusCode < 400) response.destroy(); });
      request.end(body);
    }));
  }

  return { complete, localEndpoint, verifyHttps };
}

export const defaultModelClient = createModelClient();
