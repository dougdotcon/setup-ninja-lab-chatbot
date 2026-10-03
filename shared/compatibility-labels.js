export const compatibilityStatusLabels = Object.freeze({
  PASS: 'Compatível',
  FAIL: 'Incompatível',
  UNKNOWN: 'Pendente de conferência',
});

export const compatibilityRuleLabels = Object.freeze({
  'selected-parts-in-stock': 'Disponibilidade das peças em estoque',
  'cpu-motherboard-socket': 'Soquete do processador e da placa-mãe',
  'integrated-graphics': 'Vídeo integrado ou placa de vídeo',
  'memory-capacity-and-slots': 'Capacidade e slots de memória',
  'power-supply-capacity': 'Potência da fonte',
  'cpu-cooler-socket-tdp': 'Compatibilidade do cooler',
  'motherboard-case-form-factor': 'Formato da placa-mãe e do gabinete',
  'motherboard-bios-support': 'Suporte da BIOS ao processador',
  'radiator-case-fit': 'Espaço para radiador no gabinete',
  'gpu-case-clearance': 'Espaço para placa de vídeo',
  'storage-board-interface': 'Interface do armazenamento e da placa-mãe',
});

export function compatibilityStatusLabel(status) {
  return compatibilityStatusLabels[status] || compatibilityStatusLabels.UNKNOWN;
}

export function compatibilityRuleLabel(ruleId) {
  return compatibilityRuleLabels[ruleId] || 'Compatibilidade sem dados suficientes';
}
