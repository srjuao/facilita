import { Prisma, PrismaClient } from '@prisma/client';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();
const monthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

export async function getCoordDashboard(req: AuthRequest, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ error: 'Sua conta não está vinculada a uma instituição.' });
    const requestedCourse = req.query.courseId;
    const requestedMonths = Number(req.query.months ?? 6);
    if (requestedCourse !== undefined && (typeof requestedCourse !== 'string' || requestedCourse.length > 160)) return res.status(400).json({ error: 'Curso inválido.' });
    if (![3, 6, 12].includes(requestedMonths)) return res.status(400).json({ error: 'Período inválido.' });

    const courses = await prisma.course.findMany({ where: { tenantId }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } });
    if (requestedCourse && !courses.some(course => course.id === requestedCourse)) return res.status(404).json({ error: 'Curso não encontrado nesta instituição.' });
    const courseIds = requestedCourse ? [requestedCourse] : courses.map(course => course.id);
    const now = new Date();
    const firstMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - requestedMonths + 1, 1));
    const months = Array.from({ length: requestedMonths }, (_, index) => monthKey(new Date(Date.UTC(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth() + index, 1))));
    const courseWhere = { courseId: { in: courseIds } };
    const [students, modules, lessons, completions, attempts, upcomingSessions] = await Promise.all([
      prisma.user.findMany({ where: { tenantId, role: 'aluno', disabledAt: null, ...(requestedCourse ? courseWhere : {}) }, select: { id: true, courseId: true } }),
      prisma.module.findMany({ where: { archivedAt: null, courseId: { in: courseIds }, OR: [{ periodId: null }, { period: { archivedAt: null } }] }, select: { id: true, nome: true, courseId: true, finalExamId: true } }),
      prisma.lesson.findMany({ where: { archivedAt: null, module: { archivedAt: null, courseId: { in: courseIds }, OR: [{ periodId: null }, { period: { archivedAt: null } }] } }, select: { id: true, moduleId: true } }),
      prisma.$queryRaw<{ lessonId: string; count: number }[]>(Prisma.sql`
        SELECT lc."lessonId", COUNT(*)::integer AS count
        FROM "LessonCompletion" lc
        JOIN "Lesson" l ON l."id" = lc."lessonId" AND l."archivedAt" IS NULL
        JOIN "Module" m ON m."id" = l."moduleId" AND m."archivedAt" IS NULL
        JOIN "Course" c ON c."id" = m."courseId" AND c."tenantId" = ${tenantId}
        JOIN "User" u ON u."id" = lc."userId" AND u."tenantId" = ${tenantId} AND u."role" = 'aluno' AND u."disabledAt" IS NULL AND u."courseId" = c."id"
        WHERE (${requestedCourse || null}::text IS NULL OR c."id" = ${requestedCourse || null})
        GROUP BY lc."lessonId"
      `),
      prisma.examAttempt.findMany({ where: { createdAt: { gte: firstMonth }, exam: { archivedAt: null, courseId: { in: courseIds } }, user: { tenantId, role: 'aluno', disabledAt: null, ...courseWhere } }, select: { userId: true, examId: true, score: true, passed: true, createdAt: true, user: { select: { nome: true, courseId: true } } } }),
      prisma.liveSession.count({ where: { tenantId, courseId: { in: courseIds }, startsAt: { gte: now }, status: 'scheduled' } })
    ]);

    const lessonModule = new Map(lessons.map(lesson => [lesson.id, lesson.moduleId]));
    const lessonCounts = new Map<string, number>();
    const completionCounts = new Map<string, number>();
    lessons.forEach(lesson => lessonCounts.set(lesson.moduleId, (lessonCounts.get(lesson.moduleId) ?? 0) + 1));
    completions.forEach(completion => { const id = lessonModule.get(completion.lessonId); if (id) completionCounts.set(id, (completionCounts.get(id) ?? 0) + completion.count); });
    const studentsPerCourse = new Map<string, number>();
    students.forEach(student => { if (student.courseId) studentsPerCourse.set(student.courseId, (studentsPerCourse.get(student.courseId) ?? 0) + 1); });
    const examScores = new Map<string, { userId: string; name: string; score: number }[]>();
    for (const attempt of attempts) {
      const scores = examScores.get(attempt.examId) ?? [];
      const previous = scores.find(score => score.userId === attempt.userId);
      if (!previous) scores.push({ userId: attempt.userId, name: attempt.user.nome, score: attempt.score });
      else previous.score = Math.max(previous.score, attempt.score);
      examScores.set(attempt.examId, scores);
    }
    const subjects = modules.map(module => {
      const count = lessonCounts.get(module.id) ?? 0;
      const eligibleStudents = studentsPerCourse.get(module.courseId) ?? 0;
      const completed = completionCounts.get(module.id) ?? 0;
      const scored = module.finalExamId ? examScores.get(module.finalExamId) ?? [] : [];
      return { id: module.id, name: module.nome, courseId: module.courseId, courseName: courses.find(course => course.id === module.courseId)?.nome ?? '', lessons: count, completedLessons: completed, possibleCompletions: eligibleStudents * count, completionPercent: eligibleStudents && count ? Math.round(100 * completed / (eligibleStudents * count)) : null, averageScore: scored.length ? Math.round(scored.reduce((sum, entry) => sum + entry.score, 0) / scored.length * 10) / 10 : null, gradedStudents: scored.length, standout: scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, 3).map(({ userId, name, score }) => ({ userId, name, score })) };
    });

    // Financial data is limited to institution coordinators. It is never returned to teachers or students.
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const invoices = await prisma.tuitionInvoice.findMany({ where: { tenantId, ...(requestedCourse ? { courseId: requestedCourse } : {}), OR: [{ competence: { in: months } }, { paidAt: { gte: firstMonth, lt: nextMonth } }] }, select: { competence: true, status: true, totalCents: true, dueDate: true, paidAt: true } });
    const finance = months.map(month => {
      const rows = invoices.filter(invoice => invoice.competence === month && invoice.status !== 'CANCELLED' && invoice.status !== 'EXEMPT');
      const paid = invoices.filter(invoice => invoice.status === 'PAID' && invoice.paidAt && monthKey(invoice.paidAt) === month);
      return { month, issuedCents: rows.reduce((sum, row) => sum + row.totalCents, 0), receivedCents: paid.reduce((sum, row) => sum + row.totalCents, 0), openCents: rows.filter(row => row.status === 'OPEN').reduce((sum, row) => sum + row.totalCents, 0), invoices: rows.length };
    });
    const overdue = invoices.filter(invoice => months.includes(invoice.competence) && invoice.status === 'OPEN' && invoice.dueDate < now).length;
    const assessment = months.map(month => ({ month, attempts: attempts.filter(attempt => monthKey(attempt.createdAt) === month).length, approved: attempts.filter(attempt => monthKey(attempt.createdAt) === month && attempt.passed).length }));
    return res.json({ courses, selectedCourseId: requestedCourse || null, months: requestedMonths, totals: { students: students.length, courses: courseIds.length, subjects: modules.length, lessons: lessons.length, upcomingSessions, examAttempts: attempts.length, overdueInvoices: overdue }, subjects, assessment, finance, financialNotice: 'Valores de faturas internas. Recebimentos são baixados manualmente; não representam conciliação bancária.' });
  } catch {
    return res.status(503).json({ error: 'Não foi possível carregar os indicadores. Tente novamente.' });
  }
}
