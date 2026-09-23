# L'amour vrai

Um arquivo afetivo particular para Lucas e Sofia: presente de um ano de namoro, álbum vivo e espaço para continuar guardando a história dos dois.

## O que já funciona

- contador real desde 31/10/2025;
- memórias com fotografia, data, categoria e descrição;
- busca, filtros, favoritos e visualização em álbum ou linha do tempo;
- edição e exclusão segura de memórias;
- constelação interativa formada pelas lembranças;
- memória aleatória com **Me surpreenda**;
- cápsulas do tempo com data de abertura;
- carta, pequenos detalhes, sonhos e experiência comemorativa;
- central rápida de ações com `Ctrl+K`;
- exportação e restauração de backup;
- funcionamento local e offline para as partes essenciais;
- interface responsiva e opção de redução de movimento.

## Executar como aplicativo

Requer Node.js instalado.

```bash
npm install
npm start
```

Para validar os arquivos JavaScript:

```bash
npm run check
```

## Personalização

Os nomes, a data inicial, as memórias de demonstração e os sonhos ficam no início de `dist/app.js`, logo abaixo de `PERSONALIZE A PARTIR DAQUI`.

Os principais arquivos são:

- `dist/index.html`: estrutura da experiência;
- `dist/styles.css`: identidade visual, responsividade e animações;
- `dist/app.js`: conteúdo, armazenamento e interações;
- `main.js`: janela segura do Electron.

## Privacidade e dados

As memórias, fotografias pequenas, sonhos e cápsulas são armazenados no próprio dispositivo com `localStorage`. Nenhum conteúdo é enviado automaticamente para serviços externos.

Use **Exportar backup** regularmente. Fotografias são limitadas a 1,5 MB nesta versão para evitar exceder o espaço disponível no navegador.
