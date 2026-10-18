import { Prisma } from '@prisma/client';

type Db = Prisma.TransactionClient;

export async function notifyCourseLinked(db: Db, student: { id: string; tenantId: string; courseId: string; courseName: string; targetView?: string }) {
  await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${student.courseId}))`;
  await db.studentNotification.createMany({ data: [{
    tenantId: student.tenantId, userId: student.id, kind: 'course', sourceId: student.courseId,
    title: 'Novo curso vinculado', body: `${student.courseName} já está disponível para você.`, targetView: student.targetView || 'al-materias',
  }], skipDuplicates: true });
  const exams = await db.exam.findMany({ where: { courseId: student.courseId, published: true, archivedAt: null }, select: { id: true, nome: true } });
  if (exams.length) await db.studentNotification.createMany({ data: exams.map(exam => ({
    tenantId: student.tenantId, userId: student.id, kind: 'exam', sourceId: exam.id,
    title: 'Prova disponível no novo curso', body: `${exam.nome} · ${student.courseName}. Conclua as aulas obrigatórias para liberar a prova, se necessário.`,
    targetView: student.targetView === 'al-store' ? 'al-store' : 'al-provas',
  })), skipDuplicates: true });
}

async function notifyMany(db: Db, users: { id: string }[], data: { tenantId: string; kind: string; sourceId: string; title: string; body: string; targetView: string }) {
  for (let index = 0; index < users.length; index += 500) {
    await db.studentNotification.createMany({ data: users.slice(index, index + 500).map(user => ({ ...data, userId: user.id })), skipDuplicates: true });
  }
}

export async function notifyNewNotice(db: Db, notice: { id: string; tenantId: string; title: string; body: string }) {
  const students = await db.user.findMany({ where: { tenantId: notice.tenantId, role: 'aluno', disabledAt: null }, select: { id: true } });
  await notifyMany(db, students, {
    tenantId: notice.tenantId, kind: 'notice', sourceId: notice.id, title: notice.title,
    body: notice.body.slice(0, 240), targetView: 'al-notices',
  });
}

export async function notifyPublishedExam(db: Db, exam: { id: string; courseId: string; name: string }) {
  await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${exam.courseId}))`;
  const course = await db.course.findUniqueOrThrow({ where: { id: exam.courseId }, select: { tenantId: true, nome: true } });
  const students = await db.user.findMany({ where: {
    tenantId: course.tenantId, role: 'aluno', disabledAt: null,
    OR: [{ courseId: exam.courseId }, { courseEntitlements: { some: { courseId: exam.courseId, active: true } } }],
  }, select: { id: true, courseId: true } });
  for (let index = 0; index < students.length; index += 500) {
    await db.studentNotification.createMany({ data: students.slice(index, index + 500).map(student => ({
      tenantId: course.tenantId, userId: student.id, kind: 'exam', sourceId: exam.id,
      title: 'Nova prova disponível', body: `${exam.name} · ${course.nome}. Se houver aulas obrigatórias, conclua-as para liberar a prova.`,
      targetView: student.courseId === exam.courseId ? 'al-provas' : 'al-store',
    })), skipDuplicates: true });
  }
}
