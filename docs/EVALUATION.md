# Avaliação e histórico

## Cenários verificáveis

`npm test` executa testes unitários com o snapshot público versionado; não faz uma chamada a um provedor de IA. A suíte verifica IDs e estoque, preço em centavos, categorias repetidas, atributos de RAM, sockets, PFC, cooler obrigatório, folga de radiador/GPU, incertezas de gabinete/armazenamento, teto, candidatos oficiais e recusa de um ID Jev que não veio da lista.

| Caso | Resultado esperado / observado |
|---|---|
| Pedido com RTX 5070 e limite R$ 5.000 | Sem montagem: a GPU oficial já supera o teto e o servidor não ignora a restrição. |
| PC gamer sem modelo de GPU, teto R$ 5.000 | Candidato atual usa Ryzen 5 5500, RTX 3050 e DDR4 por R$ 4.004,44. O ranking penaliza plataformas DDR3 antigas e tenta reservar proporção do orçamento à GPU; não mede FPS. |
| Ryzen 7, RTX 5070, 32 GB, teto R$ 15.000 | Candidato oficial em estoque; a captura anterior usou Ryzen 7 5700 + RTX 5070 + 32 GB por R$ 11.044,61. O total não é promessa de desempenho; o ranking atual tenta aproximar 80% do teto sem inventar benchmark. |
| Ryzen 7 8700G, RTX 5070, 32 GB, teto R$ 15.000 | Há candidato compatível de R$ 14.184,65 na captura. O ranking não garante selecioná-lo como opção gamer superior. |
| Pedido de RAM 32 GB com SKU 16 GB | Seleciona quantidade 2, conta duas unidades e exige estoque suficiente; capacidade e slots são rechecados. |
| Refinar placa de vídeo | Mantém os demais IDs da montagem anterior quando o catálogo oferece uma alternativa dentro do teto e a validação continua aprovada; caso contrário sinaliza dependências alteradas ou recusa. |
| Fonte sem PFC declarado / folga física ausente | Incompatibilidade confirmada falha; dado ausente aparece `UNKNOWN`, nunca como garantia. |
| Jev retorna ID não apresentado ou confiança abaixo de 0,55 | Rejeitar resultado e usar ranking determinístico; os preços e teto continuam sob controle do backend. |

Esses valores são da captura de 02/10/2026 e podem divergir do catálogo atual. O teste não mede FPS, não confirma BIOS/forma física completa e não valida uma máquina montada.

## O que não foi conectado/testado

Nenhuma chave de API foi fornecida. Portanto não houve chamada real a OpenAI, modelo OpenAI-compatible, Ollama, LM Studio ou Typesafe Jev nesta entrega. Os testes comprovam regras locais e validação de respostas fechadas, não disponibilidade do serviço externo, qualidade de geração, tokens ou uma execução Jev real. Neste host não há runtime local de LLM instalado; cada sessão pode conectar um endpoint permitido. Modo sem credencial é prévia determinística e aparece como tal na interface.

## Início informado e commits locais

O início do trabalho foi informado como **02/10/2026 às 18:25 em `America/Sao_Paulo`**. Os commits abaixo representam fases de trabalho reais neste repositório; horas seguem o relógio do host e a autoria Git já configurada, sem data retroativa:

| Commit | Fase |
|---|---|
| `1327372` | documentação base |
| `848bc56` | scaffold da aplicação |
| `c117d02` | dados demonstrativos iniciais |
| `0c6cc1f` | backend RAG / SQLite |
| `71f5e84` | interface de loja e inspeção |
| `b6510fa` | Docker e HTTPS inicial |
| `42eb5b1` | normalização da API oficial e regras |
| `c1fcf01` | migração de catálogo ativo somente para fonte oficial |
| `f1c077d` | builder e validação determinística |
| `43f425c` | fluxo conversacional e tela de montagem |
| `24c2af9` | documentação arquitetura/provedores |

O histórico local/tag `demo-v1` mantém a etapa demonstrativa anterior, mas seus produtos não fazem parte do catálogo ativo do montador. Push ao GitHub depende de autenticação/gravação no remoto e não é inferido a partir do histórico local.
