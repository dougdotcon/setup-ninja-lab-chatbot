import { request as defaultHttpsRequest } from 'node:https';

export function createOfficialCatalogClient({ verifyHttps, httpsRequest = defaultHttpsRequest } = {}) {
  if (typeof verifyHttps !== 'function') throw new TypeError('verifyHttps é obrigatório.');
  return {
    fetch() {
      return verifyHttps('https://monte-seu-pc.setupninja.com.br/produtos').then(({ url, address, hostname }) => new Promise((resolve, reject) => {
        const request = httpsRequest({ hostname, port: 443, path: url.pathname, method: 'GET', servername: hostname,
          timeout: 12_000, headers: { accept: 'application/json', 'user-agent': 'SetupNinja-Catalog-Sync/1.0' },
          lookup(_host, options, callback) {
            if (options?.all) return callback(null, [address]);
            callback(null, address.address, address.family);
          } }, (response) => {
          if (response.statusCode !== 200) { response.resume(); return reject(Error('catalog-http-error')); }
          let size = 0;
          const chunks = [];
          response.on('data', (chunk) => {
            size += chunk.length;
            if (size > 8_000_000) request.destroy(Error('catalog-too-large'));
            else chunks.push(chunk);
          });
          response.on('end', () => {
            try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
            catch { reject(Error('catalog-invalid-json')); }
          });
        });
        request.on('timeout', () => request.destroy(Error('catalog-timeout')));
        request.on('error', () => reject(Error('catalog-unavailable')));
        request.on('response', (response) => { if (response.statusCode >= 300 && response.statusCode < 400) response.destroy(); });
        request.end();
      }));
    },
  };
}
