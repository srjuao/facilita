# Planos, acessos e base financeira

> Regras implementadas em 2026-10-16.

## Conceitos e regras

- O catálogo começa vazio: não há plano de demonstração criado automaticamente.
- Um plano contém nome, descrição, modelo mensal (`FIXO` ou `POR_ALUNO`), preço inteiro em centavos, limite opcional de alunos e permissões para videoaulas, provas e IA. Os preços não usam as faixas do simulador da landing page.
- `FIXO` calcula uma mensalidade por instituição. `POR_ALUNO` multiplica o valor por aluno pela quantidade contabilizada. A estimativa é `null` quando não há plano vinculado; os valores são estimativas contratuais, não cobranças realizadas.
- O backend aceita preço entre 0 e 100.000.000 centavos, limite nulo ou de 1 a 1.000.000 alunos, nome de até 100 caracteres e descrição de até 1.000. As três permissões precisam ser informadas explicitamente.
- As condições comerciais não têm endpoint de edição. Para mudar preço, limite, descrição ou recursos, cria-se outra versão do plano e vincula-se a instituição a ela. O plano antigo pode ser desativado no catálogo: isso impede novos vínculos, mas preserva os contratos já associados. A interface permite reativá-lo.
- O vínculo da instituição pode ser removido, deixando `planId` nulo. Instituições legadas sem plano mantêm o acesso compatível com a regra anterior, sem limite contratado nem estimativa de cobrança.
- A contagem usada no contrato soma os registros acadêmicos de aluno dos cursos da instituição e as contas de usuário com perfil `aluno` sem registro acadêmico associado. Contas ligadas a um registro acadêmico não são somadas de novo.
- Ao vincular um plano, a quantidade atual precisa caber no limite. Ao cadastrar aluno, o backend verifica o vínculo e o limite dentro de transação; exceder o limite retorna HTTP 409. Instituição inativa não pode cadastrar aluno.
- A alteração do vínculo recebe também o `expectedPlanId`: se o vínculo mudou desde que a tela foi carregada, retorna HTTP 409 e exige atualizar a tela. O banco restringe a exclusão de um plano ainda referenciado por uma instituição (`onDelete: Restrict`).

## Recursos e autorização

- Gerir catálogo, vínculos e base financeira é exclusivo do superadmin. Rotas relevantes: `GET/POST /api/plans`, `PATCH /api/plans/:id/status`, `GET /api/subscriptions` e `PATCH /api/tenants/:id/plan`.
- As permissões `videoAulas`, `provas` e `ia` são carregadas do plano atual no banco, não confiadas a dados do token. O superadmin não é limitado pelo plano.
- `videoAulas` controla upload, consultas e apresentação das aulas. O streaming local usa URL assinada, expira em até duas horas e revalida usuário, curso, instituição ativa e permissão no momento do acesso. Mídia externa já cadastrada permanece uma URL externa; o sistema não controla sua hospedagem.
- `provas` controla o acesso às avaliações e a apresentação de provas no detalhe do curso.
- `ia` controla a permissão de acesso ao chat, mas não configura um provedor. O envio de mensagem responde HTTP 503 enquanto a integração de IA não estiver configurada; o sistema não inventa respostas.
- Para instituições sem plano, as verificações de recurso condicionado ao plano preservam o comportamento legado. ⚠️ O efeito operacional de remover um plano de uma instituição é liberar esse caminho legado; confirme a política comercial antes de usar essa opção.

## Base financeira atual

A tela **Financeiro por instituição** lista planos e quantidades, mostra a estimativa mensal por unidade e agrega a base estimada apenas das instituições ativas com plano. Também mostra instituições ativas aguardando vínculo. Unidades inativas permanecem na listagem, identificadas fora da previsão ativa.

Esta tela não cria faturas, boletos, cobranças nem confirma pagamentos. Ainda não há provedor de pagamentos, envio financeiro, vencimentos ou cadastro fiscal implementados. A base estimada não deve ser interpretada como receita recebida.

## Dados e migração

`Plan` armazena as condições e suas permissões. `Tenant.planId` é opcional e referencia `Plan` com exclusão restrita. A migração `backend/prisma/migrations/20261016010000_add_plans/migration.sql` cria o enum e a tabela de planos e adiciona a coluna anulável e a chave estrangeira; ela não preenche planos nem altera os vínculos legados existentes.

A migração é aditiva e não inclui script de reversão. ⚠️ Se houver necessidade de rollback após criar planos ou vínculos, preservar esses dados: não remover a tabela, a coluna ou a chave estrangeira automaticamente. Definir uma estratégia de reversão com backup e avaliação dos registros antes de qualquer mudança destrutiva.

## Referências de implementação

- Dados: `backend/prisma/schema.prisma` (`Tenant`, `Plan`, `BillingMode`).
- Validação e estimativa: `backend/src/controllers/plan-policy.ts`.
- Rotas e vínculo de planos: `backend/src/controllers/plan.controller.ts` e `backend/src/index.ts`.
- Limites e contagem: `backend/src/controllers/plan-access.ts`, `backend/src/controllers/student.controller.ts`.
- Acesso a vídeo: `backend/src/controllers/media-access.ts`.
- Interface de catálogo, vínculos e financeiro: `frontend/src/pages/superadmin/SuperAdminPlans.tsx`, `PlanAssignments.tsx` e `SuperAdminFinancial.tsx`.
