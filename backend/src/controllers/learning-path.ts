import { PrismaClient } from '@prisma/client';
import { signedLesson } from './media-access';
import { isLessonLocked } from './learning-path-policy';

export const learningDb = new PrismaClient();
export const lessonOrder = { position: 'asc' as const };

export async function learningState(moduleId: string, userId: string, role: string) {
  const [lessons, completions] = await Promise.all([
    learningDb.lesson.findMany({ where: { moduleId, archivedAt: null }, orderBy: [{ position: 'asc' }, { id: 'asc' }], include: { attachments: { select: { id: true, filename: true, mimeType: true, size: true } } } }),
    role === 'aluno' ? learningDb.lessonCompletion.findMany({ where: { userId, lesson: { moduleId, archivedAt: null } }, select: { lessonId: true } }) : Promise.resolve([])
  ]);
  const completed = new Set(completions.map(item => item.lessonId));
  const ids = lessons.map(item => item.id);
  const decorated = lessons.map((lesson, index) => {
    const locked = isLessonLocked(index, ids, completed, role);
    const { attachments, ...record } = lesson;
    const signed = locked ? record : signedLesson(record, userId);
    return { ...signed, videoUrl: locked ? null : signed.videoUrl,
      pdfUrl: locked ? null : lesson.pdfUrl, completed: completed.has(lesson.id), locked,
      attachments: locked ? [] : attachments.map(file => ({ ...file, downloadUrl: `/api/lessons/${lesson.id}/attachments/${file.id}/download` })) };
  });
  return { lessons: decorated, complete: lessons.every(item => completed.has(item.id)) };
}

export async function studentCanAccessLesson(lessonId: string, userId: string, role: string) {
  if (role !== 'aluno') return true;
  const lesson = await learningDb.lesson.findUnique({ where: { id: lessonId }, select: { id: true, moduleId: true } });
  if (!lesson) return false;
  const state = await learningState(lesson.moduleId, userId, role);
  return !!state.lessons.find(item => item.id === lessonId && !item.locked);
}

export async function studentCanAccessFinalExam(examId: string, userId: string, role: string) {
  if (role !== 'aluno') return true;
  const module = await learningDb.module.findUnique({ where: { finalExamId: examId }, select: { id: true } });
  if (!module) return true;
  return (await learningState(module.id, userId, role)).complete;
}
