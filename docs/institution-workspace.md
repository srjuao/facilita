# Operação acadêmica da instituição

## Papéis e permissões

A coordenação administra a própria instituição ativa, sem depender de um curso único para criar períodos, matérias e aulas. O professor continua restrito ao curso associado e começa sem permissões administrativas. A coordenação concede individualmente `content.manage`, `students.manage`, `notices.manage`, `classes.manage` e `chat.create`. Alterações e revogações são verificadas no banco a cada chamada protegida; atualizar a página recarrega os itens disponíveis no menu.

Alunos leem seus conteúdos, avisos institucionais e turmas das quais participam. Não recebem permissões administrativas. Podem enviar mensagens nas conversas de que participam. A criação e a gestão de departamentos e permissões permanecem exclusivas da coordenação.

## Dados e limites

`/api/institution` exige autenticação, vínculo atual com instituição ativa e validação de pertencimento no servidor. Não aceita o tenant do formulário como autoridade. O diretório usa páginas de 200 usuários com cursor por ID; somente a coordenação recebe e-mail e permissões. A interface carrega as páginas necessárias antes de disponibilizar os seletores de pessoas.

Avisos são publicados para toda a unidade e listados do mais recente ao mais antigo (até 100). A gestão acadêmica parte do curso: nele a coordenação cria períodos, em cada período cria matérias e, dentro da matéria, cadastra aulas. Novas matérias exigem um período ativo do mesmo curso; novas aulas exigem matéria vinculada a período ativo. Turmas novas exigem curso e período ativo pertencente a esse curso, e seus integrantes devem estar associados ao curso. Turmas antigas sem período permanecem legíveis e podem ser vinculadas ao editar, sem perda de participantes. Cadastros não geram dados de demonstração.

Grupos de chat são criados pela coordenação ou por professores com `chat.create`. O criador participa automaticamente. Nem mesmo a coordenação pode ler conversas das quais não participa. Mensagens são texto simples (até 4.000 caracteres), com atualização por consulta a cada 15 segundos e exibição das últimas 100. Há limite local de 30 envios por usuário/conversa/minuto; não é um limitador distribuído entre réplicas. Sem anexos, notificações push ou promessa de entrega instantânea.

## Migração e escopo

A migration `20261016040000_institution_workspace` acrescenta permissões, departamentos, avisos, períodos, turmas e conversas, sem apagar registros existentes nem inserir exemplos. Professores existentes também começam sem grants; a coordenação deve revisar seus acessos. O deploy deve executar `prisma migrate deploy` antes de iniciar a API nova.

A migration `20261016180000_class_period_relation` acrescenta a referência opcional de período às turmas para preservar dados legados. A API exige esse vínculo nos novos cadastros. A tela **Cursos e estrutura** concentra a navegação curso → período → matéria → aulas; **Turmas** seleciona curso e período e mostra os dois vínculos no registro.

Departamentos organizam pessoas; não concedem automaticamente privilégios pelo nome (por exemplo, “Financeiro”). Funcionários têm contas próprias com permissões de alunos, avisos, criação de grupos e financeiro institucional quando explicitamente concedidas; não recebem poderes de professor ou coordenação. `finance.manage` permite configurar mensalidades, emitir faturas internas e registrar baixas manuais da própria instituição. Boletos bancários e conciliação integrada continuam para uma etapa futura. O ciclo de avaliações está descrito em `academic-cycle.md` e o financeiro em `institution-finance.md`.

## Separação dos financeiros definida pelo produto

O financeiro do Facilita (superadmin) cobra instituições/empresas pelo uso da plataforma, de acordo com o contrato/plano. O financeiro de cada instituição cobra mensalidades de seus próprios alunos, com valores e vencimentos definidos pela instituição. O preço por aluno do plano Facilita não é a mensalidade acadêmica do aluno.

São carteiras e permissões independentes: funcionários financeiros da instituição não recebem acesso à carteira do Facilita nem às cobranças de outras instituições. Emissão real de boletos depende de definir o provedor, a conta recebedora de cada carteira e a conciliação por notificações verificadas. As faturas internas têm histórico de emissão, baixa manual e cancelamento; não há confirmação bancária simulada ou movimentação de valores.
