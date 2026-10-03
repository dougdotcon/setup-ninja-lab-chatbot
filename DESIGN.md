# Sistema de design

## Marca e paleta

A vitrine usa a logo branca original da Setup Ninja, servida pelo CDN oficial. As variantes para desktop e dispositivos móveis estão copiadas em `public/assets/setupninja-logo-white.webp` e `public/assets/setupninja-logo-white-mobile.webp`; URLs originais e data da captura estão registradas em `docs/UX.md`.

A interface segue a paleta observada na loja: quase preto `#0e0e0e`, carvão `#111315` e `#1a1d21`, cinza escuro `#222222`, branco `#ffffff` e `#f0f0f0`, cinzas secundários `#888888` e `#aaaaaa`, além do laranja Setup Ninja `#ff7300` e do tom próximo `#fd7710`. O laranja destaca ações e seleções. Tons escuros formam o fundo, os cartões e os controles.

## Tipografia

Use Syne em títulos de destaque, Open Sans nos textos da interface e Inter em dados compactos. Mantenha nomes de produtos e rótulos em português legíveis em telas grandes e pequenas.

## Componentes e comportamento

- Cabeçalho, departamentos, catálogo, carrinho, montador, assistente e painéis administrativos compartilham a paleta escura.
- Use as cópias locais dos arquivos de logo obtidos pelo CDN; não redesenhe a marca com SVG ou texto.
- O carrinho armazena no local storage apenas IDs de catálogo e campos de apresentação. É uma demonstração sem ação de pedido ou pagamento.
- O montador envia IDs oficiais de catálogo para `/api/build`; o backend valida disponibilidade, orçamento e compatibilidade. Mantenha `UNKNOWN` visível como informação não confirmada.
- Controles de ação laranja precisam de estados claros de foco, hover, desabilitado, carregamento e erro sobre o fundo escuro.
