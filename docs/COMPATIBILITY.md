# Regras de compatibilidade

O motor está em `server/domain/compatibility.js`. Cada regra retorna `PASS`, `FAIL` ou `UNKNOWN`, além de mensagem e evidências com nomes/IDs do catálogo. `FAIL` significa que um dado publicado contradiz a montagem; `UNKNOWN` significa informação ausente e nunca é tratado como compatibilidade confirmada.

| Verificação | PASS / FAIL | Quando fica UNKNOWN |
|---|---|---|
| Estoque e quantidade | Cada SKU selecionado existe, está disponível e estoque agregado cobre a quantidade. Quantidade deve ser inteiro positivo. | Dados incompletos do registro (a montagem normalizada exige preço/estoque). |
| Processador e placa-mãe | Socket publicado coincide; exceção oficial por compatibilidade do produto é aplicada. | Um dos dois produtos não publica socket. |
| CPU com vídeo | CPU marcada sem iGPU exige placa dedicada; CPU com iGPU publicado passa. | O campo de vídeo integrado está ausente e não há GPU. |
| RAM, tipo e capacidade | Tipo DDR, quantidade de módulos, capacidade total e slots/capacidade máxima da placa. Exceção de SKU RAM `25889840` permite somente Intel. | A página não informa tipo, capacidade ou limites necessários. |
| Fonte | Potência mínima CPU/GPU, atributo PFC explicitamente falso e limite de TDP publicado. | Requisito ou capacidade numérica não foi publicada. Ausência de dado não é aprovação confirmada. |
| Cooler de CPU | Se CPU não inclui cooler, é obrigatório escolher um. Socket e TDP publicado do cooler precisam cobrir CPU. | SKU não informa cooler incluso, soquete ou TDP suficientes. |
| GPU e gabinete | Comprimento publicado da GPU é comparado com espaço máximo publicado do gabinete. | Falta comprimento ou folga. |
| Radiador e gabinete | Tamanho do water cooler comparado com tamanhos/posições publicadas. | Tamanho/posição do radiador não está descrito. |
| Placa-mãe e gabinete | Não se assume que Mini/Mid Tower aceitam ATX/mATX. | **Sempre UNKNOWN** quando o catálogo não traz formatos aceitos. |
| Armazenamento e placa-mãe | M.2/NVMe passa se há slot M.2 publicado; ausência de dados de interface não é inferida. | Interface/slots ou compatibilidade SATA não podem ser confirmados pela fonte. |

## Limites de evidência

A API não traz BIOS instalada, todos os fatores de forma aceitos, todos os conectores da PSU, posição/tolerância de cabos, algumas alturas/folgas ou benchmarks. `UNKNOWN` deve ser explicado antes de compra. A ferramenta não promete que todo sistema inicializa, mantém estabilidade elétrica ou alcança uma taxa de quadros.

O builder considera somente produtos em estoque e aplica orçamento ao total em centavos. Quantidades repetidas de RAM consomem estoque por SKU. Uma refinada mantém IDs das outras peças quando há candidatos que respeitem o orçamento e as regras; dependências relaxadas são devolvidas ao cliente. Uma escolha Jev passa novamente por este módulo antes de ser aceita.

Para a finalidade gamer, a ordenação tenta aproximar o total de 80% do teto, manter participação mínima de custo na GPU e preferir seis ou mais núcleos quando publicados. Configurações DDR3 antigas recebem grande penalidade quando o teto permite uma alternativa. São sinais transparentes de alocação/era e contagem publicada, não benchmarks ou alegações de que a opção ranqueada vence outra em jogos.
