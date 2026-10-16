-- Only future records change; preserve existing academic content for review.
ALTER TABLE "Lesson" ALTER COLUMN "duracao" SET DEFAULT '';
ALTER TABLE "Lesson" ALTER COLUMN "prof" SET DEFAULT '';
