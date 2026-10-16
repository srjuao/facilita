-- Legacy contracts closed on the first day of their competence. This preserves
-- the historical due-date rule (the due day was always in the same month).
ALTER TABLE "PlatformContract"
  ADD COLUMN "closingDay" INTEGER NOT NULL DEFAULT 1
  CHECK ("closingDay" BETWEEN 1 AND 28);

-- Existing invoice values are immutable snapshots. Backfill only the newly
-- introduced closing date; do not recalculate a historical due date or amount.
ALTER TABLE "PlatformInvoice"
  ADD COLUMN "closingDate" TIMESTAMP(3),
  ADD COLUMN "closingDay" INTEGER NOT NULL DEFAULT 1
  CHECK ("closingDay" BETWEEN 1 AND 28);
UPDATE "PlatformInvoice"
SET "closingDate" = TO_DATE("competence" || '-01', 'YYYY-MM-DD')::timestamp;
ALTER TABLE "PlatformInvoice"
  ALTER COLUMN "closingDate" SET NOT NULL;
