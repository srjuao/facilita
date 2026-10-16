import { PlanError } from '../controllers/plan-policy';

export function integer(value: unknown, name: string, min = 0, max = 2147483647): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new PlanError(400, `${name} inválido.`);
  return value;
}
export function billingAmount(minimumStudents: number, activeStudents: number, unitCents: number) {
  integer(minimumStudents, 'Mínimo contratado', 1); integer(activeStudents, 'Alunos ativos'); integer(unitCents, 'Preço por aluno', 1);
  const billableStudents = Math.max(minimumStudents, activeStudents);
  const totalCents = billableStudents * unitCents;
  integer(totalCents, 'Total da cobrança', 1);
  return { billableStudents, totalCents };
}
export function dueDate(competence: unknown, day: number) {
  if (typeof competence !== 'string' || !/^(20\d{2})-(0[1-9]|1[0-2])$/.test(competence)) throw new PlanError(400, 'Informe a competência no formato AAAA-MM (2000 a 2099).');
  integer(day, 'Dia de vencimento', 1, 28);
  return new Date(`${competence}-${String(day).padStart(2, '0')}T00:00:00.000Z`);
}
export function contractData(body: Record<string, unknown>) {
  const labels: Record<string, string> = { billingName: 'nome do contratante', billingDocument: 'documento do contratante', billingAddress: 'endereço do contratante', billingEmail: 'e-mail de cobrança', issuerName: 'nome do emitente', issuerDocument: 'documento do emitente', issuerAddress: 'endereço do emitente', paymentInstructions: 'instruções de pagamento' };
  const text = (key: string, max: number, required = true) => {
    if (typeof body[key] !== 'string' || (required && !(body[key] as string).trim()) || (body[key] as string).trim().length > max) throw new PlanError(400, `Preencha ${labels[key]} corretamente (até ${max} caracteres).`);
    return (body[key] as string).trim();
  };
  const minimumStudents = integer(body.minimumStudents, 'Mínimo contratado', 1);
  const unitCents = integer(body.unitCents, 'Preço por aluno', 1);
  billingAmount(minimumStudents, 0, unitCents);
  const billingEmail = text('billingEmail', 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail)) throw new PlanError(400, 'E-mail de cobrança inválido.');
  return { minimumStudents, unitCents, dueDay: integer(body.dueDay, 'Dia de vencimento', 1, 28), billingName: text('billingName', 180), billingDocument: text('billingDocument', 60), billingAddress: text('billingAddress', 500), billingEmail,
    issuerName: text('issuerName', 180), issuerDocument: text('issuerDocument', 60), issuerAddress: text('issuerAddress', 500), paymentInstructions: text('paymentInstructions', 2000, false) };
}
