import { PrismaClient } from '@prisma/client';
import { PlanError } from '../controllers/plan-policy';

export const commerceDb = new PrismaClient();
export type ContentAccount = { id: string; role: string; tenantId?: string | null; courseId?: string | null; tenant?: { ativo: boolean } | null };
export type ContentCourse = { id: string; tenantId: string; paidContent: boolean; contentPriceCents: number };
export class PaidCourseError extends PlanError {
  code = 'COURSE_ACCESS_REQUIRED';
  constructor(public courseId: string, public priceCents: number) {
    super(403, 'Este curso exige uma liberação de acesso pela instituição.');
  }
}

/** Account bindings must be hydrated from the database by the calling controller. */
export async function assertCourseContentAccess(account: ContentAccount, course: ContentCourse): Promise<void> {
  if (account.role === 'superadmin') return;
  if (account.tenant?.ativo === false || !account.tenantId || account.tenantId !== course.tenantId) throw new PlanError(403, 'Curso não disponível para esta conta.');
  if (account.role === 'coord') return;
  if (account.role === 'professor' && account.courseId === course.id) return;
  if (account.role !== 'aluno') throw new PlanError(403, 'Curso não disponível para esta conta.');
  if (typeof course.paidContent !== 'boolean' || !Number.isSafeInteger(course.contentPriceCents) || course.contentPriceCents < 0) throw new PlanError(503, 'Não foi possível verificar a oferta deste curso. Tente novamente.');
  const entitlement = await commerceDb.courseEntitlement.findUnique({ where: { courseId_userId: { courseId: course.id, userId: account.id } }, select: { active: true } });
  if (entitlement?.active) return;
  if (course.paidContent) throw new PaidCourseError(course.id, course.contentPriceCents);
  if (account.courseId !== course.id) throw new PlanError(403, 'Curso não disponível para esta conta.');
}

export function parseCoursePrice(value: unknown): number {
  if (typeof value !== 'string' || !/^\d{1,7}(?:[.,]\d{1,2})?$/.test(value.trim())) throw new PlanError(400, 'Informe um preço válido, por exemplo 49,90.');
  const [integer, fraction = ''] = value.trim().replace(',', '.').split('.');
  const cents = Number(integer) * 100 + Number(fraction.padEnd(2, '0'));
  if (cents > 100000000) throw new PlanError(400, 'O preço máximo é R$ 1.000.000,00.');
  return cents;
}
