# Setup Ninja Studio

Vitrine demonstrativa da Setup Ninja com NinjaRUDEUS, catálogo de componentes oficiais, SQLite/FTS5 e montador determinístico de PCs. O montador só recomenda SKUs disponíveis na captura oficial, soma os preços do catálogo e rejeita conflitos confirmados. Regras para as quais a fonte não traz dados suficientes aparecem como **UNKNOWN**; isso não garante encaixe físico nem desempenho.

## Executar

Requisitos: Node.js 24+ (inclui `node:sqlite`).

```sh
npm ci
npm run db:seed
npm run dev
```

A aplicação local atende em `http://127.0.0.1:4174`. Para uma execução de produção local use `npm run build && npm start`. O SQLite fica em `data/setupninja.sqlite`; defina `SETUPNINJA_DATA_DIR` para armazená-lo fora do repositório. O serviço busca a fonte oficial ao iniciar e mantém o snapshot versionado como contingência validada. A sincronização pública tem limite global de uma solicitação por minuto e consulta apenas a URL oficial fixa.

## Catálogo, compatibilidade e limites

A origem é o configurador oficial [`monte-seu-pc.setupninja.com.br/produtos`](https://monte-seu-pc.setupninja.com.br/produtos). O snapshot versionado em `data/catalog-api.snapshot.json` contém 1.238 anúncios de categoria e 1.236 IDs únicos após deduplicação; 749 estão disponíveis e 487 sem estoque. A API pode mudar esses números entre atualizações. O catálogo conserva preço, estoque, categoria, atributos publicados, imagem CDN e link da fonte. Produtos sem estoque aparecem na consulta administrativa, mas nunca entram no RAG de recomendação nem no montador.

`server/domain/compatibility.js` executa verificações puras para estoque/quantidade, socket CPU/placa-mãe, tipo e capacidade da memória, vídeo integrado, potência/PFC da fonte, TDP e compatibilidade do cooler e limites dimensionais que a API descreve. `server/domain/build.js` combina candidatos com limite de preço, memória, CPU/GPU preferidos e restrições de peças fixas durante refinamentos. A ordenação gamer é uma heurística por custo de componentes, sem benchmarks ou promessas de FPS. Com 15 mil reais, Ryzen 7 + RTX 5070 + 32 GB, a amostra atual escolhe uma montagem de R$ 11.044,61; não promete gastar o teto nem que essa seja a melhor configuração de desempenho.

Na finalidade gamer, o ranking aplica uma heurística documentada de custo: tenta usar aproximadamente 80% do teto, favorece GPU com participação razoável no orçamento, exige ao menos seis núcleos quando há opção compatível e penaliza plataforma DDR3 antiga se existir alternativa. Isso não é benchmark nem medida de desempenho; opções baratas podem continuar sendo escolhidas em outros contextos. O catálogo não declara todos os formatos de placa aceitos pelos gabinetes, interfaces/slots de armazenamento, conectores de fonte ou medições de desempenho. Esses casos ficam como `UNKNOWN` e aparecem no resultado para revisão. Produtos e preços mudam no site original; a demonstração não fecha pedidos nem processa pagamentos.

## Chat e modelos

Sem credenciais, as respostas usam RAG local sobre a base de tecnologia e o catálogo. A busca FTS5/BM25 recupera fontes e respeita filtros de orçamento antes do top-K. O prompt limita o NinjaRUDEUS a hardware, catálogo e suporte técnico. Perguntas de montagem no próprio chat usam o mesmo montador e as mesmas validações do painel. IDs, preços, estoque e total são renderizados a partir dos registros do servidor, não da prosa do modelo.

Em **API do modelo**, é possível configurar por sessão um endpoint OpenAI-compatible, OpenAI, Ollama ou LM Studio. Ollama e LM Studio podem usar os endereços locais permitidos no Compose abaixo. As credenciais ficam apenas na memória do processo e não são gravadas em SQLite nem em logs; depois de reiniciar, precisam ser informadas novamente. Nenhuma chave acompanha este repositório.

Typesafe Jev é uma integração separada e opcional para escolha entre IDs de candidatos já validados. Jev recebe opções fechadas e não gera texto de resposta; sem Jev, o ranking determinístico escolhe a opção. A explicação textual usa o provedor de linguagem configurado ou a prévia local. Para verificar conectividade de Jev, configure sua credencial na interface; os testes usam validação isolada e não alegam uma chamada real.

## Dados e segurança

O SQLite guarda catálogo normalizado, categorias, especificações, chunks/índice FTS, execuções de sincronização e sessões. Consultas de histórico e execuções são escopadas pelo cookie assinado. O inspetor público libera somente tabelas de catálogo em modo somente leitura. A configuração de modelo e os builds ficam separados por sessão e expiram; chaves nunca entram na base.

Chamadas externas de modelos exigem HTTPS e endereço público. Redirecionamentos e endereços privados são recusados, exceto os endpoints locais configurados explicitamente em `SETUPNINJA_LOCAL_LLM_URLS` para Ollama/LM Studio. O servidor não encaminha chaves nem envia mensagens a serviços externos sem configuração do usuário.

## Docker e publicação

```sh
docker compose up --build -d
docker compose ps
docker compose logs -f web
```

O Compose expõe somente `127.0.0.1:4174`, executa como usuário não-root, usa volume persistente para SQLite e reinicia após falha/reboot. Nginx encaminha `https://setupninja.douvras.com` para a porta local. Para usar um modelo Ollama/LM Studio instalado no host Docker, configure-o para ouvir na interface acessível pelo contêiner e permita sua porta no firewall; os endereços preconfigurados são `host.docker.internal:11434` e `:1234`. A máquina de um visitante não é o host do servidor.

Para backup consistente, pare o contêiner durante a cópia do volume:

```sh
docker compose stop web
docker run --rm -v setupninja_setupninja_data:/data:ro -v "$PWD":/backup alpine tar czf /backup/setupninja-data.tgz -C /data .
docker compose start web
```

## Verificação

```sh
npm test
npm run build
```

Os testes cobrem normalização do snapshot, deduplicação, conflitos e incertezas, estoque por quantidade, regras de RAM/fonte/cooler, teto de preço, filtros de componentes e seleção Jev de candidatos fechados. A cobertura não substitui ensaio elétrico, medição de desempenho ou validação física da montagem.

Documentação adicional: [fluxos e arquitetura](docs/ARCHITECTURE.md), [fonte e sincronização do catálogo](docs/CATALOG.md), [matriz de compatibilidade](docs/COMPATIBILITY.md), [configuração de provedores](docs/PROVIDERS.md) e [cenários/limites da avaliação](docs/EVALUATION.md).

> O trabalho começou em 02/10/2026 às 18:25 no fuso `America/Sao_Paulo`, conforme registro do projeto.
