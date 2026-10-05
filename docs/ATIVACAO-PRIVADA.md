# Ativação privada da Fase 3

Esta etapa deve ser feita somente quando o projeto estiver pronto para publicação nos dois celulares. Os e-mails reais e as chaves não entram no repositório.

## 1. Criar o ambiente privado

Crie um projeto Supabase dedicado e proteja a conta administrativa com MFA. No SQL Editor, execute `supabase/migrations/20261005190000_secure_couple_vault.sql`.

Na área de autenticação do painel:

- mantenha o cadastro público desativado;
- mantenha login anônimo desativado;
- habilite TOTP;
- configure como URL principal apenas o endereço HTTPS final do aplicativo;
- mantenha somente os endereços locais necessários durante testes na lista de redirecionamentos.

O arquivo `supabase/config.toml` contém a mesma configuração para desenvolvimento local com a CLI.

## 2. Autorizar somente Lucas e Sofia

No SQL Editor, substitua os dois valores e execute uma única vez:

```sql
select private.bootstrap_couple(
  'EMAIL_REAL_DE_LUCAS',
  'EMAIL_REAL_DA_SOFIA'
);
```

Não salve essa consulta preenchida em arquivo. O banco armazena somente SHA-256 normalizado dos e-mails. Depois, convide/crie as duas pessoas no painel de autenticação. O primeiro e-mail recebe o papel `owner`; o segundo, `partner`.

O gatilho `activate_only_allowed_users` recusa qualquer endereço fora dessa lista, e `enforce_two_members` impede um terceiro membro mesmo em caso de erro administrativo.

## 3. Ligar o aplicativo ao ambiente

Crie `.env.production.local` apenas na máquina/serviço de build:

```dotenv
VITE_APP_ENV=production
VITE_AUTH_MODE=supabase
VITE_DATA_MODE=supabase
VITE_STORAGE_NAMESPACE=lamour-vrai
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICAVEL
```

Use somente a chave pública `anon`/publishable. Nunca use a `service_role`. O arquivo local já é ignorado pelo Git.

Execute:

```bash
npm run check
npm run build
```

## 4. Primeiro acesso

1. Lucas pede o link seguro com o e-mail autorizado.
2. Lucas cadastra o TOTP e informa o primeiro código.
3. Lucas define o perfil e uma frase de cofre com no mínimo 14 caracteres.
4. Lucas entrega a frase a Sofia pessoalmente ou por outro canal separado.
5. Sofia acessa com o próprio link, cadastra o próprio TOTP e abre o cofre com a mesma frase.

Cada pessoa usa sua identidade e seu autenticador. A frase apenas abre a criptografia compartilhada; ela não substitui as contas individuais.

## 5. Testes de aceite obrigatórios

- Tentar um terceiro e-mail: deve falhar.
- Usar uma sessão sem TOTP: tabelas e fotos devem retornar acesso negado.
- Usar frase errada: nenhum texto/foto deve abrir.
- Criar uma memória em um aparelho: ela deve aparecer cifrada no banco e chegar ao outro aparelho.
- Bloquear: a sessão local deve terminar e a chave deve desaparecer da memória.
- Inspecionar a tabela `vault_items`: palavras da memória não podem aparecer em `ciphertext`.
- Confirmar que o bucket `memory-media` está privado e guarda apenas `.bin` ilegíveis.

Só depois desses testes o PWA deve ser instalado nos dois celulares.

