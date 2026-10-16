ALTER TABLE "LiveSession" ADD COLUMN "roomSize" INTEGER NOT NULL DEFAULT 30;

CREATE TABLE "LiveRoom" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "memberIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "facilitatorId" TEXT,
  CONSTRAINT "LiveRoom_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LiveRoom_sessionId_ordinal_key" ON "LiveRoom"("sessionId", "ordinal");
CREATE INDEX "LiveRoom_facilitatorId_idx" ON "LiveRoom"("facilitatorId");
CREATE INDEX "LiveRoom_memberIds_idx" ON "LiveRoom" USING GIN ("memberIds");
ALTER TABLE "LiveRoom" ADD CONSTRAINT "LiveRoom_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveRoom" ADD CONSTRAINT "LiveRoom_facilitatorId_fkey" FOREIGN KEY ("facilitatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
