# Auditoria de UX e notas de implementação

## Referência observada

Em 03/10/2026, a página inicial da Setup Ninja foi aberta no navegador. O cabeçalho capturado em desktop mostra a logo branca original sobre fundo preto, navegação em duas linhas, busca com ação laranja e ícones laranja para departamentos. O corpo usa `#0e0e0e`, `#111315`, `#1a1d21` e `#222222`, com texto branco/cinza e ações `#ff7300` / `#fd7710`. As famílias tipográficas observadas são Inter, Open Sans e Syne. A captura desktop dessa revisão está em [referência desktop](screenshots/original-storefront.png).

As imagens exatas da logo vêm do CDN oficial em `https://cdn.dooca.store/174137/files/logobrancopng.png?v=1759242139` e `https://cdn.dooca.store/174137/files/logobrancomobilepng.png?v=1759242261`. O aplicativo inclui respostas WebP locais desses mesmos recursos em `public/assets/`, sem depender de acesso ao CDN durante a execução.

## Configurador original

Em 03/10/2026, a página original `https://www.setupninja.com.br/monte-seu-pc?...` carregou e foi possível percorrer o fluxo observado. A captura inicial da montagem está em [captura inicial](screenshots/original-builder.png); a etapa de placa-mãe está em [etapa de placa-mãe](screenshots/original-motherboard.png).

O configurador apresenta nove etapas em uma linha horizontal. Na primeira dobra, o banner e o cabeçalho ocupam bastante espaço; o fluxo testado começa pela CPU sem pedir objetivo de uso ou orçamento. Ao buscar `Ryzen 5 5600` com o filtro AMD, apareceram quatro processadores. A seleção de `Ryzen 5 5600GT BOX` habilitou **PRÓXIMO** e abriu a etapa de cooler. **PULAR** avançou para a placa-mãe. Produtos marcados como incompatíveis exibiram uma mensagem genérica, sem indicar o motivo observado. O total permanece sticky com o preço Pix.

Esses pontos são fricções percebidas no percurso e heurísticas de experiência. Eles não comprovam bugs no configurador, não representam uma auditoria completa e não incluem medição de lentidão. A identidade e as regras comerciais podem mudar após esta observação.

## Problemas detectados no estado inicial da demonstração

Os itens abaixo se referem ao estado inicial da demonstração, não à loja original; os fluxos atualizados foram verificados no navegador conforme a seção seguinte:

- O botão do carrinho abria o chat NinjaRUDEUS; o botão “Monte seu PC” também abria o chat.
- Adicionar um item só incrementava um número. Não havia lista de produtos, controle de quantidade, remoção, subtotal nem persistência.
- O montador aceitava orçamento e preferências gerais de CPU/GPU, mas o botão de refinamento repetia o pedido anterior sem identificar um SKU substituto. Assim, a nova configuração não podia ser revisada antes da validação.
- Alternar entre loja e montador desmontava a tela do montador e descartava formulário e resultado.
- A demonstração usava fundo claro e identidade violeta, diferentes da paleta preta, cinza, branca e laranja da loja original.

## Implementação da demonstração

- O carrinho abre em uma gaveta própria e lista nomes, quantidades, preços unitários, totais por item, remoção, limites de quantidade por estoque e subtotal. Persiste no local storage do navegador apenas dados de apresentação dos produtos do catálogo. Não apresenta checkout nem pagamento.
- Os controles de carrinho e assistente abrem áreas separadas. “Monte seu PC” seleciona a aba do montador.
- O montador carrega opções disponíveis em `/api/build/options`, com o endpoint existente do catálogo como alternativa. A pessoa pode pedir uma sugestão por objetivo e orçamento, escolher CPU/GPU e trocar um componente pelo ID oficial de catálogo. Cada mudança é enviada para `/api/build` junto ao ID da montagem anterior, para que estoque, orçamento e compatibilidade continuem sob validação do backend.
- O fluxo recebe objetivo e teto, apresenta uma proposta completa validada e permite trocar componentes nas oito categorias. Dependências que precisem ser revistas são mostradas explicitamente; enquanto a pessoa alterna de aba, a proposta permanece montada.
- A proposta mostra total, orçamento restante, quantidade de componentes, SKU, estoque consultado e resultado de compatibilidade. Regras `UNKNOWN` continuam identificadas como pendentes. Se o formulário mudar, o resultado anterior é rotulado como a última proposta validada até novo envio.
- Uma proposta validada pode ser adicionada ao carrinho demonstrativo quando cada linha ainda corresponde a um item do catálogo e não há edições pendentes. O carrinho recebe quantidades e preços validados; continua sendo uma prévia local sem pedido.
- O montador permanece montado ao alternar abas, preservando formulário e resultado. A vitrine usa as variantes originais da logo branca, a paleta escura/laranja e as famílias tipográficas observadas.

## Verificação da demonstração no navegador

Em 03/10/2026, o carrinho abriu vazio sem interferir na proposta do montador. Ao adicionar o cooler do catálogo por R$ 23,52, a quantidade 2 mostrou subtotal de R$ 47,04. A lista persistiu após recarregar; a remoção funcionou, o foco ficou preso dentro da gaveta e Escape a fechou.

No montador determinístico, sem chamada de LLM, o pedido gamer com limite de R$ 5.000 gerou uma proposta de oito SKUs por R$ 4.263,26 e manteve `UNKNOWN` visível. A troca do SSD selecionado pelo Netac N535S 480 GB (SKU `30503254`, R$ 505,87) preservou o total da proposta em R$ 4.263,26, pois o preço era igual ao do item anterior. A proposta continuou disponível ao alternar abas; adicioná-la ao carrinho levou os oito SKUs, quantidade 2 para a RAM e subtotal de R$ 4.263,26.

O painel do SQLite mostrou 17 categorias, sete tabelas públicas, 1.236 produtos e 1.241 chunks, incluindo cinco guias. A barra de conexão mostrou presets do Ollama (`11434`) e LM Studio (`1234`) sem chave pré-configurada. O console do navegador não apresentou erros durante esses percursos.

Uma verificação em viewport de 390 px encontrou o grid com 420 px de largura e corte lateral. A correção foi incluída no commit `1c4f4f1` e confirmada no navegador: os painéis medem 368 px, a borda direita fica em 379 px e as linhas de peças medem 336 px. O cabeçalho da proposta foi empilhado no celular para manter o valor total completo dentro do painel. Na confirmação final com 32 GB, o total de R$ 4.862,08 termina em 363 px, dentro do painel cuja borda direita está em 379 px; a transferência à sacola manteve oito SKUs e nove unidades. A explicação completa fica recolhida em “Por que esta configuração?”; os avisos de compatibilidade usam português.

A pergunta “Como instalar memória RAM no PC com segurança?” foi conferida no chat: recebe o guia de instalação com citação Kingston, em vez de iniciar uma montagem. Há teste de regressão para manter esse comportamento mesmo após uma proposta anterior. A paleta escura/laranja também foi aplicada ao chat e aos painéis de SQLite, conexão e execuções.

## Limites

O carrinho local não reserva estoque nem cria pedidos. Preços e disponibilidade do montador são uma captura do catálogo e podem mudar; a validação mais recente do backend e regras de compatibilidade `UNKNOWN` continuam visíveis. A auditoria do configurador original cobriu o percurso descrito acima, sem validar todos os fluxos ou dispositivos.

Capturas finais: [vitrine desktop](screenshots/storefront-desktop.png), [vitrine mobile](screenshots/storefront-mobile.png), [montador desktop](screenshots/demo-builder-desktop.png), [montador mobile](screenshots/demo-builder-mobile.png) [chat com guia citado](screenshots/demo-chat-mobile.png) e [carrinho](screenshots/demo-cart.png).
