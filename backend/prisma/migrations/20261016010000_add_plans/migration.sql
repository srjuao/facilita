CREATE TYPE "BillingMode" AS ENUM ('FIXO', 'POR_ALUNO');
CREATE TABLE "Plan" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "descricao" TEXT NOT NULL DEFAULT '',
  "billingMode" "BillingMode" NOT NULL,
  "priceCents" INTEGER NOT NULL CHECK ("priceCents" >= 0 AND "priceCents" <= 100000000),
  "studentLimit" INTEGER CHECK ("studentLimit" IS NULL OR "studentLimit" BETWEEN 1 AND 1000000),
  "videoAulas" BOOLEAN NOT NULL,
  "provas" BOOLEAN NOT NULL,
  "ia" BOOLEAN NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Tenant" ADD COLUMN "planId" TEXT;
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
