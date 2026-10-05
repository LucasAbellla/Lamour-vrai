# Segurança do L'amour vrai

## O que esta fase protege

O espaço publicado foi desenhado para aceitar exatamente duas identidades: Lucas (`owner`) e Sofia (`partner`). O navegador não oferece cadastro. Os dois e-mails são transformados em hashes no banco e a criação de qualquer outro usuário é recusada por um gatilho no próprio sistema de autenticação.

O acesso exige três elementos independentes:

1. o link de uso único recebido no e-mail autorizado;
2. o código temporário TOTP do aplicativo autenticador;
3. a frase compartilhada do cofre.

As políticas do banco e das fotografias exigem uma sessão `aal2`, isto é, já confirmada pelo segundo fator. Mesmo uma chamada feita fora da interface não consegue ler dados sem pertencer ao casal e sem esse nível de autenticação.

## Criptografia de ponta a ponta

- O aplicativo cria uma chave aleatória AES-256 para o casal.
- A frase do cofre deriva uma segunda chave com PBKDF2-SHA-256 e 600.000 iterações.
- A chave do casal é embrulhada com AES-GCM. A frase não é enviada nem armazenada.
- Perfil, memórias, sonhos, cápsulas e cartas são cifrados no aparelho, com um contexto autenticado diferente para cada registro.
- Fotografias são cifradas antes do upload e o bucket permanece privado.
- A chave aberta vive apenas na memória da página. Bloquear o espaço encerra a sessão e a remove.
- A sessão de autenticação usa `sessionStorage`, não `localStorage`, reduzindo sua permanência no aparelho.

O servidor guarda identificadores técnicos, horários, tipo de registro, trilha de alterações e conteúdo cifrado. Ele não recebe os textos, fotografias nem a frase do cofre em formato legível.

## Limites honestos

Nenhum sistema conectado é invulnerável. Esta arquitetura reduz fortemente os riscos mais prováveis, mas não protege contra um aparelho já desbloqueado e comprometido, extensão maliciosa no navegador, captura da frase por outra pessoa ou alteração intencional do código publicado.

Por isso:

- usem celulares atualizados e bloqueados por biometria/senha;
- não instalem o app em aparelhos compartilhados;
- usem uma frase longa, única e não reutilizada;
- entreguem a frase um ao outro pessoalmente, não por e-mail junto com o link;
- guardem uma cópia física da frase em local seguro;
- mantenham os códigos/recuperação do autenticador separados da frase;
- publiquem somente por HTTPS e mantenham os cabeçalhos de `public/_headers` no provedor escolhido.

## Recuperação e perda de acesso

Sem a frase do cofre, o conteúdo cifrado não pode ser recuperado — nem pelo Supabase, nem pelo código do projeto. Isso é uma propriedade intencional da criptografia de ponta a ponta.

Se um celular for perdido:

1. encerre as sessões da conta afetada no painel do Supabase;
2. remova e cadastre novamente o fator TOTP após confirmar pessoalmente a identidade;
3. revogue o acesso ao e-mail no provedor de e-mail, se necessário;
4. revise `private.audit_log` para verificar alterações inesperadas.

Os backups do banco contêm apenas os dados cifrados. Para restaurá-los, a frase original continua sendo necessária.

## Segredos

A única chave permitida no cliente é a chave pública `anon`/publishable do Supabase, protegida por RLS. A `service_role` jamais deve aparecer em `.env`, no JavaScript, no build, no GitHub ou no celular. Operações administrativas são feitas diretamente no painel seguro do projeto.

## Checklist antes da publicação

- [ ] Projeto Supabase exclusivo para o L'amour vrai.
- [ ] Migração aplicada sem erros.
- [ ] Cadastro público desativado no painel.
- [ ] Apenas os dois hashes presentes em `private.allowed_users`.
- [ ] Ambos os usuários com TOTP verificado.
- [ ] URLs de redirecionamento limitadas ao domínio final HTTPS.
- [ ] Proteção da conta do Supabase com MFA.
- [ ] Cabeçalhos de segurança confirmados na hospedagem.
- [ ] Teste de conta não autorizada recusado.
- [ ] Teste de sessão sem TOTP recusado pelo banco.
- [ ] Teste de frase incorreta sem revelar dados.
- [ ] Cópia física da frase guardada com segurança.

