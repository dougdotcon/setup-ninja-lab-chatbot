import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretRequest, isPcBuildIntent, parseBrazilianBudget } from '../shared/request.js';

test('challenge examples preserve budget, exclusion, workload, and GPU priority', () => {
  assert.equal(parseBrazilianBudget('Tenho R$ 7.000. Prefiro gastar mais na placa de vídeo.'), 700000);
  const gaming = interpretRequest('Quero um PC para jogar em 1440p, mas não quero Intel. Até R$ 7.000.');
  assert.equal(gaming.purpose, 'gaming');
  assert.deepEqual(gaming.excludedVendors, ['intel']);
  assert.equal(gaming.preferredVendor, null);
  assert.equal(gaming.budgetCents, 700000);
  assert.equal(interpretRequest('Quero Ryzen 7 e 32 GB para edição de vídeo').memoryGB, 32);
  assert.equal(interpretRequest('Tenho R$ 7.000. Prefiro gastar mais na placa de vídeo.').gpuPriority, true);
});

test('the public chat recognizes build and refinement turns', () => {
  assert.equal(isPcBuildIntent('Quero um computador com Ryzen 7 e 32 GB para edição de vídeo'), true);
  assert.equal(isPcBuildIntent('Monte um PC com RTX 5070'), true);
  assert.equal(isPcBuildIntent('Tenho R$ 7.000. Prefiro gastar mais na placa de vídeo.'), true);
  assert.equal(isPcBuildIntent('Agora quero 32 GB de RAM', true), true);
  assert.equal(isPcBuildIntent('Qual a diferença entre SSD SATA e NVMe?'), false);
});


test('hardware instructions and comparisons stay in RAG after an earlier build', () => {
  for (const question of ['Como instalar memória RAM no PC com segurança?',
    'Qual SSD é compatível com meu PC?', 'Qual a diferença entre NVIDIA e AMD?',
    'Tenho um PC; como instalar Windows?', 'Como troco o cooler do processador?']) {
    assert.equal(isPcBuildIntent(question), false, question);
    assert.equal(isPcBuildIntent(question, true), false, question);
  }
  assert.equal(isPcBuildIntent('Pode trocar a placa de vídeo por uma NVIDIA?', true), true);
  assert.equal(isPcBuildIntent('Qual configuração você recomenda até R$ 5.000?'), true);
  assert.equal(isPcBuildIntent('PC até R$ 4.000?'), true);
});
