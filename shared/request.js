export const normalizeRequest = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function parseBrazilianBudget(text) {
  const normalized = normalizeRequest(text);
  const match = normalized.match(/(?:ate|maximo|orcamento|budget|limite|tenho)\s*(?:de)?\s*(?:r\$\s*)?([0-9][0-9.,]*)(?:\s*(mil))?|r\$\s*([0-9][0-9.,]*)(?:\s*(mil))?/i);
  if (!match) return null;
  const raw = match[1] || match[3];
  const decimal = /,\d{1,2}$/.test(raw) ? raw.replaceAll('.', '').replace(',', '.') : raw.replaceAll('.', '');
  const amount = Number(decimal) * ((match[2] || match[4]) ? 1000 : 1);
  return Number.isFinite(amount) && amount >= 100 && amount <= 1_000_000 ? Math.round(amount * 100) : null;
}

export function interpretRequest(text) {
  const normalized = normalizeRequest(text);
  const excludedVendors = [];
  for (const vendor of ['intel', 'amd']) {
    if (new RegExp(`\\b(?:nao\\s+quero|sem|evit(?:e|ar)|exclu(?:a|ir))\\s+(?:(?:um|uma|processador|cpu|placa|da|do)\\s+){0,3}${vendor}\\b`).test(normalized)) excludedVendors.push(vendor);
  }
  const preferredVendor = /\bryzen\b|\bamd\b/.test(normalized) && !excludedVendors.includes('amd') ? 'amd'
    : /\bintel\b/.test(normalized) && !excludedVendors.includes('intel') ? 'intel' : null;
  const memoryGB = Number(normalized.match(/\b(\d{1,3})\s*(?:gb|giga(?:bytes?)?)\s*(?:de\s*)?(?:ram|memoria)?\b/)?.[1]) || null;
  const purpose = /\b(?:jog\w*|gam\w*|fps|1440p|1080p|4k)\b/.test(normalized) ? 'gaming'
    : /\b(?:edit\w*|video|render\w*|workstation|trabalh\w*)\b/.test(normalized) ? 'workstation' : null;
  const gpuPriority = /(?:prefir\w*|prioriz\w*|gastar\s+mais|investir\s+mais).{0,55}(?:placa\s+de\s+video|gpu|grafica)/.test(normalized);
  return { excludedVendors, preferredVendor, memoryGB, purpose, gpuPriority, budgetCents: parseBrazilianBudget(text) };
}

export function isPcBuildIntent(text, hasPreviousBuild = false) {
  const normalized = normalizeRequest(text);
  if (interpretRequest(text).gpuPriority && parseBrazilianBudget(text) !== null) return true;
  if (/\b(?:mont\w*|configur\w*|setup|computador|pc)\b/.test(normalized) &&
      /\b(?:mont\w*|configur\w*|setup|computador|pc|ryzen|rtx|orcamento|ate\s+r\$)\b/.test(normalized)) return true;
  if (/\b(?:troqu\w*|mud\w*|substitu\w*|upgrade|agora\s+quero)\b/.test(normalized) && hasPreviousBuild) return true;
  return hasPreviousBuild && /\b(?:\d{1,3}\s*gb|nvidia|amd|intel|ryzen|rtx|gtx|radeon|gpu|fonte|ssd|gabinete|cooler)\b/.test(normalized);
}
