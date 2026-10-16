# Integridade dos dados nos painéis

> Gerado em 2026-10-16 · commit de referência: `d3cbdf6` (alterações locais em andamento podem não estar incluídas nesse commit).

## Regra geral

Painéis devem exibir dados persistidos obtidos pela API ou um estado vazio/indisponível. Não devem preencher indicadores, listas ou gráficos com exemplos que pareçam registros reais. O dashboard do superadmin lê instituições de `GET /tenants` e soma os cursos, usuários e matrículas retornados; mostra `—` quando as contagens necessárias não vieram da API. Esses totais são registros cadastrados, não previsões de uso ou de receita (`frontend/src/pages/superadmin/SuperAdminOverview.tsx`). O dashboard da coordenação lê o curso associado e suas matrículas pela API; o início do aluno usa a conta e o curso da sessão.

O navegador persiste somente o token de autenticação em `localStorage`. Dados acadêmicos são carregados pela API após autenticar (`frontend/src/auth/AuthContext.tsx`, `frontend/src/context/CourseContext.tsx`). Um formulário de lead, estado de carregamento ou prévia local de arquivo não equivale a um cadastro acadêmico persistido.

## Recursos que ainda não produzem indicadores

Quando a integração correspondente não existe, a interface deve informar essa condição e não inventar dados:

- Certificados: emissão e verificação ainda não integradas (`frontend/src/components/CertificateModal.tsx`).
- Alertas: dependem de eventos de aprendizagem e regras ainda não integrados (`frontend/src/pages/coord/CoordAlerts.tsx`).
- Turmas/subturmas: gestão e acompanhamento ainda sem registros integrados (`frontend/src/pages/coord/CoordSubs.tsx`).
- Flashcards e plano de estudos: cadastro/acompanhamento ainda não integrados (`frontend/src/pages/student/StudentFlashcards.tsx`, `frontend/src/pages/student/StudentStudyPlan.tsx`).
- Histórico de engajamento e métricas de aprendizagem: não há histórico para apresentar até que existam eventos reais. Não usar números fixos, séries de demonstração ou percentual inventado nos gráficos e dashboards.
- Assistente de IA: habilitar a permissão do plano não configura um provedor; respostas reais dependem da integração (`frontend/src/pages/student/AIChat.tsx`, `frontend/src/pages/superadmin/SuperAdminPlans.tsx`).

## Conteúdo acadêmico e mídias

Matérias, aulas, provas, cursos, usuários e matrículas devem vir de registros associados ao tenant e ao curso. A criação de aula grava o professor autenticado e uma duração vazia; a migração `20261016030000_remove_demo_lesson_defaults` remove defaults demonstrativos para novas aulas sem reescrever as antigas. Vídeos locais são liberados pela API com URL assinada e validade limitada; PDF cadastrado é aberto pelo endereço associado à aula (`backend/src/controllers/content.controller.ts`, `backend/src/controllers/media-access.ts`, `frontend/src/pages/student/LessonPlayer.tsx`).

## Planos e preços

Planos, faixas, preços e vínculo público da landing page são registros (`Plan`, `PlanPoint`, `PublicPricingSetting`) lidos do banco. As seis referências atualmente propostas — 20, 50, 100, 250, 500 e 1.000 alunos, com valores em centavos — foram inseridas por uma migração versionada; não são um catálogo montado em memória pelo painel (`backend/prisma/migrations/20261016020000_tiered_plans/migration.sql`). Alterações posteriores devem ser feitas no catálogo do superadmin. A estimativa financeira é uma base contratada, não fatura, boleto ou cobrança emitida (`frontend/src/pages/superadmin/SuperAdminFinancial.tsx`).

## Provisionamento de demonstração e dados antigos

O comando legado de seed foi desativado: `backend/src/seed/seed.ts` não conecta ao banco e encerra com erro explicativo. O comentário registra que a implementação anterior apagava registros antes de criar fixtures. Novas instituições começam sem cursos, alunos ou conteúdos de demonstração; apenas a conta administrativa informada na criação é vinculada (`backend/src/controllers/tenant.controller.ts`, `frontend/src/pages/superadmin/InstitutionCreateWizard.tsx`).

Isso documenta o código atual, mas não comprova que um banco já existente esteja limpo. **O banco de produção/legado não foi inspecionado nem purgado nesta documentação; não há acesso ao estado atual dos registros.** Identificadores ou nomes históricos como UNIFAN, Horizonte e UniSerra podem servir como pistas para uma auditoria, mas não provam que registros estejam sem uso. Nunca remover registros apenas por corresponderem a esses nomes. Antes de qualquer limpeza, obter backup restaurável, auditar relações e atividade, identificar os registros exatos, confirmar o ambiente e o alvo, e revisar o impacto de cada exclusão. Não executar seed legado nem limpeza por nome.

## Referências de implementação

- Dashboard global e seus critérios de contagem: `frontend/src/pages/superadmin/SuperAdminOverview.tsx`.
- Consulta real de tenants, cursos e contagens: `backend/src/controllers/tenant.controller.ts`.
- Criação de instituição vazia e conta responsável: `backend/src/controllers/tenant.controller.ts`, `frontend/src/pages/superadmin/InstitutionCreateWizard.tsx`.
- Seed de demonstração aposentado: `backend/src/seed/seed.ts`.
- Planos e preços: `backend/prisma/schema.prisma`, `backend/src/controllers/plan.controller.ts`, migrações `20261016020000_tiered_plans` e `20261016030000_remove_demo_lesson_defaults`.
