-- A plan can suggest a contractual floor independently from its access cap.
ALTER TABLE "Plan"
  ADD COLUMN "defaultMinimumStudents" INTEGER
  CHECK ("defaultMinimumStudents" IS NULL OR "defaultMinimumStudents" BETWEEN 1 AND 1000000);

-- The persisted 1,000-or-more catalog plan has no maximum, but starts at 1,000.
-- This is a suggestion for future contracts; existing contracts and invoices stay unchanged.
UPDATE "Plan"
SET "defaultMinimumStudents" = 1000
WHERE "id" = 'institucional_1000_v1';
