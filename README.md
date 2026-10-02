# Setup Ninja Studio

Demonstração responsiva de vitrine inspirada na Setup Ninja com o chatbot **NinjaRUDEUS**, pesquisa SQLite FTS5/BM25, respostas locais determinísticas e conexão opcional a qualquer endpoint de chat OpenAI-compatible.

## Rodar

Requer Node.js 24+ (usa `node:sqlite`).

```sh
npm install
npm run db:seed
npm run build
npm start
```

A API e a vitrine servem em `http://127.0.0.1:4174`. O banco fica em `data/setupninja.sqlite`; para mover, informe `SETUPNINJA_DATA_DIR`. A chave do provedor é mantida em memória no processo, isolada por cookie de sessão e removida após uma hora. Sem credencial, o chatbot usa respostas locais e o índice da loja.

## Catálogo e limites da extração

`data/products.json` contém 45 ofertas que foram identificadas com preço publicado nas páginas públicas da loja; a data e URLs de referência estão em `data/scrape-report.json`. A loja bloqueou requisições HTTP diretas (403), então a captura de catálogo é parcial e reconstruída de páginas indexadas. Não há produtos avulsos inventados: componentes mencionados numa configuração de PC aparecem somente como especificações do kit. Outros departamentos verificados existem em `data/categories.json` com contagem zero até que uma listagem individual verificável possa ser coletada. Duas fotos oficiais do CDN estão vinculadas aos respectivos produtos; itens restantes usam ilustração geométrica, não foto alheia.

A página original não pôde ser acessada para captura automatizada direta; cores, hierarquia e padrões de loja observados foram reconstituídos para uma demonstração, sem afirmar fidelidade pixel a pixel. Preço e disponibilidade podem mudar. Esta aplicação não processa compras.

## Dados e segurança

O schema SQLite inclui `categories`, `products`, `product_categories`, `product_specs`, `knowledge_chunks`, `knowledge_fts`, `scrape_runs`, `chat_sessions`, `chat_messages` e `rag_runs`. O inspetor global libera apenas as sete tabelas do catálogo; histórico e rastros ficam escopados ao cookie assinado desta sessão. O prompt limita respostas ao catálogo e tecnologia; FTS5 recupera até oito fontes, aplica orçamento antes do top-K e salva os documentos citados junto à execução, sem registrar chain-of-thought ou chaves.

Conexão de API requer HTTPS com DNS público; endereços privados, redirecionamentos e origens cruzadas são rejeitados. A URL e a credencial são guardadas apenas na memória da sessão.

## Rodar em Docker

```sh
docker compose up --build -d
docker compose logs -f web
docker compose ps
```

O Compose serve em `127.0.0.1:4174`, reinicia após falha/reboot, executa como usuário não-root e verifica `/api/health`. O volume nomeado `setupninja_data` mantém o SQLite em `/var/lib/setupninja` entre atualizações e reinícios. O Nginx do host encaminha `setupninja.douvras.com` para essa porta local.

Para backup consistente, pare brevemente o container, copie o volume e retome:

```sh
docker compose stop web
docker run --rm -v setupninja_setupninja_data:/data:ro -v "$PWD":/backup alpine tar czf /backup/setupninja-data.tgz -C /data .
docker compose start web
```

TLS depende de o DNS do subdomínio apontar para o host Nginx; após emitir o certificado, altere `COOKIE_SECURE` para `true` no `compose.yaml` e recrie o serviço. Esta instância usa HTTP enquanto valida o apontamento. Nenhuma chave de API vem embutida na imagem.

> O projeto teve início em 02/10/2026 às 18:25 no fuso `America/Sao_Paulo`, conforme o registro de início solicitado.

O snapshot do endpoint oficial de produtos fica em `data/catalog-api.snapshot.json`; `data/catalog-api.snapshot-meta.json` registra a fonte, atualização informada pela API e SHA-256. `data/products.json` é a pequena amostra da vitrine reconstruída da loja original, distinta do catálogo oficial completo.
