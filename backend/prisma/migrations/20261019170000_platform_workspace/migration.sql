CREATE TABLE "PlatformTicket" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "openedById" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformTicket_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PlatformTicketMessage" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformTicketMessage_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PlatformAuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "status" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlatformTicket_tenantId_createdAt_idx" ON "PlatformTicket"("tenantId", "createdAt");
CREATE INDEX "PlatformTicket_status_updatedAt_idx" ON "PlatformTicket"("status", "updatedAt");
CREATE INDEX "PlatformTicketMessage_ticketId_createdAt_idx" ON "PlatformTicketMessage"("ticketId", "createdAt");
CREATE INDEX "PlatformAuditLog_createdAt_idx" ON "PlatformAuditLog"("createdAt");
CREATE INDEX "PlatformAuditLog_actorId_createdAt_idx" ON "PlatformAuditLog"("actorId", "createdAt");
ALTER TABLE "PlatformTicket" ADD CONSTRAINT "PlatformTicket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformTicket" ADD CONSTRAINT "PlatformTicket_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformTicketMessage" ADD CONSTRAINT "PlatformTicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "PlatformTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformTicketMessage" ADD CONSTRAINT "PlatformTicketMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
