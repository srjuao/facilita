import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { BillingTerms, Plan, Subscription, money, priceLabel, estimatePlan } from './plans';
import './SuperAdminPlans.css';

type Draft = { tenantId: string; planId: string; terms: BillingTerms; unit: string };
const blankTerms = (name: string): BillingTerms => ({ minimumStudents: 0, unitCents: 0, dueDay: 0, billingName: name, billingDocument: '', billingAddress: '', billingEmail: '', issuerName: '', issuerDocument: '', issuerAddress: '', paymentInstructions: '' });
const errorText = (error: unknown) => (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Não foi possível salvar. Atualize os dados e tente novamente.';

export const PlanAssignments: React.FC<{ tenantId?: string }> = ({ tenantId }) => {
  const [rows, setRows] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState('');
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const load = async () => {
    setLoading(true); setNotice(null);
    try {
      const [subscriptions, catalog] = await Promise.all([api.get<Subscription[]>('/subscriptions'), api.get<Plan[]>('/plans')]);
      setRows(subscriptions.data); setPlans(catalog.data); setChoices({}); setDraft(null); setLoaded(true);
    } catch { setNotice({ error: true, text: 'Não foi possível carregar os vínculos de planos. Tente novamente.' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [tenantId]);
  const update = (key: keyof BillingTerms, value: string | number) => setDraft(current => current ? { ...current, terms: { ...current.terms, [key]: value } } : null);
  const begin = (row: Subscription, planId: string) => {
    if (!planId) return;
    const contract = row.billingContract;
    setNotice(null);
    setDraft({ tenantId: row.tenantId, planId, terms: contract ? { ...contract } : blankTerms(row.nome), unit: contract ? (contract.unitCents / 100).toFixed(2) : '' });
  };
  const save = async (row: Subscription, event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || draft.tenantId !== row.tenantId || saving) return;
    const selected = plans.find(item => item.id === draft.planId) || row.plan;
    if (selected?.billingMode === 'FIXO') { setNotice({ error: true, text: 'Cobrança fixa ainda não é suportada neste fluxo. Escolha um plano por aluno.' }); return; }
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(draft.unit.trim())) { setNotice({ error: true, text: 'Informe o preço por aluno com até duas casas decimais.' }); return; }
    const unitCents = Math.round(Number(draft.unit.replace(',', '.')) * 100);
    const terms = { ...draft.terms, unitCents };
    if (!Number.isSafeInteger(unitCents) || unitCents <= 0 || !Number.isSafeInteger(terms.minimumStudents) || terms.minimumStudents < 1 || !Number.isSafeInteger(terms.dueDay) || terms.dueDay < 1 || terms.dueDay > 28 || terms.minimumStudents * unitCents > 2147483647) {
      setNotice({ error: true, text: 'Confira o mínimo contratado, o preço e o dia do vencimento (1 a 28).' }); return;
    }
    setSaving(row.tenantId); setNotice(null);
    try {
      const { data } = await api.patch<Subscription>(`/tenants/${row.tenantId}/plan`, { planId: draft.planId, expectedPlanId: row.plan?.id || null, billingContract: terms, expectedContractVersion: row.billingContract?.version ?? null });
      setRows(current => current.map(item => item.tenantId === data.tenantId ? data : item));
      setChoices(current => { const next = { ...current }; delete next[row.tenantId]; return next; });
      setDraft(null);
      setNotice({ error: false, text: 'Plano e cobrança salvos. O vencimento aparece no Financeiro; a fatura mensal deve ser emitida lá.' });
    } catch (error) { setNotice({ error: true, text: errorText(error) }); }
    finally { setSaving(''); }
  };
  const unlink = async (row: Subscription) => {
    if (saving || !window.confirm(`Desvincular o plano de ${row.nome}? Novas cobranças ficarão indisponíveis até configurar outro plano. O histórico de faturas permanece.`)) return;
    setSaving(row.tenantId); setNotice(null);
    try {
      const { data } = await api.patch<Subscription>(`/tenants/${row.tenantId}/plan`, { planId: null, expectedPlanId: row.plan?.id || null });
      setRows(current => current.map(item => item.tenantId === data.tenantId ? data : item));
      setChoices(current => { const next = { ...current }; delete next[row.tenantId]; return next; });
      setDraft(null);
      setNotice({ error: false, text: 'Plano desvinculado. O histórico de cobrança foi preservado.' });
    } catch (error) { setNotice({ error: true, text: errorText(error) }); }
    finally { setSaving(''); }
  };
  const visible = rows.filter(row => (!tenantId || row.tenantId === tenantId) && row.nome.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  return <section className="plan-assignments">
    <div className="plans-section-heading"><div><h2>Plano por instituição</h2><p className="muted">Defina os acessos e as condições da cobrança mensal no mesmo vínculo.</p></div><button className="ghost" disabled={loading || !!saving} onClick={() => void load()}>{loading ? 'Carregando…' : 'Atualizar vínculos'}</button></div>
    {notice && <div role={notice.error ? 'alert' : 'status'} className={notice.error ? 'inline-form-error' : 'plans-success'}>{notice.text}</div>}
    <p className="plans-explanation">O plano define os recursos da unidade. Mínimo de alunos, preço negociado e dia do vencimento são confirmados no contrato. Faturas já emitidas preservam as condições da emissão.</p>
    {!tenantId && <label className="plans-search">Buscar instituição<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome da instituição" /></label>}
    {loading && !loaded ? <p role="status">Carregando instituições e planos…</p> : loaded && <div className="plans-assignment-list">{visible.map(row => {
      const selectedId = choices[row.tenantId] ?? row.plan?.id ?? '';
      const selection = plans.find(plan => plan.id === selectedId) || (row.plan?.id === selectedId ? row.plan : null);
      const changed = selectedId !== (row.plan?.id || '');
      const activeAccounts = row.activeStudentAccounts ?? row.studentCount;
      const preview = selection ? estimatePlan(selection, activeAccounts) : null;
      const fixed = selection?.billingMode === 'FIXO';
      const editing = draft?.tenantId === row.tenantId && draft.planId === selectedId;
      const contract = row.billingContract;
      return <article key={row.tenantId} className="plan-assignment">
        <div><h3>{row.nome} <span className={`pill ${row.ativo ? 'good' : 'warn'}`}>{row.ativo ? 'Ativa' : 'Desativada'}</span></h3><p>{activeAccounts.toLocaleString('pt-BR')} contas de alunos ativas</p><small>Plano atual: {row.plan ? row.plan.nome + ' · ' + priceLabel(row.plan) : 'Sem plano configurado'}</small>
          {row.plan && <p className={contract ? 'plan-contract-ready' : 'plan-contract-missing'}>{contract ? `Cobrança: mínimo ${contract.minimumStudents.toLocaleString('pt-BR')} · ${money(contract.unitCents)}/aluno · vencimento dia ${contract.dueDay}` : 'Cobrança pendente: informe mínimo, valor e vencimento.'}</p>}
        </div>
        <div className="plan-assignment-control"><label>Plano contratado<select disabled={!!saving} value={selectedId} onChange={event => { setChoices(current => ({ ...current, [row.tenantId]: event.target.value })); setDraft(null); }}><option value="">Sem plano (acesso legado)</option>{row.plan && !row.plan.ativo && <option value={row.plan.id}>{row.plan.nome} · atual, desativado no catálogo</option>}{plans.filter(plan => plan.ativo).map(plan => <option key={plan.id} value={plan.id} disabled={plan.billingMode === 'FIXO' && plan.id !== row.plan?.id}>{plan.nome} · {priceLabel(plan)}{plan.billingMode === 'FIXO' ? ' · cobrança fixa pendente' : ''}</option>)}</select></label>
          <p className="plan-assignment-preview">{contract && !changed ? `Previsão pelo contrato: ${money(row.contractEstimatedCents ?? Math.max(contract.minimumStudents, activeAccounts) * contract.unitCents)}` : preview !== null ? `Referência do catálogo: ${money(preview)} — confirme o valor negociado abaixo` : 'Sem base de cobrança'}{!row.ativo && ' · unidade desativada'}</p>
          {selection && <p className="muted" style={{ fontSize: 12 }}>Recursos: videoaulas {selection.videoAulas ? 'incluídas' : 'não incluídas'} · provas {selection.provas ? 'incluídas' : 'não incluídas'} · IA {selection.ia ? 'liberada (integração pendente)' : 'não incluída'}</p>}
          {fixed && <p role="status" className="plan-contract-missing">Cobrança fixa ainda não é suportada neste vínculo. Escolha um plano por aluno.</p>}
          <div className="plan-assignment-actions">{selectedId && !fixed && <button className="primary" disabled={!!saving} onClick={() => begin(row, selectedId)}>{contract && !changed ? 'Editar cobrança' : 'Configurar cobrança e salvar plano'}</button>}{changed && !selectedId && <button className="ghost" disabled={!!saving} onClick={() => void unlink(row)}>Desvincular plano</button>}{changed && <button className="ghost" disabled={!!saving} onClick={() => { setDraft(null); setChoices(current => { const next = { ...current }; delete next[row.tenantId]; return next; }); }}>Cancelar alteração</button>}</div>
          {editing && draft && <form className="plan-contract-form" onSubmit={event => void save(row, event)}><h4>Condições de cobrança · {selection?.nome}</h4><p>Confirme os dados antes de vincular. O valor faturável será o maior entre o mínimo contratado e as contas de alunos ativas.</p><fieldset disabled={!!saving}>
            <div className="plan-contract-grid"><label>Mínimo contratado de alunos<input type="number" required min="1" max="2147483647" step="1" value={draft.terms.minimumStudents || ''} onChange={event => update('minimumStudents', Number(event.target.value))} /></label><label>Preço negociado por aluno (R$)<input required inputMode="decimal" placeholder="0,00" value={draft.unit} onChange={event => setDraft(current => current ? { ...current, unit: event.target.value } : null)} /></label><label>Dia do vencimento<input type="number" required min="1" max="28" step="1" value={draft.terms.dueDay || ''} onChange={event => update('dueDay', Number(event.target.value))} /></label></div>
            <h5>Instituição contratante</h5><div className="plan-contract-grid">{([['billingName', 'Razão social / nome', 180], ['billingDocument', 'CNPJ / CPF', 60], ['billingEmail', 'E-mail do financeiro', 254], ['billingAddress', 'Endereço completo', 500]] as const).map(([key, label, max]) => <label key={key}>{label}<input required type={key === 'billingEmail' ? 'email' : 'text'} maxLength={max} value={draft.terms[key]} onChange={event => update(key, event.target.value)} /></label>)}</div>
            <h5>Emitente</h5><div className="plan-contract-grid">{([['issuerName', 'Razão social / nome', 180], ['issuerDocument', 'CNPJ / CPF', 60], ['issuerAddress', 'Endereço completo', 500]] as const).map(([key, label, max]) => <label key={key}>{label}<input required maxLength={max} value={draft.terms[key]} onChange={event => update(key, event.target.value)} /></label>)}</div>
            <label>Instruções de pagamento<textarea maxLength={2000} rows={3} value={draft.terms.paymentInstructions} placeholder="Forma de pagamento combinada com a instituição" onChange={event => update('paymentInstructions', event.target.value)} /></label>
            {draft.terms.minimumStudents > 0 && /^\d+(?:[.,]\d{1,2})?$/.test(draft.unit) && <p className="plan-contract-total">Mínimo mensal: <strong>{money(draft.terms.minimumStudents * Math.round(Number(draft.unit.replace(',', '.')) * 100))}</strong></p>}
            <div className="plan-assignment-actions"><button className="primary" type="submit">{saving ? 'Salvando…' : 'Salvar plano e cobrança'}</button><button type="button" className="ghost" onClick={() => setDraft(null)}>Cancelar</button></div>
          </fieldset></form>}
        </div>
      </article>;
    })}{!visible.length && <p className="plans-empty">Nenhuma instituição encontrada.</p>}</div>}
  </section>;
};
