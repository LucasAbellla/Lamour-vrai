# L'amour vrai

Um arquivo afetivo particular para guardar memórias, cartas, sonhos e cápsulas do tempo. O projeto combina uma experiência web responsiva com uma versão opcional para computador.

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
