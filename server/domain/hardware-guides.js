export const HARDWARE_GUIDES = Object.freeze([
  {
    id: 'desktop-memory-install',
    title: 'Instalar memória RAM em um desktop',
    sourceTitle: 'Kingston Technology — instalação de memória em desktop',
    sourceUrl: 'https://www.kingston.com/en/support/technical/how-to-install-memory-desktop-pc',
    content: 'Desligue o computador e desconecte o cabo de energia. Antes de tocar nos módulos, descarregue a eletricidade estática tocando em metal aterrado ou use pulseira antiestática. Segure a memória pelas bordas, alinhe o entalhe do módulo com a chave do slot e pressione até as travas se fecharem. Para dois módulos, consulte o manual da placa-mãe para escolher os slots de dual channel. Não force um módulo desalinhado.',
  },
  {
    id: 'cpu-install-safety',
    title: 'Cuidados ao instalar processador e cooler',
    sourceTitle: 'AMD — instalação de Ryzen e cooler',
    sourceUrl: 'https://www.amd.com/en/resources/support-articles/faqs/CPU-Install.html',
    content: 'Confirme no manual da placa-mãe o soquete e a orientação do processador antes da instalação. Trabalhe com o equipamento desligado, proteja os componentes contra descarga eletrostática e não force o processador no soquete. Instale o cooler conforme o manual específico, confira a pasta térmica indicada pelo fabricante e conecte o cabo da ventoinha no conector CPU_FAN. Modelos e mecanismos de retenção variam.',
  },
  {
    id: 'bios-cpu-support',
    title: 'Verificar suporte de CPU e atualizar BIOS',
    sourceTitle: 'AMD — BIOS/UEFI para processadores Ryzen',
    sourceUrl: 'https://www.amd.com/en/resources/support-articles/faqs/cpu-99.html',
    content: 'Soquete igual, sozinho, não confirma suporte de processador: confira a lista de CPUs e a versão mínima de BIOS no site do fabricante da placa-mãe para o modelo e revisão exatos. Baixe somente o arquivo e o procedimento oficiais daquele modelo. Se a atualização for necessária, siga o manual da placa, use alimentação estável e não desligue o computador durante o processo. Alguns modelos oferecem atualização USB sem CPU; confirme isso no manual.',
  },
  {
    id: 'memory-not-detected',
    title: 'RAM não reconhecida ou computador não inicia',
    sourceTitle: 'Kingston Technology — suporte para memória desktop',
    sourceUrl: 'https://www.kingston.com/en/support/technical/products/desktop-notebook-memory',
    content: 'Desligue e desconecte a energia antes de reinstalar a memória. Confira se o tipo de memória é suportado pela placa-mãe e consulte o manual para a ordem correta dos slots. Alinhe o entalhe, encaixe o módulo até as travas prenderem e teste um módulo por vez se o problema continuar. O primeiro treinamento de memória pode demorar; siga o manual da placa antes de interromper a inicialização.',
  },
  {
    id: 'windows-install-media',
    title: 'Criar mídia oficial de instalação do Windows',
    sourceTitle: 'Microsoft Support — criar mídia de instalação',
    sourceUrl: 'https://support.microsoft.com/en-us/windows/deployment/install-upgrade/create-installation-media-for-windows',
    content: 'Baixe a ferramenta de criação de mídia somente no suporte oficial da Microsoft. A criação usa um pendrive vazio com pelo menos 8 GB e apaga o conteúdo existente; faça backup antes de iniciar. Depois, escolha o dispositivo de boot pelo menu da placa-mãe e siga as etapas oficiais. Confira os requisitos e a edição de Windows compatível com o computador.',
  },
]);

const HARDWARE_GUIDE_INTENT = /\b(?:como|instalar|instala[cç][aã]o|montar|atualizar|configurar|resolver|corrigir|n[aã]o reconhec(?:e|ida)|n[aã]o inicia|falha|bios|uefi|manual|passo a passo|d[uú]vida de hardware)\b/i;

export function isHardwareGuideQuery(query) {
  return HARDWARE_GUIDE_INTENT.test(String(query || ''));
}
