ALTER TABLE "Course" ADD COLUMN "paidContent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "contentPriceCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "saleVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Course" ADD CONSTRAINT "Course_offer_check" CHECK (
  "contentPriceCents" BETWEEN 0 AND 100000000 AND "saleVersion" >= 0
  AND (("paidContent" AND "contentPriceCents" > 0) OR (NOT "paidContent" AND "contentPriceCents" = 0))
);
CREATE TABLE "CourseEntitlement" (
  "id" TEXT PRIMARY KEY, "courseId" TEXT NOT NULL REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "active" BOOLEAN NOT NULL DEFAULT true, "reason" TEXT NOT NULL,
  "actorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseEntitlement_courseId_userId_key" UNIQUE ("courseId", "userId")
);
CREATE INDEX "CourseEntitlement_userId_active_idx" ON "CourseEntitlement"("userId", "active");
CREATE TABLE "CourseAccessEvent" (
  "id" TEXT PRIMARY KEY, "courseId" TEXT NOT NULL REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "actorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "action" TEXT NOT NULL CHECK ("action" IN ('GRANT', 'REVOKE')), "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CourseAccessEvent_courseId_userId_createdAt_idx" ON "CourseAccessEvent"("courseId", "userId", "createdAt");
CREATE TABLE "CourseAccessRequest" (
  "id" TEXT PRIMARY KEY, "courseId" TEXT NOT NULL REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "quotedPriceCents" INTEGER NOT NULL CHECK ("quotedPriceCents" BETWEEN 1 AND 100000000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseAccessRequest_courseId_userId_key" UNIQUE ("courseId", "userId")
);
CREATE INDEX "CourseAccessRequest_userId_idx" ON "CourseAccessRequest"("userId");
