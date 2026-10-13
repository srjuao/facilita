# Higiene do repositório e rotação de segredos

## Finalidade e limite

Este runbook trata a exposição anterior de configuração e artefatos como um
incidente de segurança. Ele é um plano operacional: não execute remoção de
histórico, revogação de credenciais ou comandos na VPS sem uma janela aprovada,
backup validado e uma pessoa responsável pelo deploy.

Nunca cole chaves, senhas, URLs de conexão completas, tokens ou conteúdo de
arquivos `.env` em issues, chats, pull requests ou logs de CI.

## Inventário confirmado no estado atual

Os seguintes tipos de conteúdo ainda são rastreados pelo Git e devem sair do
índice e, após a rotação, do histórico remoto:

| Categoria | Localização | Risco | Destino correto |
| --- | --- | --- | --- |
| Configuração secreta | `backend/.env` | Segredo de JWT e URL de banco podem permitir falsificação de sessão ou acesso ao banco. | Cofre de segredos/configuração da plataforma. |
| Banco local | `backend/prisma/dev.db` | Pode conter dados pessoais, hashes e dados de teste. | Backup controlado e armazenamento restrito; recriar dados de desenvolvimento. |
| Mídias enviadas | `backend/uploads/videos/` | Pode conter conteúdo privado e torna o repositório pesado. | Armazenamento de objetos com controle de acesso. |
| Dependências instaladas | `backend/node_modules/`, `frontend/node_modules/` | Grande volume, binários por plataforma e cadeia de suprimentos difícil de revisar. | Reinstalação a partir de `package-lock.json`. |
| Saída compilada | `backend/dist/`, `frontend/dist/` | Artefato reprodutível; pode divergir do código-fonte. | Pipeline de build/artefato de release. |

`.gitignore` evita novas inclusões, mas não deixa de rastrear arquivos que já
foram versionados. A remoção do índice e a limpeza de histórico exigem a etapa
controlada abaixo.

## Sequência de contenção e rotação

1. Registre o incidente e restrinja temporariamente acesso ao repositório,
   VPS e banco ao menor grupo necessário. Preserve cópias de backup
   criptografadas antes de qualquer limpeza.
2. Revogue a chave de acesso à VPS que foi compartilhada e crie uma nova chave
   por pessoa/automação. Desabilite a chave antiga somente depois de testar o
   novo acesso. Revise `authorized_keys`, contas administrativas e registros
   de autenticação.
3. Gere um novo segredo JWT criptograficamente aleatório com pelo menos 32
   bytes. Atualize-o exclusivamente no cofre de segredos/deploy e reinicie de
   forma controlada. Como a chave anterior deve ser considerada exposta,
   invalide sessões e tokens emitidos antes da rotação.
4. Crie uma nova credencial de banco com privilégio mínimo para a aplicação.
   Atualize o secret de produção, teste a conexão e revogue a credencial
   antiga. Revise usuários, grants, conexões ativas e backups que a contenham.
5. Troque as credenciais de demonstração e force redefinição de senha para
   contas que possam ter sido expostas. Remova qualquer senha universal antes
   de reabrir o acesso.
6. Procure outros segredos em todo o histórico e em integrações relacionadas
   (CI/CD, registries, provedor DNS, e-mail, armazenamento de mídia). Rotacione
   cada valor confirmado ou potencialmente copiado.
7. Valide em ambiente de teste: login com uma conta legítima, invalidação de
   token antigo, conexão com o banco novo, deploy e rollback. Mantenha uma
   janela de observação após a produção.

## Remoção do índice e purga do histórico

Execute somente em uma cópia de trabalho limpa, depois da rotação e da
aprovação de todos que consomem o repositório.

1. Faça um clone de espelho privado para contingência e anote as branches,
   tags, forks, imagens de CI e releases que possam reter os dados.
2. Em um branch normal, retire do índice os arquivos sensíveis e artefatos
   listados no inventário, mantendo cópias locais quando necessárias. Faça um
   commit apenas com essa remoção e o `.gitignore`/modelos seguros.
3. Abra pull request e valide que um clone novo não recebe `.env`, banco,
   uploads, `node_modules` ou `dist`.
4. Para a purga histórica, use uma ferramenta revisada como `git filter-repo`
   em clone espelho, com lista explícita de caminhos. Não faça a operação no
   clone de desenvolvimento nem em produção.
5. Compare referências antes/depois, execute buscas de segredos e peça revisão
   independente. Em seguida, force-push coordenado de todas as referências
   reescritas e remova/atualize tags e releases que ainda apontem ao histórico
   anterior.
6. Oriente todos os colaboradores a descartar clones antigos e clonar de novo.
   Revise forks, caches de CI, artefatos de release e espelhos: reescrever o
   Git não revoga dados já copiados, por isso a rotação anterior é obrigatória.

## Verificação contínua

- CI deve falhar quando detectar `.env` real, chaves privadas, arquivos de
  banco, uploads, `node_modules` ou builds no índice.
- Use um scanner de segredos no pre-commit e no CI; bloqueie push de novos
  valores sem permitir que o próprio log revele o valor detectado.
- Mantenha modelos como `backend/.env.example` somente com placeholders.
- Armazene mídia em serviço próprio e bancos em backup criptografado, com
  testes periódicos de restauração e controle de acesso auditável.
