# L'amour vrai

Um arquivo afetivo particular para guardar memórias, cartas, sonhos e cápsulas do tempo. O projeto combina uma experiência web responsiva com uma versão opcional para computador.

A versão `0.4.0` acrescenta a Fase 3 de privacidade: acesso exclusivo para duas contas, link de uso único, regras no banco, fotografias privadas e criptografia de ponta a ponta. Ela ainda não foi instalada nos aparelhos: a ativação real ficará para quando o produto estiver completo.

## Estrutura atual

O projeto usa Vite e módulos JavaScript nativos.

```text
src/
├── config/          ambientes e integrações futuras
├── core/            dados, formatação e perfil
├── data/            modelos e valores neutros
├── features/
│   ├── auth/        acesso local e autenticação privada com segundo fator
│   ├── memories/    álbum, busca, favoritos e constelação
│   ├── capsules/    cápsulas do tempo
│   ├── dreams/      planos compartilhados
│   └── letters/     cartas particulares
├── styles/          tokens, visual principal e estilos estruturais
├── security/        criptografia e sincronização do cofre
├── pwa/             instalação, estado de conexão e atualizações
└── ui/              feedback, diálogos e movimento
```

O conteúdo particular não fica no código-fonte. Em produção, os dados são cifrados no aparelho e o servidor recebe apenas o conteúdo ilegível. O acesso exige uma das duas contas autorizadas, o link ou código por e-mail e a frase compartilhada do cofre.

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

O build de produção exige as variáveis do ambiente privado. Para visualizar o protótipo local sem conectar o servidor, use `npm run build:local`.

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

O site ainda não foi publicado nem instalado. A autenticação, sincronização e proteção de fotos estão implementadas; a criação do ambiente privado e os testes com os dois e-mails serão feitos apenas na etapa de ativação.

## App para computador

O instalador do Windows abre o site publicado numa janela própria, usando a placa de vídeo. Nenhuma chave ou conteúdo particular vai dentro dele, e ele precisa de internet para abrir o cofre.

[Baixar o instalador](https://github.com/LucasAbellla/Lamour-vrai/releases/latest/download/Lamour-vrai-Instalador.exe). Ele não tem assinatura digital, então o Windows avisa na primeira vez: **Mais informações → Executar assim mesmo**.

### Atualizações

- O que muda no site chega pela própria página, cerca de um minuto depois do envio para a `main`. Na tela de entrada o app passa sozinho para a versão nova; com o cofre aberto, ele mostra um aviso.
- O que muda no próprio app (`main.js`, `desktop/`, ícones ou dependências) aciona o workflow `desktop.yml`, que publica uma versão nova no GitHub. O app confere ao abrir, ao voltar para a janela e a cada 10 minutos, baixa sozinho e pergunta se pode atualizar. Com **Depois**, ela entra quando o app fechar.

Para gerar o instalador em `release/` sem publicar:

```bash
npm run desktop:build
```

Para testar a versão local construída pelo Vite, sem instalar:

```bash
npm run desktop
```

## Ambientes

- `.env.development`: desenvolvimento local.
- `.env.production`: exige o modo seguro para a versão publicada.
- `.env.example`: referência para futuras integrações.

Variáveis que contenham credenciais privadas nunca devem ser enviadas ao repositório. Chaves públicas de cliente só poderão ser usadas com políticas de acesso adequadas no servidor.

## Privacidade e dados

No desenvolvimento local, os registros continuam no navegador para facilitar o protótipo. Em produção, memórias, perfil, sonhos, cartas e cápsulas usam AES-GCM; fotografias são cifradas antes de entrar no bucket privado. A frase e a chave aberta não são persistidas.

Dados de demonstração pessoais não são incluídos no código nem no build publicado.

Leia [docs/SECURITY.md](docs/SECURITY.md) para o modelo de segurança e [docs/ATIVACAO-PRIVADA.md](docs/ATIVACAO-PRIVADA.md) para a preparação final sem expor e-mails ou credenciais.

## Validação

```bash
npm run check
npm run test:smoke
```

`npm run check` também valida criptografia, frase incorreta, contexto autenticado, fotografia cifrada, políticas RLS, AAL2, limite de duas contas e modo seguro de produção. O teste visual cobre manifest, service worker, abertura offline, cofre local, memória, sonho, carta, cápsula, bloqueio, desbloqueio e layout móvel.
