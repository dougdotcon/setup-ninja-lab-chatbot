# Matriz de aceitação do desafio

Esta matriz relaciona cada exigência ao comportamento e à evidência reproduzível. A verificação final de 03/10/2026 aprovou **28/28 testes**, lint e build Docker, além de **9/9 cenários com Ollama real**, seis interpretações e seis gerações aceitas. Os fluxos desktop/mobile foram verificados no navegador. Veja [resultados e limites](EVALUATION.md) e o [relatório de inferência real](verification/ollama-acceptance.json). A conexão real permanece opt-in, sem chaves incluídas; consulte `PROVIDERS.md`.

| Requisito | Implementação e evidência |
|---|---|
| 3.1.1 Consumir a API JSON | Cliente oficial, normalização, snapshot e sincronização SQLite; `catalog-compatibility.test.js`, `catalog-persistence.test.js` e teste real consultam a origem oficial. |
| 3.1.2 Usar LLM para interpretar e responder | Interpretação JSON e plano de resposta em duas chamadas; `challenge-flow.test.js` verifica chamadas e fallback, script opt-in exige interpretação e geração aceitas por runtime real. |
| 3.1.3 Só produtos existentes/em estoque | Domínio filtra estoque; resposta usa SKUs canônicos. Teste HTTP compara cada ID/quantidade com a fonte oficial. |
| 3.1.4 Preço e orçamento | Soma em centavos e teto obrigatório. Testes conferem soma exata e recusam RTX 5070 sob R$ 5.000. |
| 3.1.5 Validar compatibilidade estruturada | Regras de soquete, RAM, gabinete, fonte, cooler, BIOS e armazenamento conforme atributos disponíveis; suíte de domínio. |
| 3.1.6 Não recomendar conflitos conhecidos | `FAIL` remove candidatos e a escolha final é revalidada. Testes com peças conflitantes. |
| 3.1.7 Informar impossibilidade | HTTP 422 com motivo, avisos `UNKNOWN` e referência declarada quando orçamento ausente. Testes de orçamento e preferências sem candidato. |
| 3.1.8 Manter contexto | `previousBuildId` da sessão conserva teto, RAM e peças fixas; testes de refinamento NVIDIA/32 GB e isolamento. |
| 4.2 CPU ↔ placa-mãe | Soquete e família informados; suporte de BIOS ausente fica `UNKNOWN`. |
| 4.2 RAM ↔ placa-mãe | Tipo, capacidade e slots publicados; contagem por quantidade e módulos. |
| 4.2 Gabinete ↔ placa-mãe | Formato/tamanho quando a API publica; ausência fica `UNKNOWN`. |
| 4.2 Fonte ↔ configuração | Potência e requisitos publicados com folga; dados ausentes não viram garantia. |
| 4.2 Cooler ↔ CPU | Soquetes, TDP e radiador quando publicados; conflito é bloqueado. |
| 6.2.1 Consulta pela LLM | RAG FTS5 de produtos/guias e interpretação estruturada sobre candidatos; modelo recebe contexto limitado. |
| 6.2.2 Evitar SKUs inventados | IDs da LLM só são aceitos em listas fechadas; renderer usa fatos da fonte. `assistant-policy.test.js` rejeita campos/prosa extras. |
| 6.2.3 Compatibilidade | Domínio puro, independente do modelo; `catalog-compatibility.test.js`. |
| 6.2.4 Orçamento | Restrições canônicas, cálculo em centavos e recusa; `challenge-flow.test.js`. |
| 6.2.5 Contexto | Histórico/builds por cookie assinado; refinamento conserva preferências e não aceita build alheio. |
| 6.2.6 IA vs regras | Camadas domain/application/infrastructure; diagramas em `ARCHITECTURE.md`. |
| 6.2.7 Ausência de peças | Não relaxa silenciosamente teto ou preferência obrigatória; explica ausência/dependências. |
| 6.2.8 Respostas inválidas | Schemas exatos, enum/IDs limitados, timeout e fallback com telemetria; testes de JSON, persona, specs e Jev. OpenAI, Ollama e LM Studio recebem JSON Schema estrito; a aplicação também valida respostas de provedores que só aceitam modo JSON. |
| 6.2.9 Prompts e ferramentas | Prompts/validadores em `assistant-policy.js`; contratos separados de interpretação, motivos, plano RAG e Jev choice. A explicação aceita até 3 motivos enum e o plano RAG até 4 IDs das fontes recebidas. |
| 6.2.10 Catálogo maior | O código aplica os filtros de categoria, estoque e orçamento antes do LIMIT SQL e usa FTS5/BM25 com top-K. A busca foi verificada no catálogo capturado com 1.236 produtos; não foi feito benchmark que prove ausência de starvation em escalas maiores. |
| Refinamento com itens fixos | `requiredParts` preserva IDs requeridos; `refineTargets` identifica categorias a trocar. O backend tenta manter as demais peças, informa dependências alteradas e só flexibiliza IDs não explicitamente fixados quando não há candidato. O teste HTTP focado confirmou a preservação de CPU Intel escolhida manualmente apesar da preferência AMD herdada. |
| Plataforma e socket em refinamento | O teste HTTP focado confirmou troca de socket entre AM4 e AM5 e resposta HTTP 422 quando CPU AM5 e placa-mãe AM4 são explicitamente combinadas. |
| 6.2.11 Bom senso de investimento | Ranking penaliza plataforma antiga e discrepância CPU/GPU; prioridade GPU e preferência de trabalho são preservadas. Não promete benchmark. |
| 7 LLM não é fonte da verdade | Valores e atributos são do SQLite oficial; a LLM interpreta e escolhe planos fechados, nunca calcula o preço final nem aprova regras. |

## Entregáveis adicionais

| Pedido | Local de verificação |
|---|---|
| Docker e subdomínio | `Dockerfile`, `compose.yaml`, `https://setupninja.douvras.com/api/health`; volume SQLite persiste rebuilds. |
| Inspeção SQLite | Barra superior → Banco de dados: tabelas autorizadas, estatísticas e fonte. |
| Conectar modelo e saídas | Barra superior → Conectar IA / Execuções: conexão por sessão, fontes, status e resposta entregue. |
| Ollama, LM Studio, OpenAI e outros | Adaptador OpenAI-compatible, presets e allowlist local; `PROVIDERS.md`. Nenhuma chave inicial. |
| Typesafe Jev | Adaptador separado com teste de contrato por transporte injetado; não confundir com provedor de prosa. |
| NinjaRUDEUS em contexto | Escopo, recusa fora de hardware, guias com fontes e persona no renderer; testes de follow-up e prompt injection. |
| Identidade, carrinho e montador | `DESIGN.md` e `UX.md` descrevem referência, defeitos observados e verificação do fluxo. |
| Documentação e diagramas | README e documentos em `docs/`, com Mermaid de componentes, sequência e RAG. |
| Verificação da demonstração | Fluxos de carrinho, montagem, SQLite e conexão local observados no navegador, sem erros no console; o grid em 390 px foi corrigido e confirmado: painéis de 368 px dentro da tela. |
| Commits por etapa e autoria | Histórico Git publicado no repositório, autoria dougdotcon corrigida com autorização e datas preservadas. |

## Limites da avaliação

Um resultado `UNKNOWN` não garante montagem física; ele indica os atributos faltantes da API. Os testes não montam hardware nem medem FPS. Adaptadores remotos sem chave são verificados com mocks, sem afirmar execução real de OpenAI ou Jev. O teste opt-in distingue um servidor HTTP simulado de uma inferência real local e exige pelo menos um contrato aceito em cada etapa. Um modelo pequeno serve para verificar integração, não como recomendação de qualidade para produção.
