import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Plan, Subscription, money, priceLabel, estimatePlan } from './plans';
import './SuperAdminPlans.css';

export const PlanAssignments: React.FC<{ tenantId?: string }> = ({ tenantId }) => {
  const [rows, setRows] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState('');
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const load = async () => {
    setLoading(true); setNotice(null);
    try {
      const [subscriptions, catalog] = await Promise.all([api.get<Subscription[]>('/subscriptions'), api.get<Plan[]>('/plans')]);
      setRows(subscriptions.data); setPlans(catalog.data); setChoices({}); setLoaded(true);
    } catch { setNotice({ error: true, text: 'Não foi possível carregar os vínculos de planos. Tente novamente.' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [tenantId]);
  const assign = async (row: Subscription) => {
    if (saving) return;
    const planId = choices[row.tenantId] || null;
    setSaving(row.tenantId); setNotice(null);
    try {
      const { data } = await api.patch<Subscription>(`/tenants/${row.tenantId}/plan`, { planId, expectedPlanId: row.plan?.id || null });
      setRows(current => current.map(item => item.tenantId === data.tenantId ? data : item));
      setChoices(current => { const next = { ...current }; delete next[row.tenantId]; return next; });
      setNotice({ error: false, text: 'Plano da instituição salvo. As permissões passam a valer nas próximas requisições.' });
    } catch (error: any) { setNotice({ error: true, text: error.response?.data?.error || 'Não foi possível vincular o plano.' }); }
    finally { setSaving(''); }
  };
  const visible = rows.filter(row => (!tenantId || row.tenantId === tenantId) && row.nome.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  return <section className="plan-assignments">
    <div className="plans-section-heading"><div><h2>Plano por instituição</h2><p className="muted">Vincule as condições comerciais e os recursos de cada unidade.</p></div><button className="ghost" disabled={loading || !!saving} onClick={() => void load()}>{loading ? 'Carregando…' : 'Atualizar vínculos'}</button></div>
    {notice && <div role={notice.error ? 'alert' : 'status'} className={notice.error ? 'inline-form-error' : 'plans-success'}>{notice.text}</div>}
    <p className="plans-explanation">Trocar o plano altera os acessos imediatamente. Planos desativados continuam válidos para instituições já vinculadas, mas não aceitam novos vínculos. Sem plano, a unidade mantém o acesso legado, sem limite contratado nem cobrança configurada.</p>
    {!tenantId && <label className="plans-search">Buscar instituição<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome da instituição" /></label>}
    {loading && !loaded ? <p role="status">Carregando instituições e planos…</p> : loaded && <div className="plans-assignment-list">{visible.map(row => {
      const selectedId = choices[row.tenantId] ?? row.plan?.id ?? '';
      const selection = plans.find(plan => plan.id === selectedId) || (row.plan?.id === selectedId ? row.plan : null);
      const changed = selectedId !== (row.plan?.id || '');
      const preview = selection ? estimatePlan(selection, row.studentCount) : null;
      return <article key={row.tenantId} className="plan-assignment">
        <div><h3>{row.nome} <span className={`pill ${row.ativo ? 'good' : 'warn'}`}>{row.ativo ? 'Ativa' : 'Desativada'}</span></h3><p>{row.studentCount.toLocaleString('pt-BR')} alunos/contas cadastrados</p><small>Atual: {row.plan ? row.plan.nome + ' · ' + priceLabel(row.plan) : 'Sem plano configurado'}</small></div>
        <div className="plan-assignment-control"><label>Plano contratado<select disabled={!!saving} value={selectedId} onChange={event => setChoices({ ...choices, [row.tenantId]: event.target.value })}><option value="">Sem plano (acesso legado)</option>{row.plan && !row.plan.ativo && <option value={row.plan.id}>{row.plan.nome} · atual, desativado no catálogo</option>}{plans.filter(plan => plan.ativo).map(plan => <option key={plan.id} value={plan.id}>{plan.nome} · {priceLabel(plan)}</option>)}</select></label><p className="plan-assignment-preview">{preview !== null ? `Base mensal estimada: ${money(preview)}` : 'Sem base de cobrança'}{!row.ativo && ' · unidade desativada, fora da previsão ativa'}</p>{selection && <p className="muted" style={{ fontSize: 12 }}>Recursos: videoaulas {selection.videoAulas ? 'incluídas' : 'não incluídas'} · provas {selection.provas ? 'incluídas' : 'não incluídas'} · IA {selection.ia ? 'liberada (integração pendente)' : 'não incluída'}</p>}{selection?.studentLimit != null && <small>Limite contratado: {selection.studentLimit.toLocaleString('pt-BR')} alunos.</small>}
          <div className="plan-assignment-actions"><button className="primary" disabled={!changed || !!saving} onClick={() => void assign(row)}>{saving === row.tenantId ? 'Salvando…' : 'Salvar plano da instituição'}</button>{changed && <button className="ghost" disabled={!!saving} onClick={() => setChoices(current => { const next = { ...current }; delete next[row.tenantId]; return next; })}>Cancelar alteração</button>}</div>
        </div>
      </article>;
    })}{!visible.length && <p className="plans-empty">Nenhuma instituição encontrada.</p>}</div>}
  </section>;
};
