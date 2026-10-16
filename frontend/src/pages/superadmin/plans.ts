export interface Plan {
  id: string;
  nome: string;
  descricao: string;
  billingMode: 'FIXO' | 'POR_ALUNO';
  priceCents: number;
  studentLimit: number | null;
  videoAulas: boolean;
  provas: boolean;
  ia: boolean;
  ativo: boolean;
  createdAt: string;
  _count?: { tenants: number };
}
export interface Subscription {
  tenantId: string;
  nome: string;
  ativo: boolean;
  plan: Plan | null;
  studentCount: number;
  estimatedCents: number | null;
}
export const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const priceLabel = (plan: Plan) => `${money(plan.priceCents)} / ${plan.billingMode === 'FIXO' ? 'mês' : 'aluno/mês'}`;
