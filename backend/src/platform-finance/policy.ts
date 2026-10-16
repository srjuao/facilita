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
export function closingDate(competence: unknown, day: number) {
  if (typeof competence !== 'string' || !/^(20\d{2})-(0[1-9]|1[0-2])$/.test(competence)) throw new PlanError(400, 'Informe a competência no formato AAAA-MM (2000 a 2099).');
  integer(day, 'Dia de fechamento', 1, 28);
  return new Date(`${competence}-${String(day).padStart(2, '0')}T00:00:00.000Z`);
}
export function dueDate(competence: unknown, day: number, closingDay = 1) {
  const closing = closingDate(competence, closingDay);
  integer(day, 'Dia de vencimento', 1, 28);
  const due = new Date(Date.UTC(closing.getUTCFullYear(), closing.getUTCMonth() + (day < closingDay ? 1 : 0), day));
  if (due.getUTCFullYear() > 2099) throw new PlanError(400, 'Vencimento fora do período permitido.');
  return due;
}
export function assertClosureReached(competence: unknown, day: number, now = new Date()) {
  const closing = closingDate(competence, day);
  // Business dates are evaluated in the institution's operating timezone, not UTC.
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(item => item.type === type)?.value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const cutoff = closing.toISOString().slice(0, 10);
  if (today < cutoff) throw new PlanError(409, `A fatura da competência ${competence} só pode ser emitida a partir de ${String(day).padStart(2, '0')}/${String(competence).slice(5, 7)}/${String(competence).slice(0, 4)} (horário de Brasília).`);
  return closing;
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
  return { minimumStudents, unitCents, dueDay: integer(body.dueDay, 'Dia de vencimento', 1, 28), closingDay: integer(body.closingDay, 'Dia de fechamento', 1, 28), billingName: text('billingName', 180), billingDocument: text('billingDocument', 60), billingAddress: text('billingAddress', 500), billingEmail,
    issuerName: text('issuerName', 180), issuerDocument: text('issuerDocument', 60), issuerAddress: text('issuerAddress', 500), paymentInstructions: text('paymentInstructions', 2000, false) };
}
