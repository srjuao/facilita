ALTER TABLE "ClassGroup" ADD COLUMN "periodId" TEXT;

CREATE INDEX "ClassGroup_periodId_idx" ON "ClassGroup"("periodId");

ALTER TABLE "ClassGroup" ADD CONSTRAINT "ClassGroup_periodId_fkey"
  FOREIGN KEY ("periodId") REFERENCES "AcademicPeriod"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
