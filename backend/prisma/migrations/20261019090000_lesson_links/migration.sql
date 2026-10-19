CREATE TABLE "LessonLink" (
  "id" TEXT NOT NULL,
  "lessonId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LessonLink_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LessonLink_lessonId_idx" ON "LessonLink"("lessonId");
ALTER TABLE "LessonLink" ADD CONSTRAINT "LessonLink_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
