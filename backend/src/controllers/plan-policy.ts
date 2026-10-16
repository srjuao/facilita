export class PlanError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function validatePlan(body: any) {
  if (!body || typeof body.nome !== 'string' || !body.nome.trim() || body.nome.length > 100) throw new PlanError(400, 'Informe o nome do plano com até 100 caracteres.');
  if (typeof body.descricao !== 'string' || body.descricao.length > 1000) throw new PlanError(400, 'Informe uma descrição de até 1.000 caracteres.');
  if (!['FIXO', 'POR_ALUNO', 'FAIXAS'].includes(body.billingMode) || !Number.isInteger(body.priceCents) || body.priceCents < 0 || body.priceCents > 100000000) throw new PlanError(400, 'Informe modalidade e preço mensal válidos em centavos.');
  if (body.studentLimit !== null && (!Number.isInteger(body.studentLimit) || body.studentLimit < 1 || body.studentLimit > 1000000)) throw new PlanError(400, 'Informe limite entre 1 e 1.000.000 alunos ou sem limite.');
  if (['videoAulas', 'provas', 'ia'].some(key => typeof body[key] !== 'boolean')) throw new PlanError(400, 'Selecione explicitamente os recursos do plano.');
  const points = body.billingMode === 'FAIXAS' ? validatePricePoints(body.pricePoints) : [];
  if (body.billingMode === 'FAIXAS' && body.priceCents !== 0) throw new PlanError(400, 'Planos por faixas devem usar preço-base zero; informe os preços nas faixas.');
  if (points.length && body.studentLimit !== null && body.studentLimit < points[0].students) throw new PlanError(400, 'O limite do plano deve alcançar a primeira referência de alunos.');
  return { nome: body.nome.trim(), descricao: body.descricao.trim(), billingMode: body.billingMode as 'FIXO' | 'POR_ALUNO' | 'FAIXAS', priceCents: body.priceCents as number, studentLimit: body.studentLimit as number | null, videoAulas: body.videoAulas as boolean, provas: body.provas as boolean, ia: body.ia as boolean, ...(points.length ? { pricePoints: { create: points } } : {}) };
}

export type PricePoint = { students: number; unitCents: number };
export function validatePricePoints(value: unknown): PricePoint[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 20) throw new PlanError(400, 'Informe de 2 a 20 referências de preço.');
  const points = value.map(point => {
    if (!point || !Number.isInteger(point.students) || point.students < 1 || point.students > 100000 || !Number.isInteger(point.unitCents) || point.unitCents < 0 || point.unitCents > 100000000) throw new PlanError(400, 'Informe alunos e preços inteiros válidos para cada faixa.');
    return { students: point.students, unitCents: point.unitCents };
  });
  for (let i = 1; i < points.length; i++) {
    const before = points[i - 1], after = points[i];
    if (after.students <= before.students || after.unitCents > before.unitCents || after.students * after.unitCents < before.students * before.unitCents) throw new PlanError(400, 'As referências devem ter alunos crescentes, valor por aluno não crescente e total mensal não decrescente.');
  }
  return points;
}

export function estimatedCents(plan: { billingMode: string; priceCents: number; pricePoints?: PricePoint[] } | null, studentCount: number) {
  if (!plan) return null;
  if (plan.billingMode !== 'FAIXAS') return plan.priceCents * (plan.billingMode === 'POR_ALUNO' ? studentCount : 1);
  const points = plan.pricePoints;
  if (!points || points.length < 2) return null;
  if (studentCount <= 0) return 0;
  if (studentCount <= points[0].students) return studentCount * points[0].unitCents;
  for (let i = 1; i < points.length; i++) {
    const before = points[i - 1], after = points[i];
    if (studentCount <= after.students) {
      const gap = BigInt(after.students - before.students);
      const beforeTotal = BigInt(before.students) * BigInt(before.unitCents);
      const afterTotal = BigInt(after.students) * BigInt(after.unitCents);
      const numerator = beforeTotal * gap + BigInt(studentCount - before.students) * (afterTotal - beforeTotal);
      return Number((2n * numerator + gap) / (2n * gap));
    }
  }
  return studentCount * points[points.length - 1].unitCents;
}

export function assertCapacity(limit: number | null, count: number, additions = 1) {
  if (limit !== null && count + additions > limit) throw new PlanError(409, `O limite de ${limit} alunos do plano foi atingido. Altere o plano antes de cadastrar mais alunos.`);
}
