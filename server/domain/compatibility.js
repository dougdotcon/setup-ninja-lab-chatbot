const norm = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const socketOf = (part) => part?.attributes?.socket || part?.socket || String(part?.name || '').match(/\b(AM[245]|LGA\s*\d{3,5})\b/i)?.[1]?.replace(/\s+/g, '').toUpperCase() || null;
const cpuVendor = (cpu) => {
  const value = norm(cpu?.attributes?.cpuType || cpu?.attributes?.cpuVendor || cpu?.name);
  if (/intel|core i[3579]|celeron|pentium/.test(value)) return 'intel';
  if (/amd|ryzen|athlon/.test(value)) return 'amd';
  return null;
};
const productId = (part) => String(part?.id ?? '');
const rule = (id, status, message, evidence = []) => ({ id, status, message, evidence });
const numeric = (value) => Number.isFinite(Number(value)) && value !== null && value !== '' ? Number(value) : null;
const wattsFromName = (part) => Number(String(part?.name || '').match(/\b(\d{3,4})\s*w(?:att)?\b/i)?.[1]) || null;

export function checkBuildCompatibility(build, exceptions = []) {
  const rules = [];
  const cpu = build?.processor;
  const board = build?.motherboard;
  const memories = Array.isArray(build?.memory) ? build.memory : build?.memory ? [build.memory] : [];
  const gpu = build?.graphicsCard || null;
  const psu = build?.powerSupply || null;
  const cooler = build?.cooler || null;
  const computerCase = build?.case || null;
  const storage = build?.storage || null;
  const selected = [cpu, board, ...memories, gpu, psu, cooler, computerCase, storage].filter(Boolean);
  const quantities = new Map();
  for (const part of selected) quantities.set(productId(part), (quantities.get(productId(part)) || 0) + (numeric(part.quantity) ?? 1));
  const outOfStock = selected.filter((part) => part.inStock === false || !Number.isInteger(numeric(part.quantity) ?? 1) ||
    (numeric(part.quantity) ?? 1) < 1 || quantities.get(productId(part)) > Number(part.stockQuantity ?? part.attributes?.stock ?? 1));
  rules.push(outOfStock.length
    ? rule('selected-parts-in-stock', 'FAIL', 'Uma ou mais peças selecionadas estão sem estoque.', outOfStock.map((part) => part.name))
    : rule('selected-parts-in-stock', selected.length ? 'PASS' : 'UNKNOWN', selected.length ? 'As peças selecionadas constam disponíveis no catálogo consultado.' : 'Nenhuma peça foi selecionada.'));

  if (!cpu || !board) rules.push(rule('cpu-motherboard-socket', 'UNKNOWN', 'Selecione processador e placa-mãe para validar o soquete.'));
  else {
    const cpuSocket = socketOf(cpu);
    const boardSocket = socketOf(board);
    const exception = exceptions.find((item) => String(item.id) === productId(board) && Array.isArray(item.moboCompatibility));
    const permitted = exception?.moboCompatibility?.map(norm) || null;
    const platform = cpuVendor(cpu);
    const exceptionFailure = permitted && platform && !permitted.includes(platform);
    const compatible = cpuSocket && boardSocket ? norm(cpuSocket) === norm(boardSocket) : null;
    rules.push(exceptionFailure
      ? rule('cpu-motherboard-socket', 'FAIL', 'A exceção publicada da loja restringe esta placa a outra plataforma.', [String(board.id), permitted.join(', ')])
      : compatible === null
        ? rule('cpu-motherboard-socket', 'UNKNOWN', 'O catálogo não informa soquete suficiente para confirmar este encaixe.', [cpuSocket || 'soquete do processador ausente', boardSocket || 'soquete da placa ausente'])
        : rule('cpu-motherboard-socket', compatible ? 'PASS' : 'FAIL', compatible ? `Soquete ${cpuSocket} coincide nos dois produtos.` : `Soquete ${cpuSocket} do processador não coincide com ${boardSocket} da placa-mãe.`, [cpu.name, board.name]));
  }

  if (!cpu) rules.push(rule('integrated-graphics', 'UNKNOWN', 'Selecione um processador para validar vídeo integrado.'));
  else if (cpu.attributes?.hasGpu === false && !gpu) rules.push(rule('integrated-graphics', 'FAIL', 'Este processador está marcado sem vídeo integrado; escolha uma placa de vídeo dedicada.', [cpu.name]));
  else if (cpu.attributes?.hasGpu === true) rules.push(rule('integrated-graphics', 'PASS', 'O catálogo marca este processador com vídeo integrado.', [cpu.name]));
  else rules.push(rule('integrated-graphics', gpu ? 'PASS' : 'UNKNOWN', gpu ? 'Há uma placa de vídeo dedicada na seleção.' : 'O catálogo não confirma vídeo integrado para este processador.', [cpu.name]));

  if (!board || memories.length === 0) rules.push(rule('memory-capacity-and-slots', 'UNKNOWN', 'Selecione placa-mãe e memória para validar capacidade e slots.'));
  else {
    const attrs = board.attributes || {};
    const boardType = attrs.ramType ? norm(attrs.ramType) : norm(board.name).match(/\bddr[345]\b/)?.[0] || null;
    const maxCapacity = numeric(attrs.maxRamCapacity);
    const slotCount = numeric(attrs.ramSlotsQuantity);
    const totalCapacity = memories.reduce((sum, part) => sum + numeric(part.attributes?.ramCapacity ?? part.ramCapacity) * Math.max(1, numeric(part.quantity) || 1), 0);
    const moduleCount = memories.reduce((sum, part) => sum + Math.max(1, numeric(part.attributes?.modulesQuantity ?? part.modulesQuantity) || 1) * Math.max(1, numeric(part.quantity) || 1), 0);
    const ramException = exceptions.find((item) => memories.some((part) => String(item.id) === productId(part)) && Array.isArray(item.moboCompatibility));
    const vendor = cpuVendor(cpu);
    const restriction = ramException?.moboCompatibility?.map(norm);
    const checks = [];
    if (restriction && vendor) checks.push(restriction.includes(vendor) ? 'PASS' : 'FAIL');
    if (boardType) for (const part of memories) {
      const type = part.attributes?.ramType || part.attributes?.memoryType || norm(part.name).match(/\bddr[345]\b/)?.[0];
      if (type) checks.push(norm(type) === boardType ? 'PASS' : 'FAIL');
    }
    if (maxCapacity !== null) checks.push(totalCapacity <= maxCapacity ? 'PASS' : 'FAIL');
    if (slotCount !== null) checks.push(moduleCount <= slotCount ? 'PASS' : 'FAIL');
    const fail = checks.includes('FAIL');
    const unknown = !boardType || maxCapacity === null || slotCount === null || memories.some((part) => !part.attributes?.ramType && !part.attributes?.memoryType && !/\bddr[345]\b/i.test(part.name));
    rules.push(rule('memory-capacity-and-slots', fail ? 'FAIL' : unknown ? 'UNKNOWN' : 'PASS',
      fail ? 'Tipo, capacidade ou número de módulos de memória conflita com os dados publicados da placa-mãe.'
        : unknown ? `O catálogo confirma ${totalCapacity || 'capacidade não informada'} GB selecionados, mas não fornece todos os limites necessários.`
          : `${totalCapacity} GB em ${moduleCount} módulo(s); dentro do limite publicado de ${maxCapacity} GB e ${slotCount} slot(s).`,
      [board.name, ...memories.map((part) => part.name)]));
  }

  if (!cpu || !psu) rules.push(rule('power-supply-capacity', 'UNKNOWN', 'Selecione processador e fonte para validar a potência.'));
  else {
    const cpuRequirements = cpu.attributes?.minimumPowerSupply || [];
    const gpuRequirements = gpu?.attributes?.minimumPowerSupply || [];
    const cpuMinimum = cpuRequirements.map(numeric).filter((value) => value !== null);
    const gpuMinimum = gpuRequirements.map(numeric).filter((value) => value !== null);
    const minimumWatts = Math.max(0, ...cpuMinimum, ...gpuMinimum) || null;
    const supplyWatts = wattsFromName(psu);
    const maxCpuTdp = numeric(psu.attributes?.maxCpuTdp);
    const cpuTdp = numeric(cpu.attributes?.tdp);
    const needsPfc = [...cpuRequirements, ...gpuRequirements].some((value) => norm(value) === 'pfc');
    const hasPfc = typeof psu.attributes?.hasPFC === 'boolean' ? psu.attributes.hasPFC : null;
    const insufficientPower = supplyWatts !== null && minimumWatts !== null && supplyWatts < minimumWatts;
    const cpuLimitConflict = maxCpuTdp !== null && cpuTdp !== null && cpuTdp > maxCpuTdp;
    const pfcConflict = needsPfc && hasPfc === false;
    const missingEvidence = supplyWatts === null || minimumWatts === null || cpuTdp === null || maxCpuTdp === null || (needsPfc && hasPfc === null);
    const status = insufficientPower || cpuLimitConflict || pfcConflict ? 'FAIL' : missingEvidence ? 'UNKNOWN' : 'PASS';
    const message = status === 'FAIL' ? (pfcConflict ? 'O requisito publicado pede PFC, mas a fonte informa que não possui PFC.' : 'A potência nominal ou o limite de TDP da fonte conflita com os requisitos publicados.')
      : status === 'UNKNOWN' ? 'A loja não informa todos os dados de potência/limite de TDP; o encaixe elétrico não está completamente confirmado.'
        : `Fonte ${supplyWatts} W cobre a recomendação mínima publicada de ${minimumWatts} W e o limite de TDP de ${maxCpuTdp} W.`;
    rules.push(rule('power-supply-capacity', status, message, [cpu.name, psu.name, ...(gpu ? [gpu.name] : [])]));
  }

  if (!cpu || !cooler) rules.push(rule('cpu-cooler-socket-tdp', cpu?.attributes?.hasCooler === true ? 'PASS' : cpu?.attributes?.hasCooler === false ? 'FAIL' : 'UNKNOWN', cpu?.attributes?.hasCooler === true ? 'O processador indica cooler incluso; o cooler selecionado é opcional.' : cpu?.attributes?.hasCooler === false ? 'O catálogo indica que o processador não inclui cooler; selecione um cooler.' : 'Sem dados suficientes para saber se é necessário escolher um cooler.'));
  else {
    const cpuSocket = socketOf(cpu);
    const coolerSockets = (cooler.attributes?.sockets || []).map((value) => norm(value).replace(/\s+/g, ''));
    const supported = cpuSocket ? coolerSockets.includes(norm(cpuSocket).replace(/\s+/g, '')) : null;
    const cpuTdp = numeric(cpu.attributes?.tdp);
    const coolerTdp = numeric(cooler.attributes?.tdp);
    const tdpFits = cpuTdp !== null && coolerTdp !== null ? coolerTdp >= cpuTdp : null;
    const status = supported === false || tdpFits === false ? 'FAIL' : supported === true && tdpFits === true ? 'PASS' : 'UNKNOWN';
    rules.push(rule('cpu-cooler-socket-tdp', status,
      status === 'FAIL' ? 'O cooler não cobre o soquete ou o TDP publicado do processador.'
        : status === 'PASS' ? `Soquete ${cpuSocket} aceito e TDP do cooler (${coolerTdp} W) cobre ${cpuTdp} W.`
          : 'O catálogo não fornece soquete/TDP suficientes para confirmar o cooler.', [cpu.name, cooler.name]));
  }

  rules.push(rule('motherboard-case-form-factor', 'UNKNOWN', 'O catálogo informa o tamanho do gabinete, mas não a lista de formatos de placa-mãe aceitos; não é possível garantir esse encaixe.', board && computerCase ? [board.name, computerCase.name] : []));
  rules.push(rule('motherboard-bios-support', 'UNKNOWN',
    'A API não informa a versão de BIOS instalada nem a lista de CPUs suportadas por BIOS; confirme suporte e atualização antes da montagem.', board ? [board.name] : []));

  if (cooler && computerCase && (cooler.attributes?.waterCoolerSize || /water\s*cooler|liquid/i.test(cooler.name))) {
    const radiatorSize = numeric(cooler.attributes?.waterCoolerSize) || Number(String(cooler.name).match(/\b(120|140|240|280|360|420)\s*mm\b/i)?.[1]) || null;
    const caseSizes = (computerCase.attributes?.waterCoolerSizes || []).map(numeric).filter((value) => value !== null);
    const positions = ['frontal', 'back', 'lateral', 'bottom', 'top'];
    const supported = positions.some((position) => numeric(computerCase.attributes?.[`${position}MaxWaterCoolerSize`]) >= radiatorSize);
    const knownUnsupported = radiatorSize !== null && caseSizes.length > 0 && !caseSizes.includes(radiatorSize) && !supported;
    const status = knownUnsupported ? 'FAIL' : radiatorSize !== null && (caseSizes.includes(radiatorSize) || supported) ? 'PASS' : 'UNKNOWN';
    rules.push(rule('radiator-case-fit', status,
      status === 'FAIL' ? `O gabinete não publica suporte para radiador de ${radiatorSize} mm.`
        : status === 'PASS' ? `O gabinete lista suporte para radiador de ${radiatorSize} mm.`
          : 'A loja não publica posições/tamanhos suficientes para confirmar o radiador.', [cooler.name, computerCase.name]));
  }

  if (!gpu || !computerCase) rules.push(rule('gpu-case-clearance', 'UNKNOWN', 'Selecione placa de vídeo e gabinete para validar comprimento.'));
  else {
    const gpuLength = numeric(gpu.attributes?.maxGpuSize ?? gpu.attributes?.gpuSize ?? gpu.attributes?.length);
    const caseClearance = numeric(computerCase.attributes?.maxGpuSize);
    const status = gpuLength !== null && caseClearance !== null ? (gpuLength <= caseClearance ? 'PASS' : 'FAIL') : 'UNKNOWN';
    rules.push(rule('gpu-case-clearance', status,
      status === 'PASS' ? `Comprimento publicado da GPU (${gpuLength} mm) cabe no limite publicado do gabinete (${caseClearance} mm).`
        : status === 'FAIL' ? `GPU (${gpuLength} mm) excede o limite do gabinete (${caseClearance} mm).`
          : 'A loja não publica medidas suficientes da GPU e/ou gabinete; espaço físico permanece incerto.', [gpu.name, computerCase.name]));
  }

  if (storage && board) {
    const m2 = /\bm\.2\b|\bnvme\b/i.test(storage.name);
    const slots = numeric(board.attributes?.m2SlotsQuantity);
    const status = m2 && slots !== null ? (slots > 0 ? 'PASS' : 'FAIL') : 'UNKNOWN';
    rules.push(rule('storage-board-interface', status,
      status === 'PASS' ? `O SSD M.2 tem ao menos um slot M.2 publicado na placa-mãe (${slots}).`
        : status === 'FAIL' ? 'A placa-mãe não informa slots M.2 disponíveis para este SSD.'
          : 'Interface/slots de armazenamento não foram descritos completamente pela loja.', [storage.name, board.name]));
  } else rules.push(rule('storage-board-interface', 'UNKNOWN', 'Selecione armazenamento e placa-mãe para validar a interface.'));

  const knownFailures = rules.filter((item) => item.status === 'FAIL');
  const unknowns = rules.filter((item) => item.status === 'UNKNOWN');
  return { status: knownFailures.length ? 'FAIL' : unknowns.length ? 'UNKNOWN' : 'PASS', rules,
    blockingRules: knownFailures.map((item) => item.id), unknownRules: unknowns.map((item) => item.id) };
}

export { cpuVendor, socketOf, wattsFromName };
