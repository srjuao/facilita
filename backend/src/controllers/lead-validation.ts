export const leadStages = ['NOVO', 'CONTATO', 'PROPOSTA', 'GANHO', 'PERDIDO'] as const;
const objectBody = (body: unknown): body is Record<string, unknown> => Boolean(body) && typeof body === 'object' && !Array.isArray(body);
const text = (value: unknown, max: number, required = true): string | null => {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) return null;
  const result = value.trim();
  return required && !result ? null : result;
};

export function validatePublicLead(body: unknown) {
  if (!objectBody(body)) return { error: 'Preencha os dados de contato.' } as const;
  const nome = text(body.nome, 120);
  const instituicao = text(body.instituicao, 160);
  const email = text(body.email, 254)?.toLowerCase();
  const rawPhone = text(body.telefone, 32);
  const mensagem = text(body.mensagem, 2000, false);
  if (!nome || !instituicao) return { error: 'Informe seu nome e o nome da instituição.' } as const;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Informe um e-mail válido.' } as const;
  if (!rawPhone || !/^[+\d\s().-]+$/.test(rawPhone)) return { error: 'Informe um telefone válido, com DDD.' } as const;
  const telefone = rawPhone.replace(/\D/g, '');
  if (telefone.length < 8 || telefone.length > 15) return { error: 'O telefone deve conter entre 8 e 15 dígitos.' } as const;
  if (mensagem === null) return { error: 'A mensagem deve ter até 2.000 caracteres.' } as const;
  if (body.alunos !== undefined && body.alunos !== null && (!Number.isInteger(body.alunos) || (body.alunos as number) < 1 || (body.alunos as number) > 100000)) return { error: 'A quantidade de alunos deve ser um inteiro entre 1 e 100.000.' } as const;
  if (body.consent !== true) return { error: 'Autorize o contato para enviar sua solicitação.' } as const;
  return { data: { nome, instituicao, email, telefone, alunos: (body.alunos as number | null | undefined) ?? null, mensagem } } as const;
}

export function validateLeadUpdate(body: unknown) {
  if (!objectBody(body)) return { error: 'Atualização inválida.' } as const;
  if (typeof body.expectedUpdatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(body.expectedUpdatedAt) || !Number.isFinite(Date.parse(body.expectedUpdatedAt))) return { error: 'Recarregue o lead antes de editar.' } as const;
  if (body.stage === undefined && body.notas === undefined) return { error: 'Informe a etapa ou as anotações.' } as const;
  if (body.stage !== undefined && !leadStages.includes(body.stage as typeof leadStages[number])) return { error: 'Etapa inválida.' } as const;
  const notas = body.notas === undefined ? undefined : text(body.notas, 5000, false);
  if (notas === null) return { error: 'As anotações devem ter até 5.000 caracteres.' } as const;
  return { data: { ...(body.stage === undefined ? {} : { stage: body.stage as typeof leadStages[number] }), ...(notas === undefined ? {} : { notas }) }, expectedUpdatedAt: new Date(body.expectedUpdatedAt) } as const;
}

/** Fixed windows; bounded memory, no timers and no reliance on forwarded headers. */
export class LeadRateLimiter {
  private buckets = new Map<string, { count: number; expires: number }>();
  constructor(private readonly maxEntries = 10000) {}
  allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
    const bucket = this.buckets.get(key);
    if (bucket && bucket.expires > now) {
      if (bucket.count >= limit) return false;
      bucket.count++;
      return true;
    }
    this.buckets.delete(key);
    if (this.buckets.size >= this.maxEntries) {
      for (const [entry, value] of this.buckets) if (value.expires <= now) this.buckets.delete(entry);
      // Fail closed rather than evicting active windows, which permits bypasses.
      if (this.buckets.size >= this.maxEntries) return false;
    }
    this.buckets.set(key, { count: 1, expires: now + windowMs });
    return true;
  }
}
