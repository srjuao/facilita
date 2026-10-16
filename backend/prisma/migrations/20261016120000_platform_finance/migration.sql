CREATE TABLE "PlatformContract" (
 "tenantId" TEXT PRIMARY KEY REFERENCES "Tenant"("id") ON DELETE RESTRICT,
 "minimumStudents" INTEGER NOT NULL CHECK ("minimumStudents" > 0), "unitCents" INTEGER NOT NULL CHECK ("unitCents" > 0), "dueDay" INTEGER NOT NULL CHECK ("dueDay" BETWEEN 1 AND 28),
 "billingName" TEXT NOT NULL, "billingDocument" TEXT NOT NULL, "billingAddress" TEXT NOT NULL, "billingEmail" TEXT NOT NULL,
 "issuerName" TEXT NOT NULL, "issuerDocument" TEXT NOT NULL, "issuerAddress" TEXT NOT NULL, "paymentInstructions" TEXT NOT NULL,
 "version" INTEGER NOT NULL DEFAULT 0, "updatedBy" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "PlatformInvoice" (
 "id" TEXT PRIMARY KEY, "number" TEXT NOT NULL UNIQUE,
 "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT, "competence" TEXT NOT NULL, "dueDate" TIMESTAMP(3) NOT NULL,
 "minimumStudents" INTEGER NOT NULL CHECK ("minimumStudents" > 0), "activeStudents" INTEGER NOT NULL CHECK ("activeStudents" >= 0), "billableStudents" INTEGER NOT NULL CHECK ("billableStudents" > 0),
 "unitCents" INTEGER NOT NULL CHECK ("unitCents" > 0), "totalCents" INTEGER NOT NULL CHECK ("totalCents" > 0), "contractVersion" INTEGER NOT NULL,
 "billingName" TEXT NOT NULL, "billingDocument" TEXT NOT NULL, "billingAddress" TEXT NOT NULL, "billingEmail" TEXT NOT NULL,
 "issuerName" TEXT NOT NULL, "issuerDocument" TEXT NOT NULL, "issuerAddress" TEXT NOT NULL, "paymentInstructions" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'OPEN' CHECK ("status" IN ('OPEN','PAID','CANCELLED')), "version" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "paidAt" TIMESTAMP(3),
 UNIQUE ("tenantId", "competence")
);
CREATE INDEX "PlatformInvoice_createdAt_idx" ON "PlatformInvoice"("createdAt");
CREATE TABLE "PlatformInvoiceEvent" (
 "id" TEXT PRIMARY KEY, "invoiceId" TEXT NOT NULL REFERENCES "PlatformInvoice"("id") ON DELETE RESTRICT,
 "action" TEXT NOT NULL, "note" TEXT NOT NULL, "actorId" TEXT NOT NULL, "actorName" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PlatformInvoiceEvent_invoiceId_createdAt_idx" ON "PlatformInvoiceEvent"("invoiceId", "createdAt");
