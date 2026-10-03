import { checkBuildCompatibility, cpuVendor } from './compatibility.js';

const attr = (product, key) => product?.attributes?.[key];
const dollars = (product) => Number(product?.priceCents);
const available = (product) => product?.inStock === true && Number(product.stockQuantity) > 0 && Number.isInteger(dollars(product));
const sorted = (list) => list.filter(available).sort((a, b) => dollars(a) - dollars(b));
const priceSpread = (list, count) => {
  if (list.length <= count) return list;
  const spread = Array.from({ length: count }, (_, index) => list[Math.round(index * (list.length - 1) / (count - 1))]);
  return [...new Map(spread.map((part) => [part.id, part])).values()];
};
const byCategory = (products, key) => sorted(products.filter((product) => product.categoryKeys?.includes(key)));
const asPart = (product, quantity = 1) => ({ ...product, quantity });
const total = (build) => Object.values(build).flatMap((value) => Array.isArray(value) ? value : value ? [value] : [])
  .reduce((sum, part) => sum + dollars(part) * Number(part.quantity || 1), 0);

function ramChoice(products, board, cpu, targetGB, exceptions, requiredId = null) {
  const boardCapacity = Number(attr(board, 'maxRamCapacity')) || Infinity;
  const slots = Number(attr(board, 'ramSlotsQuantity')) || Infinity;
  const ramType = String(attr(board, 'ramType') || '').toLowerCase();
  return byCategory(products, 'memoria').filter((ram) => !requiredId || String(ram.id) === String(requiredId)).flatMap((ram) => {
    const ramException = exceptions.find((item) => String(item.id) === String(ram.id));
    const allowed = ramException?.moboCompatibility?.map((item) => item.toLowerCase());
    if (allowed && !allowed.includes(cpuVendor(cpu))) return [];
    const capacity = Number(attr(ram, 'ramCapacity')) || 0;
    const modules = Number(attr(ram, 'modulesQuantity')) || 1;
    const type = String(attr(ram, 'ramType') || attr(ram, 'memoryType') || ram.name.match(/DDR[345]/i)?.[0] || '').toLowerCase();
    if (!capacity || (ramType && type && type !== ramType)) return [];
    const quantity = Math.max(1, Math.ceil(targetGB / capacity));
    if (quantity * modules > slots || quantity * capacity > boardCapacity || quantity > ram.stockQuantity) return [];
    return [{ product: asPart(ram, quantity), score: dollars(ram) * quantity }];
  }).sort((a, b) => a.score - b.score).slice(0, 4).map((item) => item.product);
}

function cheapestCompatible(list, test) {
  return sorted(list).find(test) || null;
}

/** Creates bounded complete candidates; every price and stock value comes from the official snapshot. */
export function buildCandidates({ products, exceptions = [], budgetCents = Infinity, purpose = 'general', memoryGB = 16,
  dedicatedGpu = false, preferredVendor = null, preferredCpu = null, preferredGpuId = null, excludedVendors = [],
  requiredParts = {}, limit = 4 } = {}) {
  const components = Array.isArray(products) ? products : [];
  let processors = byCategory(components, 'processador');
  let motherboards = byCategory(components, 'placaMae');
  let gpus = dedicatedGpu ? byCategory(components, 'placaDeVideo') : [null];
  if (preferredVendor) processors = processors.filter((cpu) => cpuVendor(cpu) === preferredVendor);
  if (excludedVendors.length) processors = processors.filter((cpu) => !excludedVendors.includes(cpuVendor(cpu)));
  if (preferredCpu) processors = processors.filter((cpu) => String(cpu.name).toLowerCase().includes(String(preferredCpu).toLowerCase()));
  if (preferredGpuId) gpus = gpus.filter((gpu) => gpu && String(gpu.id) === String(preferredGpuId));
  for (const [key, id] of Object.entries(requiredParts)) {
    if (key === 'processor') processors = processors.filter((part) => String(part.id) === String(id));
    if (key === 'graphicsCard') gpus = gpus.filter((part) => part && String(part.id) === String(id));
  }
  processors = priceSpread(processors, 32);
  if (dedicatedGpu && !preferredGpuId && gpus.length > 20) {
    const spread = Array.from({ length: 20 }, (_, index) => gpus[Math.round(index * (gpus.length - 1) / 19)]);
    gpus = [...new Map(spread.map((part) => [part.id, part])).values()];
  }
  motherboards = motherboards.filter((part) => !requiredParts.motherboard || String(part.id) === String(requiredParts.motherboard));
  if (!requiredParts.motherboard) {
    const cheapestByPlatform = new Map();
    for (const board of motherboards) {
      const key = `${String(attr(board, 'socket') || '').toLowerCase()}:${String(attr(board, 'ramType') || '').toLowerCase()}`;
      if (!cheapestByPlatform.has(key)) cheapestByPlatform.set(key, board);
    }
    motherboards = [...new Map([...priceSpread(motherboards, 36), ...cheapestByPlatform.values()].map((board) => [board.id, board])).values()];
  } else motherboards = motherboards.slice(0, 1);
  if (requiredParts.motherboard) motherboards = motherboards.filter((part) => String(part.id) === String(requiredParts.motherboard));
  const powerSupplies = byCategory(components, 'fonte').filter((part) => !requiredParts.powerSupply || String(part.id) === String(requiredParts.powerSupply));
  const cases = byCategory(components, 'gabinete').filter((part) => !requiredParts.case || String(part.id) === String(requiredParts.case));
  const storage = byCategory(components, 'armazenamento').filter((part) => !requiredParts.storage || String(part.id) === String(requiredParts.storage));
  const coolers = byCategory(components, 'coolerParaProcessador').filter((part) => !requiredParts.cooler || String(part.id) === String(requiredParts.cooler));
  const candidates = [];
  const game = /gam(?:e|ing)|jogo|gamer|render|3d/i.test(purpose);

  for (const processor of processors) {
    if (preferredVendor && cpuVendor(processor) !== preferredVendor) continue;
    for (const motherboard of motherboards) {
      const cpuSocket = attr(processor, 'socket')?.toLowerCase();
      const boardSocket = attr(motherboard, 'socket')?.toLowerCase();
      if (cpuSocket && boardSocket && cpuSocket !== boardSocket) continue;
      const memoryChoices = ramChoice(components, motherboard, processor, Math.max(8, Number(memoryGB) || 16), exceptions, requiredParts.memory);
      if (!memoryChoices.length) continue;
      if (!cases.length || !storage.length) continue;
      for (const memoryPart of memoryChoices) for (const graphicsCard of gpus) {
        if (!graphicsCard && attr(processor, 'hasGpu') === false) continue;
        const build = { processor: asPart(processor), motherboard: asPart(motherboard), memory: [memoryPart],
          graphicsCard: graphicsCard ? asPart(graphicsCard) : null };
        const requirements = [...(attr(processor, 'minimumPowerSupply') || []), ...(attr(graphicsCard, 'minimumPowerSupply') || [])];
        const minWatts = Math.max(0, ...requirements.map(Number).filter(Number.isFinite));
        const needsPfc = requirements.some((value) => String(value).toLowerCase() === 'pfc');
        const processorTdp = Number(attr(processor, 'tdp')) || 0;
        build.powerSupply = cheapestCompatible(powerSupplies, (psu) => {
          const watts = Number(String(psu.name).match(/\b(\d{3,4})\s*w(?:att)?\b/i)?.[1]) || 0;
          const pfc = typeof attr(psu, 'hasPFC') === 'boolean' ? attr(psu, 'hasPFC') : null;
          const tdpLimit = Number(attr(psu, 'maxCpuTdp')) || 0;
          return (!minWatts || !watts || watts >= minWatts) && (!needsPfc || pfc !== false) &&
            (!processorTdp || !tdpLimit || tdpLimit >= processorTdp);
        });
        if (!build.powerSupply) continue;
        build.powerSupply = asPart(build.powerSupply);
        build.case = cases.find((item) => !graphicsCard || !attr(graphicsCard, 'maxGpuSize') || !attr(item, 'maxGpuSize') || attr(graphicsCard, 'maxGpuSize') <= attr(item, 'maxGpuSize')) || cases[0] || null;
        build.case = build.case ? asPart(build.case) : null;
        build.storage = storage[0] ? asPart(storage[0]) : null;
        if (attr(processor, 'hasCooler') === false) {
          build.cooler = cheapestCompatible(coolers, (cooler) => {
            const sockets = (attr(cooler, 'sockets') || []).map((item) => item.toLowerCase());
            return !attr(processor, 'socket') || sockets.includes(String(attr(processor, 'socket')).toLowerCase());
          });
          if (!build.cooler) continue;
          build.cooler = asPart(build.cooler);
        } else build.cooler = requiredParts.cooler ? (coolers.find((item) => String(item.id) === String(requiredParts.cooler)) ? asPart(coolers.find((item) => String(item.id) === String(requiredParts.cooler))) : null) : null;
        if (requiredParts.cooler && !build.cooler) continue;
        const compatibility = checkBuildCompatibility(build, exceptions);
        if (compatibility.status === 'FAIL') continue;
        const priceCents = total(build);
        if (priceCents > budgetCents) continue;
        const preference = String(purpose || '').toLowerCase();
        const cpuAllocationPenalty = game && graphicsCard
          ? Math.abs((dollars(processor) / dollars(graphicsCard)) - 0.55) * dollars(graphicsCard) * 4.0 : 0;
        const platformPenalty = /ryzen\s*9/i.test(processor.name) && /\bA320\b|\bA520\b/i.test(motherboard.name) ? 100_000 : 0;
        const legacyPlatform = /ddr\s*3/i.test(String(attr(motherboard, 'ramType') || motherboard.name)) || /\bLGA\s*11(?:55|56|50|60)\b/i.test(String(attr(motherboard, 'socket') || motherboard.name));
        const legacyPenalty = game && budgetCents >= 350_000 && legacyPlatform ? 20_000_000 : 0;
        const cpuCores = Number(attr(processor, 'coresQuantity')) || Number(String(processor.name).match(/\b(\d+)\s*[- ]?cores?\b/i)?.[1]) || 0;
        const coreCountPenalty = game && budgetCents >= 350_000 && cpuCores > 0 && cpuCores < 6 ? 150_000 : 0;
        const utilizationPenalty = game && Number.isFinite(budgetCents) ? Math.max(0, budgetCents * 0.8 - priceCents) * 3 : 0;
        const gpuSharePenalty = game && graphicsCard && Number.isFinite(budgetCents)
          ? Math.max(0, budgetCents * 0.34 - dollars(graphicsCard)) * 0.9 : 0;
        const score = game
          ? priceCents - dollars(graphicsCard) * 1.8 + cpuAllocationPenalty + platformPenalty + legacyPenalty + coreCountPenalty + utilizationPenalty + gpuSharePenalty
          : priceCents + (preference.includes('silenc') && /rgb/i.test(processor.name) ? 0 : 0);
        candidates.push({ id: `build-${processor.id}-${graphicsCard?.id || 'igpu'}-${motherboard.id}`,
          parts: build, totalPriceCents: priceCents, compatibility, unknownRules: compatibility.unknownRules,
          selectionPolicy: game ? 'heurística de alocação GPU/CPU por custo para jogos; não é benchmark nem promessa de desempenho' : 'menor custo validado no catálogo; sem benchmark', score });
      }
    }
  }
  candidates.sort((a, b) => a.score - b.score);
  const chosen = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const signature = `${candidate.parts.processor.id}:${candidate.parts.graphicsCard?.id || 'igpu'}`;
    if (seen.has(signature)) continue;
    seen.add(signature);
    chosen.push(candidate);
    if (chosen.length >= Math.max(1, Math.min(5, Number(limit) || 4))) break;
  }
  return chosen.map(({ score, ...candidate }) => candidate);
}

export function validateCandidateChoice(candidates, proposal, budgetCents, exceptions = []) {
  const candidate = candidates.find((item) => item.id === proposal?.candidateId);
  if (!candidate) return { candidate: null, reason: 'unknown-candidate' };
  const confidence = Number(proposal.confidence);
  if (!Number.isFinite(confidence) || confidence < 0.55) return { candidate: null, reason: 'low-confidence' };
  if (candidate.totalPriceCents > budgetCents) return { candidate: null, reason: 'over-budget' };
  const compatibility = checkBuildCompatibility(candidate.parts, exceptions);
  if (compatibility.status === 'FAIL') return { candidate: null, reason: 'incompatible' };
  return { candidate: { ...candidate, compatibility, unknownRules: compatibility.unknownRules }, confidence };
}
