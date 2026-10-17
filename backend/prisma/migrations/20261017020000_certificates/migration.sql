CREATE TABLE "CertificateTemplate" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "title" TEXT NOT NULL,
  "issuer" TEXT NOT NULL,
  "signatory" TEXT NOT NULL,
  "signatoryRole" TEXT NOT NULL,
  "workloadHours" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CertificateTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CertificateTemplate_tenantId_scope_targetId_key" ON "CertificateTemplate"("tenantId", "scope", "targetId");
ALTER TABLE "CertificateTemplate" ADD CONSTRAINT "CertificateTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CertificateIssue" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "snapshot" JSONB NOT NULL,
  CONSTRAINT "CertificateIssue_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CertificateIssue_code_key" ON "CertificateIssue"("code");
CREATE UNIQUE INDEX "CertificateIssue_userId_scope_targetId_key" ON "CertificateIssue"("userId", "scope", "targetId");
CREATE INDEX "CertificateIssue_tenantId_issuedAt_idx" ON "CertificateIssue"("tenantId", "issuedAt");
ALTER TABLE "CertificateIssue" ADD CONSTRAINT "CertificateIssue_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CertificateTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CertificateIssue" ADD CONSTRAINT "CertificateIssue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CertificateIssue" ADD CONSTRAINT "CertificateIssue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
