-- Institution tuition is independent of the platform's commercial contracts.
CREATE TABLE "TuitionSettings" (
 "tenantId" TEXT PRIMARY KEY REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "mode" TEXT NOT NULL CHECK ("mode" IN ('SCHOOL','COURSE')),
 "schoolCents" INTEGER NOT NULL CHECK ("schoolCents" >= 0), "dueDay" INTEGER NOT NULL CHECK ("dueDay" BETWEEN 1 AND 28),
 "startMonth" TEXT NOT NULL, "issuerName" TEXT NOT NULL, "issuerDocument" TEXT NOT NULL,
 "issuerAddress" TEXT NOT NULL, "paymentInstructions" TEXT NOT NULL, "coursePrices" JSONB NOT NULL,
 "version" INTEGER NOT NULL DEFAULT 0, "updatedBy" TEXT NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "TuitionAdjustment" (
 "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "studentId" TEXT NOT NULL, "discountCents" INTEGER NOT NULL DEFAULT 0 CHECK ("discountCents" >= 0),
 "scholarship" BOOLEAN NOT NULL DEFAULT false, "startMonth" TEXT NOT NULL, "updatedBy" TEXT NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "TuitionAdjustment_tenantId_studentId_key" ON "TuitionAdjustment"("tenantId","studentId");
CREATE TABLE "TuitionInvoice" (
 "id" TEXT PRIMARY KEY, "number" TEXT NOT NULL, "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "studentId" TEXT NOT NULL, "studentName" TEXT NOT NULL, "studentEmail" TEXT NOT NULL,
 "courseId" TEXT, "courseName" TEXT, "mode" TEXT NOT NULL, "competence" TEXT NOT NULL, "dueDate" TIMESTAMP(3) NOT NULL,
 "grossCents" INTEGER NOT NULL CHECK ("grossCents" >= 0), "discountCents" INTEGER NOT NULL CHECK ("discountCents" >= 0),
 "totalCents" INTEGER NOT NULL CHECK ("totalCents" >= 0), "status" TEXT NOT NULL DEFAULT 'OPEN' CHECK ("status" IN ('OPEN','PAID','CANCELLED','EXEMPT')),
 "issuerName" TEXT NOT NULL, "issuerDocument" TEXT NOT NULL, "issuerAddress" TEXT NOT NULL, "paymentInstructions" TEXT NOT NULL,
 "settingsVersion" INTEGER NOT NULL, "version" INTEGER NOT NULL DEFAULT 0, "paidAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ("totalCents" = "grossCents" - "discountCents")
);
CREATE UNIQUE INDEX "TuitionInvoice_number_key" ON "TuitionInvoice"("number");
CREATE UNIQUE INDEX "TuitionInvoice_tenantId_studentId_competence_key" ON "TuitionInvoice"("tenantId","studentId","competence");
CREATE INDEX "TuitionInvoice_tenantId_id_idx" ON "TuitionInvoice"("tenantId","id");
CREATE INDEX "TuitionInvoice_tenantId_studentId_id_idx" ON "TuitionInvoice"("tenantId","studentId","id");
CREATE TABLE "TuitionInvoiceEvent" (
 "id" TEXT PRIMARY KEY, "invoiceId" TEXT NOT NULL REFERENCES "TuitionInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "action" TEXT NOT NULL, "note" TEXT NOT NULL, "actorId" TEXT NOT NULL, "actorName" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
