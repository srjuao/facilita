import { createHmac, timingSafeEqual } from 'crypto';
import { Request, Response } from 'express';
import path from 'path';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const MAX_AGE = 2 * 60 * 60;
const secret = () => {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error('Media signing unavailable');
  return value;
};
const signatureFor = (lessonId: string, user: string, expires: string) => createHmac('sha256', secret()).update(JSON.stringify(['facilita:lesson-media:v1', lessonId, user, expires])).digest('hex');
export const localVideoFilename = (url: string) => /^\/(?:api\/)?uploads\/videos\/([a-zA-Z0-9_-][a-zA-Z0-9_.-]*\.(?:mp4|webm|mov))$/i.exec(url)?.[1] || null;
export function signedLesson<T extends { id: string; videoUrl: string }>(lesson: T, userId: string, now = Date.now()): T {
  if (!localVideoFilename(lesson.videoUrl)) return lesson;
  const expires = String(Math.floor(now / 1000) + MAX_AGE);
  const signature = signatureFor(lesson.id, userId, expires);
  return { ...lesson, videoUrl: `/api/media/lessons/${encodeURIComponent(lesson.id)}?user=${encodeURIComponent(userId)}&expires=${expires}&signature=${signature}` };
}
export function validMediaSignature(lessonId: string, user: unknown, expires: unknown, signature: unknown, now = Date.now()) {
  if (typeof user !== 'string' || !user || user.length > 100 || typeof expires !== 'string' || !/^\d{10}$/.test(expires) || typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const seconds = Math.floor(now / 1000);
  if (Number(expires) <= seconds || Number(expires) > seconds + MAX_AGE) return false;
  return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(signatureFor(lessonId, user, expires), 'hex'));
}
export async function streamLessonMedia(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    const { user, expires, signature } = req.query;
    if (!validMediaSignature(req.params.id, user, expires, signature)) return res.status(403).json({ error: 'Link de vídeo inválido ou expirado. Atualize a aula.' });
    const [account, lesson] = await Promise.all([
      prisma.user.findUnique({ where: { id: user as string }, include: { tenant: { include: { plan: true } } } }),
      prisma.lesson.findUnique({ where: { id: req.params.id }, include: { module: { include: { course: true } } } })
    ]);
    if (!account || !lesson) return res.status(404).json({ error: 'Vídeo não encontrado.' });
    if (account.role !== 'superadmin' && (!account.tenant?.ativo || (account.role !== 'coord' && account.courseId !== lesson.module.courseId) || account.tenantId !== lesson.module.course.tenantId || account.tenant.plan && !account.tenant.plan.videoAulas)) return res.status(403).json({ error: 'Seu acesso a este vídeo não está mais disponível.' });
    const filename = localVideoFilename(lesson.videoUrl);
    if (!filename) return res.status(404).json({ error: 'Vídeo local não encontrado.' });
    // sendFile supports HTTP Range requests for native HTML video seeking.
    return res.sendFile(path.resolve(__dirname, '../../uploads/videos', filename), error => {
      if (error && !res.headersSent) res.status(404).json({ error: 'Arquivo de vídeo não encontrado.' });
    });
  } catch {
    if (!res.headersSent) return res.status(503).json({ error: 'Não foi possível verificar o acesso ao vídeo.' });
  }
}
