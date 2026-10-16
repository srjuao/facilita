CREATE TYPE "LeadStage" AS ENUM ('NOVO', 'CONTATO', 'PROPOSTA', 'GANHO', 'PERDIDO');

CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "instituicao" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "alunos" INTEGER,
    "mensagem" TEXT NOT NULL DEFAULT '',
    "stage" "LeadStage" NOT NULL DEFAULT 'NOVO',
    "notas" TEXT NOT NULL DEFAULT '',
    "consentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");
CREATE INDEX "Lead_stage_idx" ON "Lead"("stage");
