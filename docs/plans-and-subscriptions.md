# Planos, acessos e base financeira

> Regras implementadas em 2026-10-16.

## Conceitos e regras

- A migration `20261016020000_tiered_plans` cadastra uma vez seis planos institucionais iniciais. Eles são registros reais no banco, com IDs estáveis, e podem ser vinculados a instituições. A aplicação não recria nem sobrescreve esses planos durante a inicialização. Novos tenants continuam sem vínculo automático; seus contratos legados não são alterados pela migration.
- Um plano contém nome, descrição, modelo mensal (`FIXO`, `POR_ALUNO` ou `FAIXAS`), preço inteiro em centavos, limite opcional de alunos e permissões para videoaulas, provas e IA. `FIXO` calcula uma mensalidade por instituição; `POR_ALUNO` multiplica o preço por aluno pela quantidade contabilizada; `FAIXAS` calcula a mensalidade a partir de referências de quantidade e preço unitário persistidas em `PlanPoint`. A estimativa é `null` quando não há plano vinculado; valores estimados não são cobranças realizadas.
- `Plan.studentLimit` limita acesso/cadastro de alunos. `Plan.defaultMinimumStudents` é um mínimo comercial sugerido e pré-preenchido ao vincular o plano ou configurar o contrato no Financeiro; não define o limite de acesso. O plano institucional `institucional_1000_v1` recebe mínimo sugerido de 1.000 alunos apesar de não ter teto. A migration `20261016190500_plan_default_minimum` adiciona esse campo e configura essa sugestão apenas no plano mencionado; contratos e faturas existentes permanecem inalterados.
- Os seis planos iniciais seguem a mesma curva de referências: 20 alunos a R$ 57,90 por aluno; 50 a R$ 34,90; 100 a R$ 22,90; 250 a R$ 12,90; 500 a R$ 7,90; e 1.000 a R$ 4,30. Os cinco primeiros têm, respectivamente, limites de 20, 50, 100, 250 e 500 alunos; o plano de 1.000 não tem limite contratado. Todos incluem videoaulas e provas; IA permanece desativada. O preço acompanha a quantidade de alunos, sem adicional por módulo.
- Em `FAIXAS`, entre duas referências, interpola-se o total mensal proporcionalmente aos totais dos pontos. Abaixo da primeira referência, usa-se o preço unitário do primeiro ponto; acima da última, usa-se o preço unitário do último ponto. Os limites do plano continuam valendo para vinculação e cadastro, mesmo quando o cálculo por faixa consegue extrapolar o último ponto.
- A estimativa de `FAIXAS` usa os pontos ordenados do catálogo, cálculo racional inteiro e arredondamento half-up em centavos, com a mesma regra no backend e no simulador. Para uma instituição sem alunos, a mensalidade estimada é zero; sem plano, permanece `null`.
- O backend aceita preço entre 0 e 100.000.000 centavos, limite nulo ou de 1 a 1.000.000 alunos, nome de até 100 caracteres e descrição de até 1.000. As três permissões precisam ser informadas explicitamente.
- As condições comerciais não têm endpoint de edição. Para mudar preço, limite, descrição, permissões ou curva de faixas, cria-se outra versão do plano e vincula-se a instituição a ela. O plano antigo pode ser desativado no catálogo: isso impede novos vínculos, mas preserva os contratos já associados. A interface permite reativá-lo.
- O vínculo da instituição pode ser removido, deixando `planId` nulo. Instituições legadas sem plano mantêm o acesso compatível com a regra anterior, sem limite contratado nem estimativa de cobrança.
- A contagem usada no contrato soma os registros acadêmicos de aluno dos cursos da instituição e as contas de usuário com perfil `aluno` sem registro acadêmico associado. Contas ligadas a um registro acadêmico não são somadas de novo.
- Ao vincular um plano, a quantidade atual precisa caber no limite. Ao cadastrar aluno, o backend verifica o vínculo e o limite dentro de transação; exceder o limite retorna HTTP 409. Instituição inativa não pode cadastrar aluno.
- A alteração do vínculo recebe também o `expectedPlanId`: se o vínculo mudou desde que a tela foi carregada, retorna HTTP 409 e exige atualizar a tela. O banco restringe a exclusão de um plano ainda referenciado por uma instituição (`onDelete: Restrict`).

## Recursos e autorização

- Gerir catálogo, vínculos e base financeira é exclusivo do superadmin. Rotas relevantes: `GET/POST /api/plans`, `PATCH /api/plans/:id/status`, `GET /api/subscriptions` e `PATCH /api/tenants/:id/plan`.
- O simulador público obtém suas faixas por `GET /api/public/pricing`; não mantém uma tabela de preços alternativa no frontend. A publicação aponta para um plano ativo em `FAIXAS`, sem limite contratado e com ao menos dois pontos. O seletor administrativo usa `GET/PATCH /api/pricing-setting`; a atualização exige `expectedPlanId` para detectar alterações concorrentes. Um plano escolhido para publicação não pode ser desativado até que outro seja selecionado. Se não houver configuração válida, a API retorna erro e a landing não exibe valores estimados a partir de fallback local.
- As permissões `videoAulas`, `provas` e `ia` são carregadas do plano atual no banco, não confiadas a dados do token. O superadmin não é limitado pelo plano.
- `videoAulas` controla upload, consultas e apresentação das aulas. O streaming local usa URL assinada, expira em até duas horas e revalida usuário, curso, instituição ativa e permissão no momento do acesso. Mídia externa já cadastrada permanece uma URL externa; o sistema não controla sua hospedagem.
- `provas` controla o acesso às avaliações e a apresentação de provas no detalhe do curso.
- `ia` controla a permissão de acesso ao chat, mas não configura um provedor. O envio de mensagem responde HTTP 503 enquanto a integração de IA não estiver configurada; o sistema não inventa respostas.
- Para instituições sem plano, as verificações de recurso condicionado ao plano preservam o comportamento legado. ⚠️ O efeito operacional de remover um plano de uma instituição é liberar esse caminho legado; confirme a política comercial antes de usar essa opção.

## Base financeira atual

A tela **Financeiro** lista os contratos e as faturas da plataforma. Vincular um plano por aluno ou por faixas solicita dia de fechamento (`closingDay`, 1 a 28), dia de vencimento (`dueDay`, 1 a 28), mínimo contratado, preço unitário e dados de cobrança; o vínculo e o contrato são salvos juntos. `defaultMinimumStudents` e o preço de referência do catálogo são pré-preenchidos como sugestões; `studentLimit` não é a origem do mínimo sugerido. Essas sugestões não são condições contratuais automáticas: o operador precisa confirmar o mínimo contratado e o preço negociado. Planos fixos aguardam um modelo de fatura próprio. Instituições vinculadas antes desta mudança, ainda sem contrato, aparecem como pendentes para completar os dados.

Faturas são emitidas manualmente por competência somente a partir do dia civil de fechamento no fuso `America/Sao_Paulo`. O vencimento fica no mesmo mês quando `dueDay >= closingDay`; se o vencimento antecede o fechamento, fica no mês seguinte. A fatura preserva snapshot do fechamento e vencimento, além dos valores e dados de cobrança; mudanças no contrato só valem para novas faturas. Contratos legados usam `closingDay=1` como padrão, sem recalcular faturas já emitidas. Faturas podem ser impressas e aceitam baixa/cancelamento manual com histórico. Não há boleto bancário pagável, provedor de pagamentos, envio financeiro ou confirmação automática. A previsão mensal não é receita recebida. Regras completas: `financial-design.md`.

## Dados e migração

`Plan` armazena as condições e permissões, incluindo `studentLimit` (teto de acesso) e `defaultMinimumStudents` (mínimo sugerido para o contrato). `PlanPoint` armazena as referências de quantidade e preço unitário de um plano. `PublicPricingSetting` persiste o plano usado pelo simulador público. `Tenant.planId` é opcional e referencia `Plan` com exclusão restrita. `PlatformContract` armazena mínimo e preço negociados, dias de fechamento e vencimento, dados de cobrança e versão; `PlatformInvoice` persiste o snapshot das condições e das datas calculadas na emissão. A migration `20261016190000_platform_invoice_closing` adiciona `closingDay` ao contrato e `closingDay`/`closingDate` à fatura, ambos com fechamento legado no dia 1; preenche a data civil de fechamento das faturas antigas e preserva seus vencimentos e valores existentes. A migration `20261016190500_plan_default_minimum` adiciona o mínimo sugerido e define 1.000 para `institucional_1000_v1`. A migration `20261016010000_add_plans` criou o catálogo e a relação opcional; `20261016015000_add_tiered_mode` acrescenta o valor `FAIXAS` ao enum em uma etapa separada; `20261016020000_tiered_plans` adiciona `PlanPoint` e `PublicPricingSetting`, cadastra os seis planos e suas faixas e seleciona o plano institucional sem limite para o simulador. Não altera vínculos de tenants já existentes.

A migração é aditiva e não inclui script de reversão. ⚠️ Se houver necessidade de rollback após criar planos ou vínculos, preservar esses dados: não remover a tabela, a coluna ou a chave estrangeira automaticamente. Definir uma estratégia de reversão com backup e avaliação dos registros antes de qualquer mudança destrutiva.

## Referências de implementação

- Dados e faixas: `backend/prisma/schema.prisma` (`Tenant`, `Plan`, `PlanPoint`, `PublicPricingSetting`, `BillingMode`).
- Validação e estimativa: `backend/src/controllers/plan-policy.ts`.
- Rotas e vínculo de planos: `backend/src/controllers/plan.controller.ts` e `backend/src/index.ts`.
- Limites e contagem: `backend/src/controllers/plan-access.ts`, `backend/src/controllers/student.controller.ts`.
- Acesso a vídeo: `backend/src/controllers/media-access.ts`.
- Interface de catálogo, versões, publicação, vínculos e financeiro: `frontend/src/pages/superadmin/SuperAdminPlans.tsx`, `PublicPricingSelector.tsx`, `PlanAssignments.tsx` e `SuperAdminFinancial.tsx`.
- Curva pública e cálculo: `frontend/src/pricing.mjs` e `frontend/src/pages/Landing.tsx`.
