CREATE TABLE "StudentNotification" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "targetView" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  CONSTRAINT "StudentNotification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StudentNotification_userId_tenantId_createdAt_idx" ON "StudentNotification"("userId", "tenantId", "createdAt");
CREATE INDEX "StudentNotification_userId_readAt_idx" ON "StudentNotification"("userId", "readAt");
CREATE UNIQUE INDEX "StudentNotification_userId_kind_sourceId_key" ON "StudentNotification"("userId", "kind", "sourceId");
ALTER TABLE "StudentNotification" ADD CONSTRAINT "StudentNotification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentNotification" ADD CONSTRAINT "StudentNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
