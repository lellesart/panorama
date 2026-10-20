# Panorama

Central de leitura de notícias que reúne feeds RSS e Atom em uma interface editorial em português. Organize a leitura por tema e fonte, salve matérias e personalize o conteúdo exibido.

## Funcionalidades

- Navegação por cadernos temáticos e fontes de notícias.
- Visualizações em revista, cartões e lista compacta.
- Busca por título, resumo e nome da fonte.
- Cadastro, ativação, desativação e remoção de feeds.
- Silenciamento de notícias por palavras-chave e destaque de termos nos títulos.
- Recortes salvos e controle de notícias lidas.
- Painel de leitura com o conteúdo disponibilizado pelo feed e acesso à publicação original.
- Carregamento progressivo, cache da última edição e atualização manual.
- Interface responsiva para computadores e dispositivos móveis.

O catálogo inicial inclui política, esporte, cidades, estado do Rio de Janeiro, clima e cultura.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Interface | React 18 e TypeScript |
| Desenvolvimento e build | Vite 5 |
| Estilos e ícones | Tailwind CSS e Lucide React |
| Consultas e cache | TanStack Query |
| Estado e persistência | Zustand e `localStorage` |

## Executar localmente

Utilize Node.js 22 ou superior, npm e um navegador moderno. É necessário acesso à internet para carregar notícias, imagens e fontes externas.

Na pasta do projeto:

```bash
npm ci
npm run dev
```

Abra o endereço informado pelo Vite no terminal. A configuração atual não exige arquivo `.env`, chaves de API ou banco de dados.

### Comandos

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento com proxy RSS local. |
| `npm run build` | Verifica os tipos com TypeScript e gera a aplicação em `dist/`. |
| `npm run preview` | Permite conferir o build localmente, também com proxy RSS. |

O projeto ainda não possui uma suíte de testes automatizados.

## Funcionamento e dados

O serviço consulta as fontes habilitadas, normaliza os itens RSS e Atom e exibe as notícias conforme as consultas terminam. A ordenação considera a data e intercala fontes para diversificar a leitura.

Cada feed fornece até seis itens por consulta. O serviço utiliza cache em memória por dez minutos e armazena até 180 notícias da última edição no navegador.

A consulta tenta primeiro o endpoint local `/api/rss?url=`, implementado em `vite.config.ts`. Quando necessário, utiliza rss2json, CodeTabs, AllOrigins e corsproxy.io como alternativas. Algumas fontes do catálogo são consultadas por meio do Google News RSS.

Preferências, feeds cadastrados, recortes e histórico de leitura ficam no `localStorage`. Não há contas ou sincronização entre dispositivos. Limpar os dados do site remove essas informações.

As consultas podem passar pelos serviços externos citados acima. Imagens são carregadas de suas origens e as fontes tipográficas são obtidas pelo Google Fonts.

## Publicação

Execute `npm run build` e publique a pasta `dist/` em uma hospedagem estática.

O middleware `/api/rss` pertence aos servidores de desenvolvimento e preview do Vite e **não acompanha o build estático**. Nesse cenário, o carregamento depende dos serviços externos de fallback ou de um endpoint RSS implementado na infraestrutura de produção.

Para publicar em um subdiretório, como em um site de projeto do GitHub Pages, configure a opção `base` do Vite com o caminho correspondente antes do build.

`npm run preview` serve para conferência local. O proxy atual aceita URLs fornecidas pelo cliente; uma implementação pública deve restringir destinos e acesso à rede interna, além de limitar requisições.

## Limitações

- Feeds e proxies podem apresentar bloqueios, limites ou indisponibilidade.
- O painel apresenta o conteúdo fornecido pelo feed, que pode ser apenas um resumo. O texto completo pode exigir acesso ao site de origem.
- O cache recupera a última edição, mas não constitui suporte completo ao uso offline.
- O painel renderiza HTML dos feeds sem uma etapa dedicada de sanitização. Utilize fontes confiáveis; a sanitização deve ser implementada antes de ampliar o uso com conteúdo não confiável.

## Estrutura

```text
src/
├── App.tsx                 # Interface, navegação, filtros e painel de leitura
├── main.tsx                # Inicialização do React e do TanStack Query
├── index.css               # Estilos globais
├── data/defaultFeeds.ts    # Catálogo inicial e cores das categorias
├── services/rssService.ts  # Consulta, normalização e cache dos feeds
├── store/useNewsStore.ts   # Estado e persistência das preferências
└── types/news.ts           # Tipos de notícias e fontes
vite.config.ts              # Configuração do Vite e proxy RSS local
```

As fontes e categorias iniciais podem ser ajustadas em [`src/data/defaultFeeds.ts`](src/data/defaultFeeds.ts).

## Contribuição

Abra uma issue para relatar problemas ou propor melhorias. Em pull requests, descreva a alteração, informe como foi validada e execute `npm run build`. Para mudanças na interface, inclua capturas de tela quando ajudarem na revisão.

## Licença

O código do Panorama é distribuído sob a [licença MIT](LICENSE). A escolha favorece a reutilização e a colaboração, permitindo uso comercial, modificação e distribuição, desde que os avisos de copyright e de licença sejam preservados. Não há obrigação de publicar o código de versões derivadas.

A licença se aplica ao código do projeto. Notícias, imagens, marcas e outros conteúdos de terceiros permanecem sujeitos aos direitos e às condições de seus respectivos titulares. As dependências mantêm suas próprias licenças.
