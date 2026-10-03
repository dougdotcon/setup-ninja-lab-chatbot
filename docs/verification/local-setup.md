# Verificação dos tutoriais locais — 03/10/2026

Esta verificação trata dos comandos de instalação e operação documentados. A avaliação do chatbot e dos cenários do desafio permanece em [EVALUATION.md](../EVALUATION.md) e [ollama-acceptance.json](ollama-acceptance.json).

| Procedimento | Evidência observada |
|---|---|
| Configuração HTTP local | `docker compose -f compose.yaml -f compose.local.yaml config --format json` conserva volume, porta interna, read-only e allowlist; altera `COOKIE_SECURE` para `false`. |
| Execução Docker isolada | Instância de teste com nome/porta/volume próprios; `/api/health` aprovou, `/api/session` mostrou 1.236 produtos e nenhum modelo configurado. |
| Sessão HTTP | Cookie não `Secure`; o mesmo cookie recuperou duas montagens após refinamento. |
| Tutorial de montagem e refinamento | Pedido Ryzen com 32 GB e teto R$ 6.000, seguido de NVIDIA com `previousBuildId`, retornou R$ 5.104,61 dentro do teto. O valor é dessa captura, não uma expectativa fixa. |
| Guia técnico | Pergunta de instalação de RAM retornou citação Kingston. |
| Instalação Node limpa | Cópia dos fontes sem `node_modules`, `dist` ou SQLite; `npm ci` instalou 233 pacotes; `npm run db:seed` criou base com 1.236 produtos. |
| Build Node | `npm run build` passou, com 1.743 módulos transformados. |
| Execução Node em produção | Node v24.14.0 com `NODE_ENV=production`, `COOKIE_SECURE=false`, porta própria e SQLite isolado; `/api/health` e HTML compilado responderam. |
| Interface no navegador | Docker HTTP e Node produção carregaram a loja; Node mostrou 48 cards de produtos; navegador sem erros de console. |
| Seed repetido | Segunda execução conserva 1.236 produtos. |
| Backup e restauração | Serviço de teste parado durante o backup; arquivo restaurado em outro volume vazio. SHA-256 do SQLite e da chave de assinatura iguais aos originais. |
| Links e whitespace | Links relativos dos Markdown conferidos e `git diff --check` sem erros. |

Para não alterar o serviço publicado, os testes usaram portas 4275/4276, contêiner `setupninja-docs-check` e volumes temporários. A sincronização automática foi desativada nessas instâncias com `SETUPNINJA_SKIP_LIVE_SYNC=1`, mantendo a avaliação sobre o snapshot versionado. Docker Compose v2.29.7 e a imagem da aplicação já compilada foram usados na verificação do override; o build limpo foi executado pelo caminho Node.

Os comandos de instalação do runtime Ollama e os controles do LM Studio foram conferidos na documentação oficial vinculada no [tutorial](../LOCAL_MODELS.md). Não foi instalado outro modelo nem executada nova inferência real nesta revisão documental. A avaliação anterior de Ollama continua identificada separadamente. Também não houve teste de instalação em Windows/macOS; as instruções de shell distinguem POSIX de PowerShell.
