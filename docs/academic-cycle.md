# Gestão e avaliações acadêmicas

## Avaliações

A coordenação gerencia avaliações em todos os cursos da instituição ativa. Professores precisam de `exams.manage` e ficam restritos ao curso associado. Funcionários não recebem essa permissão. O plano institucional precisa permitir provas e os alunos precisam ter vínculo/liberação de acesso ao curso, inclusive cursos pagos adicionais.

Uma avaliação começa como rascunho. Nome, limite de 1 a 20 tentativas e nota mínima de 0 a 10 são configuráveis antes de publicar. Cada questão contém enunciado, 2 a 6 alternativas, gabarito e explicação opcional. Questões removidas do rascunho são arquivadas. Publicar exige ao menos uma questão válida e congela as questões e os critérios; mudanças posteriores exigem outra avaliação. Avaliações publicadas podem ser arquivadas e restauradas, preservando resultados.

As alternativas corretas, comentários e distribuições históricas nunca são enviados ao aluno antes da entrega. O servidor exige respostas completas, corrige sem confiar em nota enviada pelo navegador e persiste nota, acertos, aprovação e uma fotografia das questões/respostas. Cada envio possui identificador idempotente. Contagem de tentativas e gravação são serializadas por bloqueios da avaliação e da conta, com restrições únicas no banco. Um reenvio do mesmo identificador não consome outra tentativa.

O histórico da avaliação é paginado. O aluno vê apenas seus resultados; coordenação e professores autorizados consultam resultados do curso. O histórico geral pessoal (`/api/assessments/my-results`) mantém resumos das notas disponíveis mesmo após arquivamento, revogação de curso ou alteração do plano, desde que a conta e sua instituição estejam ativas. Esse endpoint não entrega questões, respostas ou registros de colegas.

Não há correção discursiva, prazo cronometrado, banco global de questões ou certificado automático nesta etapa. As questões de múltipla escolha são corrigidas pelo servidor após cada envio; se o autor permitir várias tentativas, o feedback da tentativa anterior fica disponível ao aluno.

## Gestão sem exclusão física

Avisos, turmas, departamentos, períodos, matérias, aulas e grupos podem ser editados e arquivados/restaurados. Alterações exigem a versão/timestamp do registro para evitar sobrescrever outro operador. Turmas preservam seu curso e passam a referenciar também um período desse curso; novas turmas exigem período ativo, enquanto turmas legadas sem período podem ser corrigidas na edição. Novos participantes precisam pertencer ao curso. Grupos mantêm mensagens após arquivamento, mas bloqueiam novos envios. Remover um participante impede novas consultas/envios desse usuário à conversa.

Arquivar um período oculta suas matérias e aulas dos alunos. Arquivar uma matéria oculta suas aulas. Restaurar o ancestral devolve apenas os descendentes que não estejam arquivados individualmente. Vídeos locais verificam novamente o arquivamento da aula, matéria e período ao reproduzir, mesmo com link assinado ainda válido. Arquivamento não apaga arquivos ou registros.

## Funcionários

Contas `staff` são criadas e administradas pela coordenação em Funcionários, sem utilizar o papel de professor. As permissões delegáveis nesta etapa são `students.manage`, `notices.manage` e `chat.create`; sem grants, a pessoa só consulta avisos e suas conversas. Departamento não implica privilégio. Nenhuma permissão financeira é oferecida como se já estivesse funcional.

A coordenação edita nome, e-mail, departamento e permissões e pode desativar/reativar funcionários. Desativação bloqueia login e verificações de sessão atuais. O vínculo é revalidado dentro de operações protegidas; senhas são armazenadas com hash e nunca retornadas à interface. Departamentos arquivados podem manter vínculos existentes, mas não aceitam novas associações.

## Migração e validação

`20261016060000_academic_cycle` adiciona campos de arquivamento/versão, desativação de contas, publicação e tentativas de avaliações. Nenhum registro existente é apagado. Avaliações antigas começam como rascunho para revisão explícita pela coordenação; notas antigas não são convertidas em tentativas novas nem simuladas. O deploy deve executar a migração antes da API.

O financeiro permanece apenas planejado conforme `financial-design.md`: sem integração, cobranças, Pix ou emissão de boletos. Backups, auditoria de possíveis dados antigos de demonstração e validação visual autenticada em produção continuam verificações operacionais separadas.
