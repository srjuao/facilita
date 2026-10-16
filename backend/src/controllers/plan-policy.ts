export class PlanError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function validatePlan(body: any) {
  if (!body || typeof body.nome !== 'string' || !body.nome.trim() || body.nome.length > 100) throw new PlanError(400, 'Informe o nome do plano com até 100 caracteres.');
  if (typeof body.descricao !== 'string' || body.descricao.length > 1000) throw new PlanError(400, 'Informe uma descrição de até 1.000 caracteres.');
  if (!['FIXO', 'POR_ALUNO'].includes(body.billingMode) || !Number.isInteger(body.priceCents) || body.priceCents < 0 || body.priceCents > 100000000) throw new PlanError(400, 'Informe modalidade e preço mensal válidos em centavos.');
  if (body.studentLimit !== null && (!Number.isInteger(body.studentLimit) || body.studentLimit < 1 || body.studentLimit > 1000000)) throw new PlanError(400, 'Informe limite entre 1 e 1.000.000 alunos ou sem limite.');
  if (['videoAulas', 'provas', 'ia'].some(key => typeof body[key] !== 'boolean')) throw new PlanError(400, 'Selecione explicitamente os recursos do plano.');
  return { nome: body.nome.trim(), descricao: body.descricao.trim(), billingMode: body.billingMode as 'FIXO' | 'POR_ALUNO', priceCents: body.priceCents as number, studentLimit: body.studentLimit as number | null, videoAulas: body.videoAulas as boolean, provas: body.provas as boolean, ia: body.ia as boolean };
}

export function estimatedCents(plan: { billingMode: string; priceCents: number } | null, studentCount: number) {
  return plan ? plan.priceCents * (plan.billingMode === 'POR_ALUNO' ? studentCount : 1) : null;
}

export function assertCapacity(limit: number | null, count: number, additions = 1) {
  if (limit !== null && count + additions > limit) throw new PlanError(409, `O limite de ${limit} alunos do plano foi atingido. Altere o plano antes de cadastrar mais alunos.`);
}
