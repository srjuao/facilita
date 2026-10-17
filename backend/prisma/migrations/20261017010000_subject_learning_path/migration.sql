ALTER TABLE "Lesson" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
WITH ordered AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "moduleId" ORDER BY "id") AS ordinal
  FROM "Lesson"
)
UPDATE "Lesson" SET "position" = ordered.ordinal FROM ordered WHERE "Lesson"."id" = ordered."id";
CREATE INDEX "Lesson_moduleId_position_idx" ON "Lesson"("moduleId", "position");

ALTER TABLE "Module" ADD COLUMN "finalExamId" TEXT;
CREATE UNIQUE INDEX "Module_finalExamId_key" ON "Module"("finalExamId");
ALTER TABLE "Module" ADD CONSTRAINT "Module_finalExamId_fkey" FOREIGN KEY ("finalExamId") REFERENCES "Exam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "LessonCompletion" (
  "userId" TEXT NOT NULL,
  "lessonId" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LessonCompletion_pkey" PRIMARY KEY ("userId", "lessonId")
);
ALTER TABLE "LessonCompletion" ADD CONSTRAINT "LessonCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonCompletion" ADD CONSTRAINT "LessonCompletion_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LessonAttachment" (
  "id" TEXT NOT NULL,
  "lessonId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "storageName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LessonAttachment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LessonAttachment_lessonId_idx" ON "LessonAttachment"("lessonId");
ALTER TABLE "LessonAttachment" ADD CONSTRAINT "LessonAttachment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
