# Ativação privada

Roteiro para publicar o L'amour vrai e entregar no dia 31/10. Os e-mails reais, as senhas e as chaves **nunca** entram no repositório nem em arquivos salvos.

## Calendário

Calendário refeito em 26/10, quando a ativação ainda não tinha começado.

| Quando | Etapa | Resultado |
| --- | --- | --- |
| seg 26/10 | **A. Ensaio, parte 1**: Supabase de ensaio, Gmail como remetente e Cloudflare Pages já com o endereço definitivo, mas usando as chaves do ensaio | Site no ar, conectado ao projeto de ensaio |
| ter 27/10 | **A. Ensaio, parte 2**: o fluxo inteiro com dois e-mails seus, em dois navegadores ou aparelhos | O lado da Sofia comprovado sem estragar a surpresa |
| qua 28/10 | **B. Ambiente definitivo**: projeto Supabase novo, troca das variáveis no Cloudflare, autorização dos dois e seu primeiro acesso | Cofre real pronto |
| qui 29/10 | Conteúdo (memórias, carta, prelúdio, dedicatória) e testes de aceite | Tudo conferido |
| sex 30/10 | Folga para imprevistos | Nada novo, só calma |
| sáb 31/10 | **C. Entrega** | Sofia entra pela primeira vez com você ao lado |

O projeto do Cloudflare Pages é criado uma vez só, já no ensaio. Na parte B, basta trocar as duas variáveis do Supabase e publicar de novo, e o endereço continua o mesmo.

## A. Ensaio (sem a Sofia)

Faça o caminho inteiro uma vez num projeto descartável, usando **dois e-mails seus**: um no papel de Lucas e outro no papel da Sofia. Siga as etapas da parte B com estas diferenças:

- crie um projeto Supabase chamado algo como `lamour-ensaio`;
- no `bootstrap_couple`, use seus dois e-mails;
- no Cloudflare Pages, crie já o projeto definitivo (B3), mas com as chaves do projeto de ensaio;
- no SMTP, a mesma senha de app do Gmail serve para os dois projetos.

Ordem que evita idas e voltas:
1. Supabase de ensaio: B1, passos 1 a 3.
2. Gmail: B2.
3. Cloudflare Pages: B3.
4. Voltar ao Supabase para o B1, passo 4, com o endereço `.pages.dev`.
5. B4, com seus dois e-mails.

Teste, de preferência com dois aparelhos ou dois navegadores:

1. Entrar com o "segundo" e-mail **antes** de preparar o cofre: deve aparecer "Seu lugar está sendo preparado", e nunca o formulário de cadastro.
2. Entrar com o primeiro e-mail, preparar o cofre e guardar algumas memórias.
3. Entrar com o segundo e-mail e abrir com a frase: o prelúdio deve formar o nome da pessoa e a retrospectiva abrir em seguida, o topo deve mostrar os nomes na ordem invertida e a carta deve aparecer como "Uma carta de Lucas".
4. Escrever a carta pelo segundo e-mail e conferir no primeiro aparelho que as duas cartas existem e que nenhuma substituiu a outra.
5. Instalar o app no celular e entrar **pelo código de 6 números** do e-mail (no iPhone, o link abre no Safari, não no app instalado).
6. Rodar os testes de aceite da parte B.

Depois do ensaio, apague o projeto de teste (Project Settings → General → Delete project) ou pause-o. No plano gratuito, o Supabase permite dois projetos ativos, e o definitivo vai precisar da vaga.

Para passar ao ambiente definitivo no Cloudflare: **Settings → Variables and Secrets**, troque `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` pelos valores do projeto novo. Depois, em **Deployments**, use **Retry deployment** no último deploy. O endereço não muda.

## B. Ambiente definitivo

### B1. Supabase

1. Crie um projeto dedicado (região **South America (São Paulo)**) e guarde a senha do banco num gerenciador de senhas. Ative MFA na sua conta do Supabase.
2. **SQL Editor:** execute `supabase/migrations/20261005190000_secure_couple_vault.sql` e, depois, `supabase/migrations/20261030120000_remove_totp_requirement.sql`.
3. **Authentication → Sign In / Providers → Email:** cadastro público **desligado**, login anônimo **desligado**, confirmação de e-mail ligada.
4. **Authentication → URL Configuration:** Site URL = o endereço final do Cloudflare Pages (passo B3), por exemplo `https://seu-nome.pages.dev`; em Redirect URLs, o mesmo endereço seguido de `/**`.

**Se o projeto já está no ar com o autenticador:** execute `supabase/migrations/20261030120000_remove_totp_requirement.sql` uma vez no SQL Editor **antes** de publicar o site novo. O site antigo continua funcionando depois disso; o site novo, sem isso, não encontra o cofre. O autenticador que você já cadastrou pode ficar: ele só deixa de ser pedido.

### B2. E-mail próprio (obrigatório)

O envio padrão do Supabase **só entrega para membros da equipe do projeto**, com cerca de 2 e-mails por hora. Sem um SMTP próprio, o link e o código **não chegam para a Sofia**. A forma mais simples, sem precisar de domínio, é usar o seu Gmail:

1. Na sua Conta Google: Segurança → ative a **Verificação em duas etapas** → **Senhas de app** → crie uma senha para "L'amour vrai".
2. No Supabase: **Authentication → Emails → SMTP Settings** → Enable custom SMTP:
   - Host `smtp.gmail.com`, porta `465`;
   - usuário: o seu Gmail; senha: a senha de app gerada acima;
   - remetente: o mesmo Gmail; nome do remetente: `L'amour vrai`.
3. **Authentication → Emails → Templates → Magic Link**: mantenha o link e **inclua o código** (é ele que funciona no app instalado). Sugestão:
   - Assunto: `Seu acesso ao L'amour vrai`
   - Corpo:
     ```html
     <p>Um lugar só de vocês está esperando.</p>
     <p><a href="{{ .ConfirmationURL }}">Abrir o L'amour vrai</a></p>
     <p>Ou digite este código no aplicativo: <strong>{{ .Token }}</strong></p>
     <p>Se não foi você que pediu, ignore este e-mail.</p>
     ```

### B3. Cloudflare Pages

1. Em [dash.cloudflare.com](https://dash.cloudflare.com): **Workers & Pages → Create → Pages → Connect to Git** e escolha `LucasAbellla/Lamour-vrai`.
2. O nome do projeto vira o endereço (`<nome>.pages.dev`). Prefira algo discreto: a segurança vem do login, mas não há motivo para chamar atenção.
3. Configuração do build:
   - Production branch: `main`
   - Build command: `npm run build`
   - Build output directory: `dist`
4. **Environment variables → Production**:
   ```dotenv
   NODE_VERSION=22
   VITE_APP_ENV=production
   VITE_AUTH_MODE=supabase
   VITE_DATA_MODE=supabase
   VITE_STORAGE_NAMESPACE=lamour-vrai
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICAVEL
   ```
   A URL e a chave pública ficam em Supabase → Project Settings → API. Use somente a chave `anon`/publishable, **nunca** a `service_role` ou uma `sb_secret_…` (o app se recusa a abrir com elas).
5. **Settings → Builds → Branch control:** desative os deploys de preview. Sem as variáveis, eles publicariam versões quebradas.
6. Depois do primeiro deploy, confira a publicação:
   ```bash
   npm run verify:deploy -- https://seu-nome.pages.dev
   ```
   O script confere HTTPS, CSP, HSTS e os demais cabeçalhos, o cache, o manifest, o service worker, se o build aponta para o Supabase e se nenhuma chave administrativa vazou.

### B4. Autorizar somente vocês dois

No SQL Editor, substitua os dois valores e execute **uma única vez**:

```sql
select private.bootstrap_couple(
  'EMAIL_REAL_DE_LUCAS',
  'EMAIL_REAL_DA_SOFIA'
);
```

Não salve essa consulta preenchida. O banco guarda só o SHA-256 dos e-mails. O primeiro vira `owner` e o segundo, `partner`.

Depois, em **Authentication → Users → Add user → Create new user**, crie as duas contas com **Auto Confirm User** marcado e uma senha aleatória longa (ela nunca será usada, porque o acesso é por e-mail). **Não use "Invite user" para a Sofia:** isso dispara um e-mail para ela antes da hora.

### B4.1. E-mail provisório no lugar da Sofia (opcional)

Enquanto o projeto ainda recebe ajustes, um **segundo e-mail seu** pode ocupar o lugar da Sofia no `bootstrap_couple`. Ele precisa ser diferente do seu e-mail principal. Assim você confere a visão dela no ambiente definitivo.

1. Execute uma vez no SQL Editor o arquivo `supabase/migrations/20261028120000_replace_partner_email.sql`. Ele só cria a função de troca.
2. **Use a conta provisória só para olhar.** Tudo o que ela guardar conta como da Sofia: uma carta aparece como "Uma carta de Sofia", uma memória como "Guardada por Sofia", e um prelúdio vira o que ela escreveu para você. Se guardar algo para testar, apague pela própria conta provisória antes da troca.

**Antes da entrega (até 30/10), troque pelo e-mail real:**

1. No SQL Editor, execute o comando abaixo, sem salvar a consulta preenchida:
   ```sql
   select private.replace_partner_email('EMAIL_REAL_DA_SOFIA');
   ```
   A resposta diz o que fazer em seguida. Nada do cofre é apagado: o que a conta provisória salvou passa a constar como salvo por você, e as fotos também.
2. **Authentication → Users:** apague a conta do e-mail provisório.
3. **Add user → Create new user** com o e-mail real da Sofia, senha aleatória longa e **Auto Confirm User** marcado. Nunca "Invite user".
4. Rode o `acceptance.sql`. "Exatamente dois convites" e "Nenhuma conta além das duas" precisam estar `ok`.

O e-mail provisório perde o acesso na hora da troca.

### B5. Seu primeiro acesso e o conteúdo

1. Abra o endereço, peça o e-mail e entre pelo link ou pelo código.
2. Prepare o cofre: confira os nomes e a data e escolha uma frase com 14 caracteres ou mais. **Anote a frase em papel**; sem ela, nada pode ser recuperado.
3. Se você preparou conteúdo no modo local, exporte o backup nesse navegador e, já dentro do cofre, use **Trazer backup local** no rodapé. O app mostra um resumo, reduz as fotografias, cifra tudo no aparelho e só acrescenta o que ainda não existe; se a conexão cair, basta tentar de novo.
4. Escreva a carta pelo botão **Abrir o envelope**. Ela fica com a sua autoria; a Sofia vai poder escrever a dela sem apagar a sua.
5. Escreva as páginas de "Revisitar o primeiro ano" em **Escrever as páginas ✎**, ao lado de "Escrever o prelúdio". Cada página leva a data, a frase principal (`_assim_` fica em itálico, `*assim*` ganha o degradê), um texto menor e uma imagem de fundo. São elas que a Sofia vê logo depois do prelúdio.
6. Guarde a música na **Nossa rádio**, no botão do canto inferior esquerdo: escolha o arquivo (MP3 ou M4A, até 19 MB), confira o nome e o artista e toque em **Guardar no cofre**. Ela começa a tocar quando a Sofia passa do prelúdio.

### B6. Testes de aceite

1. No SQL Editor, execute `supabase/checks/acceptance.sql` (só leitura). Todas as linhas devem mostrar `ok`.
2. Manuais:
   - pedir acesso com um terceiro e-mail: não deve chegar nada utilizável;
   - frase errada: nenhum texto ou foto abre;
   - criar uma memória num aparelho: ela aparece no outro;
   - **Bloquear nosso espaço** (Ctrl+K): a sessão termina e a frase volta a ser pedida;
   - procurar uma palavra de uma memória real com a consulta comentada no fim do `acceptance.sql`: o resultado deve ser 0;
   - `npm run verify:deploy` sem nenhum ✗.

Os testes que dependem da Sofia (o lado `partner`) já foram feitos no ensaio.

## C. Dia 31: a entrega

Antes de encontrar a Sofia:

- abra o site e confira que tudo carrega;
- se usou um e-mail provisório, confira que ele já foi trocado pelo da Sofia (B4.1);
- tenha a frase do cofre **escrita à mão**. Ela pode ir dentro de um envelope de verdade, combinando com o envelope do app.

Com ela, pelo celular dela:

1. Abrir o endereço no Safari (iPhone) ou no Chrome (Android) e instalar na tela inicial (o app mostra o passo a passo em **Instalar no celular**).
2. Abrir o app instalado, digitar o e-mail dela e entrar com o **código** que chegar.
3. Digitar a frase do envelope. O prelúdio toca; no toque em **Entrar →** a música começa e a retrospectiva abre.

Cada pessoa tem a própria conta. A frase só abre a criptografia compartilhada; ela não substitui as contas individuais.
