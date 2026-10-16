-- One-time commercial configuration. Runtime pricing reads these records;
-- application startup must never recreate or overwrite them.
CREATE TABLE "PlanPoint" (
  "planId" TEXT NOT NULL,
  "students" INTEGER NOT NULL CHECK ("students" BETWEEN 1 AND 100000),
  "unitCents" INTEGER NOT NULL CHECK ("unitCents" BETWEEN 0 AND 100000000),
  CONSTRAINT "PlanPoint_pkey" PRIMARY KEY ("planId", "students"),
  CONSTRAINT "PlanPoint_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "PublicPricingSetting" (
  "id" INTEGER NOT NULL DEFAULT 1 CHECK ("id" = 1),
  "planId" TEXT,
  CONSTRAINT "PublicPricingSetting_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PublicPricingSetting_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "Plan" ("id", "nome", "descricao", "billingMode", "priceCents", "studentLimit", "videoAulas", "provas", "ia")
SELECT id, nome,
  'Cobrança mensal por alunos cadastrados, com curva gradual de preços. Gestão de cursos, professores e alunos, materiais, identidade visual, videoaulas e avaliações incluídos. Sem adicionais por módulo. IA indisponível até integração. Não altera contratos existentes.',
  'FAIXAS'::"BillingMode", 0, limite, true, true, false
FROM (VALUES
  ('institucional_20_v1', 'Institucional · até 20 alunos', 20),
  ('institucional_50_v1', 'Institucional · até 50 alunos', 50),
  ('institucional_100_v1', 'Institucional · até 100 alunos', 100),
  ('institucional_250_v1', 'Institucional · até 250 alunos', 250),
  ('institucional_500_v1', 'Institucional · até 500 alunos', 500),
  ('institucional_1000_v1', 'Institucional · 1.000 alunos ou mais', NULL)
) AS configured(id, nome, limite);

INSERT INTO "PlanPoint" ("planId", "students", "unitCents")
SELECT configured.id, prices.students, prices.cents
FROM (VALUES ('institucional_20_v1'), ('institucional_50_v1'), ('institucional_100_v1'), ('institucional_250_v1'), ('institucional_500_v1'), ('institucional_1000_v1')) AS configured(id)
CROSS JOIN (VALUES (20, 5790), (50, 3490), (100, 2290), (250, 1290), (500, 790), (1000, 430)) AS prices(students, cents);

INSERT INTO "PublicPricingSetting" ("id", "planId") VALUES (1, 'institucional_1000_v1');
