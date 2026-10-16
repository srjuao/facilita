import React, { useEffect, useState } from 'react';
import { TopBar } from '../../components/TopBar';
import api from '../../api/client';
import { Subscription, money } from './plans';
import './SuperAdminOverview.css';
import './SuperAdminPlans.css';

export const SuperAdminFinancial: React.FC<{ onNavigate: (view: string) => void }> = ({ onNavigate }) => {
  const [rows, setRows] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { setRows((await api.get<Subscription[]>('/subscriptions')).data); setLoaded(true); }
    catch { setError('Não foi possível carregar a base financeira. Tente novamente.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const active = rows.filter(row => row.ativo);
  const contracted = active.filter(row => row.plan);
  const total = contracted.reduce((sum, row) => sum + (row.estimatedCents ?? 0), 0);
  return <><TopBar currentPage="Financeiro por instituição" /><div className="sa-plans">
    <header className="plans-section-heading"><div><p className="eyebrow">BASE FINANCEIRA</p><h1>Contratos por instituição.</h1><p className="muted">Valores calculados a partir dos planos vinculados e dos alunos/contas cadastrados.</p></div><button className="ghost" disabled={loading} onClick={() => void load()}>{loading ? 'Atualizando…' : 'Atualizar base'}</button></header>
    {error && <div className="inline-form-error" role="alert">{error}</div>}
    {loaded && <><section className="sa-metrics" aria-label="Base contratada"><article><span>Base mensal estimada</span><strong>{money(total)}</strong><small>Instituições ativas com plano, não receita recebida</small></article><article><span>Instituições com plano</span><strong>{contracted.length}</strong><small>Entre as instituições ativas</small></article><article><span>Alunos/contas contratados</span><strong>{contracted.reduce((sum, row) => sum + row.studentCount, 0).toLocaleString('pt-BR')}</strong><small>Alunos das instituições ativas com plano</small></article><article><span>Aguardando plano</span><strong>{active.length - contracted.length}</strong><small>Instituições ativas sem base de cobrança</small></article></section>
      <div className="finance-table-wrap"><table className="finance-table"><thead><tr><th>Instituição</th><th>Plano</th><th>Alunos/contas</th><th>Base mensal estimada</th><th>Situação</th></tr></thead><tbody>{rows.map(row => <tr key={row.tenantId}><td><b>{row.nome}</b></td><td>{row.plan?.nome || 'Sem plano'}<small>{row.plan ? row.plan.billingMode === 'FIXO' ? 'Mensalidade fixa' : money(row.plan.priceCents) + ' por aluno/mês' : 'Cobrança não configurada'}</small></td><td>{row.studentCount.toLocaleString('pt-BR')}</td><td>{row.estimatedCents === null ? '—' : money(row.estimatedCents)}{!row.ativo && <small>Fora da previsão ativa</small>}</td><td><span className={`pill ${row.ativo ? 'good' : 'warn'}`}>{row.ativo ? 'Ativa' : 'Desativada'}</span></td></tr>)}</tbody></table>{!rows.length && <p className="plans-empty">Nenhuma instituição cadastrada.</p>}</div>
    </>}
    <section className="finance-notice" style={{ marginTop: 24 }}><h2>Preparado para a próxima etapa de cobrança</h2><p>Esta é a base contratada, não uma fatura. Nenhum boleto, cobrança ou envio é gerado automaticamente. A emissão real exige definir o provedor de pagamento, cadastrar os dados fiscais da instituição e configurar vencimentos, notificações e confirmação de pagamento.</p><button className="primary" onClick={() => onNavigate('sa-plans')}>Gerenciar planos e vínculos</button></section>
  </div></>;
};
