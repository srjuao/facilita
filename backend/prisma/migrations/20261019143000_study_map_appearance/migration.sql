ALTER TABLE "StudyMap"
  ADD COLUMN "theme" TEXT NOT NULL DEFAULT 'classic',
  ADD COLUMN "backgroundColor" TEXT NOT NULL DEFAULT '#fbfcfe',
  ADD COLUMN "cardShape" TEXT NOT NULL DEFAULT 'rounded',
  ADD COLUMN "connectorStyle" TEXT NOT NULL DEFAULT 'solid';
