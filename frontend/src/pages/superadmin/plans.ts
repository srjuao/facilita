import { calculatePrice, PricePoint } from '../../pricing.mjs';
export interface Plan {
  id: string;
  nome: string;
  descricao: string;
  billingMode: 'FIXO' | 'POR_ALUNO' | 'FAIXAS';
  priceCents: number;
  pricePoints: PricePoint[];
  studentLimit: number | null;
  defaultMinimumStudents: number | null;
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
  activeStudentAccounts?: number;
  estimatedCents: number | null;
  contractEstimatedCents?: number | null;
  billingContract?: (BillingTerms & { version: number }) | null;
}
export interface BillingTerms {
  minimumStudents: number;
  unitCents: number;
  closingDay: number;
  dueDay: number;
  billingName: string;
  billingDocument: string;
  billingAddress: string;
  billingEmail: string;
  issuerName: string;
  issuerDocument: string;
  issuerAddress: string;
  paymentInstructions: string;
}
export const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const priceLabel = (plan: Plan) => plan.billingMode === 'FAIXAS' ? 'Por aluno · faixas progressivas' : `${money(plan.priceCents)} / ${plan.billingMode === 'FIXO' ? 'mês' : 'aluno/mês'}`;
export const estimatePlan = (plan: Plan, students: number) => plan.billingMode === 'FAIXAS' ? calculatePrice(students, plan.pricePoints).totalCents : plan.priceCents * (plan.billingMode === 'FIXO' ? 1 : students);
export const suggestedUnit = (plan: Plan | null | undefined, students: number) => {
  if (!plan || !Number.isSafeInteger(students) || students < 1 || plan.billingMode === 'FIXO') return '';
  try { return (Math.round(estimatePlan(plan, students) / students) / 100).toFixed(2); }
  catch { return ''; }
};
