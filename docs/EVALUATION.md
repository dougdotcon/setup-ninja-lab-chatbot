# Avaliação e histórico

## Cenários verificáveis

`npm test` executa testes de domínio e um percurso HTTP isolado, usando o snapshot público versionado. O percurso usa um servidor OpenAI-compatible simulado em `127.0.0.1`, sem credenciais. Para cada montagem, compara SKUs, quantidade, preço e total com o catálogo oficial, confirma estoque e ausência de regra `FAIL`, além de testar memória de sessão, RAG, escopo e fallback. A suíte também testa normalização, deduplicação, sockets, RAM, PFC, cooler, dimensões, orçamento, Jev com escolha fechada e prevenção de retrocesso do SQLite quando o snapshot embutido é mais antigo.

| Caso | Resultado esperado / observado |
|---|---|
| Pedido com RTX 5070 e limite R$ 5.000 | Sem montagem: a GPU oficial já supera o teto e o servidor não ignora a restrição. |
| PC gamer sem modelo de GPU, teto R$ 5.000 | Pedido HTTP natural retorna Ryzen 5 5500 (6 núcleos), RTX 3050, 16 GB DDR4 e SSD 480 GB por R$ 4.263,26. Compatibilidade global permanece `UNKNOWN`: a captura não confirma atributos da fonte, encaixe da placa no gabinete, BIOS ou slots/interface do SSD. O ranking penaliza DDR3 antigo e tenta reservar parte do teto à GPU; não mede FPS. |
| Ryzen 7, RTX 5070, 32 GB, teto R$ 15.000 | Candidato oficial em estoque; a captura anterior usou Ryzen 7 5700 + RTX 5070 + 32 GB por R$ 11.044,61. O total não é promessa de desempenho; o ranking atual tenta aproximar 80% do teto sem inventar benchmark. |
| Ryzen 7 8700G, RTX 5070, 32 GB, teto R$ 15.000 | Há candidato compatível de R$ 14.184,65 na captura. O ranking não garante selecioná-lo como opção gamer superior. |
| Pedido de RAM 32 GB com SKU 16 GB | Seleciona quantidade 2, conta duas unidades e exige estoque suficiente; capacidade e slots são rechecados. |
| Refinar placa de vídeo | Mantém os demais IDs da montagem anterior quando o catálogo oferece uma alternativa dentro do teto e a validação continua aprovada; caso contrário sinaliza dependências alteradas ou recusa. |
| Fonte sem PFC declarado / folga física ausente | Incompatibilidade confirmada falha; dado ausente aparece `UNKNOWN`, nunca como garantia. |
| Jev retorna ID não apresentado ou confiança abaixo de 0,55 | Rejeitar resultado e usar ranking determinístico; os preços e teto continuam sob controle do backend. |
| “Não quero Intel” com R$ 7.000 e foco em 1440p | CPU AMD, plataforma não DDR3, itens oficiais disponíveis e total até R$ 7.000. Sem benchmark, 1440p é preferência de uso e não promessa de FPS. |
| “Prefiro gastar mais na placa de vídeo” | Ranking gamer aplica prioridade de GPU; teste exige GPU mais cara que a CPU e evita DDR3. |
| Ryzen 7, 32 GB, edição de vídeo, sem teto | Usa referência inicial declarada de R$ 8.000, respeita Ryzen 7 e ao menos 32 GB. Não apresenta a referência como orçamento informado pelo usuário. |
| RTX 5070, sem teto | Usa referência declarada de R$ 15.000, preserva o modelo pedido e evita DDR3. |
| Refinamento “32 GB e NVIDIA” | Uma mensagem muda simultaneamente RAM e GPU sobre a montagem anterior; o resultado mantém o teto anterior e sinaliza as categorias alteradas. |
| Modelo local simulado | Interpretação JSON e geração são chamadas de fato; ID alucinado na interpretação não entra na montagem; descrição com produto/preço inventado cai na resposta local. |
| Chat RAG e isolamento | Pergunta fora do escopo não recupera fontes; tentativa de trocar instruções é bloqueada; pergunta de SSD recupera citações de SKUs em estoque; sessões distintas não veem históricos uma da outra. |
| Trilha de respostas | O histórico RAG conserva a resposta entregue; montagens conservam solicitação, interpretação, seleção, modelo/fallback e explicação. O painel separa “busca FTS5” de “montagem validada”. |

Esses valores são da captura de 02/10/2026 e podem divergir do catálogo atual. O teste não mede FPS, não confirma BIOS/forma física completa e não valida uma máquina montada.

## O que não foi conectado/testado

Nenhuma chave de API foi fornecida. Houve teste real do protocolo OpenAI-compatible por servidor HTTP simulado, mas não uma chamada a OpenAI, Ollama, LM Studio ou Typesafe Jev reais. Os testes não comprovam disponibilidade externa, qualidade do modelo, contagem real de tokens ou uma execução Jev real. Neste host não há runtime local de LLM instalado; cada sessão pode conectar um endpoint permitido. Modo sem credencial é prévia determinística e aparece como tal na interface. A validação de texto do modelo é conservadora e rejeita referências numéricas/modelos sem fonte; texto livre ainda requer avaliação humana para garantias semânticas.

## Início informado e commits locais

O início do trabalho foi informado como **02/10/2026 às 18:25 em `America/Sao_Paulo`**. Os commits abaixo representam fases de trabalho reais neste repositório; horas seguem o relógio do host, sem data retroativa. A autoria de todos os 21 commits iniciais foi corrigida para **dougdotcon** em 03/10/2026, com autorização expressa para atualizar o histórico publicado. Árvores, mensagens e datas foram preservadas; os IDs abaixo refletem a correção:

| Commit | Fase |
|---|---|
| `0dec518` | documentação base |
| `17dc969` | scaffold da aplicação |
| `2d9a21c` | dados demonstrativos iniciais |
| `d006649` | backend RAG / SQLite |
| `3e857b9` | interface de loja e inspeção |
| `2b83b67` | Docker e HTTPS inicial |
| `6cb80ac` | normalização da API oficial e regras |
| `97bdd2b` | migração de catálogo ativo somente para fonte oficial |
| `6605eac` | builder e validação determinística |
| `583a25e` | fluxo conversacional e tela de montagem |
| `cd5b7e5` | documentação arquitetura/provedores |
| `0bc9a0c` | documentação detalhada de catálogo, compatibilidade, provedores e avaliação |
| `2e09777` | ajuste do ranking gamer para evitar plataformas DDR3 e usar melhor o teto |
| `f6c9ab5` | registro da avaliação de R$ 5.000 |
| `192178d` | capacidade de armazenamento gamer e BIOS explicitamente desconhecida |
| `docs: complete commit chronology` | atualização deste próprio histórico |
| `ecfb86f` | pedidos naturais, refinamento múltiplo, guarda do catálogo e verificação de saída do LLM |
| `9e89619` | testes HTTP dos cenários do desafio, provedor local simulado e persistência SQLite |
| `docs: document verified challenge flows and enable lint` | esta atualização de evidências, arquitetura e análise estática |
| `578bed6` | trilha por sessão com saídas RAG e montagens, migração SQLite e auditoria na interface |
| `docs: describe answer audit trail and current official source` | documentação da trilha de respostas e da origem ativa do catálogo |

O histórico local/tag `demo-v1` mantém a etapa demonstrativa anterior, mas seus produtos não fazem parte do catálogo ativo do montador. Os commits documentais mais recentes podem ser identificados pelo assunto exato em `git log`. O histórico e a tag foram publicados em `dougdotcon/setup-ninja-lab-chatbot`; a atualização de autoria usou `force-with-lease` para proteger alterações remotas concorrentes.
