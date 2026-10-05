# L'amour vrai

Um arquivo afetivo particular para guardar memórias, cartas, sonhos e cápsulas do tempo. O projeto combina uma experiência web responsiva com uma versão opcional para computador.

A versão `0.3.0` também está preparada como Progressive Web App. Ela ainda não foi instalada nos aparelhos: os recursos foram implementados e validados localmente para que a distribuição aconteça somente quando o produto estiver completo.

## Estrutura atual

O projeto usa Vite e módulos JavaScript nativos.

```text
src/
├── config/          ambientes e integrações futuras
├── core/            dados, formatação e perfil
├── data/            modelos e valores neutros
├── features/
│   ├── auth/        cofre local e preparação para login online
│   ├── memories/    álbum, busca, favoritos e constelação
│   ├── capsules/    cápsulas do tempo
│   ├── dreams/      planos compartilhados
│   └── letters/     cartas particulares
├── styles/          tokens, visual principal e estilos estruturais
├── pwa/             instalação, estado de conexão e atualizações
└── ui/              feedback, diálogos e movimento
```

O conteúdo particular não fica no código-fonte. No primeiro acesso, o casal configura nomes, data, dedicação e uma frase de acesso. As informações são carregadas somente após o desbloqueio local.

> O cofre local organiza a preparação estrutural, mas não substitui uma autenticação online segura. A sincronização entre aparelhos será acrescentada em uma fase posterior.

## Executar no navegador

```bash
npm install
npm run dev
```

## Gerar a versão publicada

```bash
npm run build
npm run preview
```

O build produz automaticamente:

- `manifest.webmanifest` com nome, cores, atalhos e ícones;
- service worker e cache offline;
- ícones de 192 px, 512 px, Apple Touch e versão adaptável para Android;
- aviso de atualização controlada pelo usuário;
- experiência de instalação assistida para Android e iPhone.

Para recriar os ícones depois de modificar `public/icons/app-icon.svg`:

```bash
npm run icons
```

## Funcionamento offline

Depois do primeiro carregamento por HTTPS, a estrutura visual e os arquivos essenciais ficam disponíveis sem internet. O indicador da barra superior informa quando o aplicativo entrou em modo offline.

As atualizações não são aplicadas no meio de uma escrita. Quando uma versão nova estiver pronta, o aplicativo exibe um aviso e aguarda a confirmação para atualizar.

O site ainda não deve ser tratado como publicado para uso real. Antes da instalação nos celulares, faltam as fases de autenticação online, sincronização privada, armazenamento de fotografias e revisão final de conteúdo.

## Executar no computador

O Electron continua opcional e sempre usa a versão construída pelo Vite:

```bash
npm run desktop
```

## Ambientes

- `.env.development`: desenvolvimento local.
- `.env.production`: versão construída para publicação.
- `.env.example`: referência para futuras integrações.

Variáveis que contenham credenciais privadas nunca devem ser enviadas ao repositório. Chaves públicas de cliente só poderão ser usadas com políticas de acesso adequadas no servidor.

## Privacidade e dados

Nesta fase, memórias, fotografias pequenas, sonhos, cartas, cápsulas e perfil são armazenados no próprio dispositivo. O backup continua disponível na interface. Fotografias são limitadas a 1,5 MB enquanto o armazenamento em nuvem ainda não está ativo.

Dados de demonstração pessoais não são incluídos no código nem no build publicado.

O arquivo `robots.txt` bloqueia a indexação por mecanismos de busca durante esta etapa. Isso reduz descoberta acidental, mas não substitui autenticação: a proteção real do conteúdo compartilhado será implementada antes da publicação final.

## Validação

```bash
npm run check
npm run test:smoke
```

O teste automatizado cobre manifest, service worker, abertura offline, cofre local, memória, sonho, carta, cápsula, bloqueio, desbloqueio e layout móvel.
