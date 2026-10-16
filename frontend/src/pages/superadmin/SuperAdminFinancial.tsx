import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TopBar } from '../../components/TopBar';
import api from '../../api/client';
import { Subscription, money } from './plans';
import './SuperAdminPlans.css';
import './SuperAdminFinancial.css';

type Terms = { minimumStudents: number; unitCents: number; dueDay: number; billingName: string; billingDocument: string; billingAddress: string; billingEmail: string; issuerName: string; issuerDocument: string; issuerAddress: string; paymentInstructions: string };
type Contract = Terms & { tenantId: string; version: number; activeStudents: number; tenant: { nome: string; ativo: boolean } };
type Invoice = Terms & { id: string; number: string; tenantId: string; competence: string; dueDate: string; activeStudents: number; billableStudents: number; totalCents: number; status: 'OPEN' | 'PAID' | 'CANCELLED'; version: number; createdAt: string; events: { id: string; action: string; note: string; actorName: string; createdAt: string }[] };
type Result = { contracts: Contract[]; invoices: Invoice[]; nextCursor: string | null };
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const dateLabel = (value: string) => value.slice(0, 10).split('-').reverse().join('/');
const statusLabel = (invoice: Invoice) => invoice.status === 'PAID' ? 'Baixa manual' : invoice.status === 'CANCELLED' ? 'Cancelada' : invoice.dueDate.slice(0, 10) < today() ? 'Vencida' : 'Em aberto';
const errorText = (error: unknown) => (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Não foi possível concluir. Atualize a lista antes de tentar novamente.';
const emptyTerms: Terms = { minimumStudents: 1, unitCents: 0, dueDay: 10, billingName: '', billingDocument: '', billingAddress: '', billingEmail: '', issuerName: '', issuerDocument: '', issuerAddress: '', paymentInstructions: '' };

export const SuperAdminFinancial: React.FC<{ onNavigate: (view: string) => void }> = ({ onNavigate }) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tenants, setTenants] = useState<Subscription[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [tab, setTab] = useState<'contracts' | 'invoices'>('contracts');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState<{ tenantId: string; version: number | null; terms: Terms } | null>(null);
  const [unit, setUnit] = useState('');
  const [issuing, setIssuing] = useState('');
  const [competence, setCompetence] = useState(today().slice(0, 7));
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [action, setAction] = useState<{ invoice: Invoice; status: 'PAID' | 'CANCELLED' } | null>(null);
  const [note, setNote] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const actionDialog = useRef<HTMLDialogElement>(null);
  const load = async (more = false) => {
    setLoading(true);
    try {
      const [result, subscriptions] = await Promise.all([api.get<Result>('/platform-finance', { params: more ? { cursor } : {} }), api.get<Subscription[]>('/subscriptions')]);
      setContracts(result.data.contracts); setTenants(subscriptions.data);
      setInvoices(old => more ? [...old, ...result.data.invoices.filter(row => !old.some(item => item.id === row.id))] : result.data.invoices);
      setCursor(result.data.nextCursor);
    } catch (e) { setError(errorText(e)); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (selected) dialog.current?.showModal(); }, [selected]);
  useEffect(() => { if (action) actionDialog.current?.showModal(); }, [action]);
  const mutate = async (operation: () => Promise<unknown>, message: string, done: () => void) => {
    setBusy(true); setError(''); setSuccess('');
    try { await operation(); done(); setSuccess(message); await load(); }
    catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };
  const openEditor = (contract?: Contract) => {
    setError(''); setSuccess('');
    setEditing({ tenantId: contract?.tenantId || '', version: contract?.version ?? null, terms: contract ? { ...contract } : { ...emptyTerms } });
    setUnit(contract ? (contract.unitCents / 100).toFixed(2) : '');
  };
  const update = (key: keyof Terms, value: string | number) => setEditing(old => old ? { ...old, terms: { ...old.terms, [key]: value } } : old);
  const current = contracts.find(item => item.tenantId === issuing);
  const currentLinked = !!tenants.find(item => item.tenantId === issuing && item.ativo && item.plan);
  const pending = tenants.filter(item => item.ativo && (!item.plan || !item.billingContract));
  const payable = current ? Math.max(current.minimumStudents, current.activeStudents) * current.unitCents : 0;
  const statusAction = (invoice: Invoice, status: 'PAID' | 'CANCELLED') => { setNote(''); setAction({ invoice, status }); setError(''); };
  const saveContract = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(unit)) { setError('Informe um preço positivo com até duas casas decimais.'); return; }
    const cents = Math.round(Number(unit.replace(',', '.')) * 100);
    if (!Number.isSafeInteger(cents) || cents <= 0 || cents * editing.terms.minimumStudents > 2147483647) { setError('Preço ou total do contrato inválido.'); return; }
    void mutate(() => api.put(`/platform-finance/contracts/${editing.tenantId}`, { ...editing.terms, unitCents: cents, expectedVersion: editing.version }), 'Contrato salvo. Faturas já emitidas mantêm os valores originais.', () => setEditing(null));
  };
  return <><TopBar currentPage="Financeiro da plataforma" /><main className="sa-plans platform-finance">
    <header className="plans-section-heading"><div><p className="eyebrow">FINANCEIRO · FACILITA ESTUDOS</p><h1>Contratos e cobranças.</h1><p className="muted">Mínimo contratado garantido. Excedentes calculados por aluno com conta ativa.</p></div><button className="ghost" disabled={loading || busy} onClick={() => { setError(''); void load(); }}>Atualizar</button></header>
    <div className="pf-explainer">Emissão interna de faturas. Sem registro bancário, boleto pagável ou envio automático. Os pagamentos são conferidos e registrados manualmente.</div>
    {error && <div role="alert" className="inline-form-error">{error}</div>}{success && <p className="pf-success" role="status">{success}</p>}
    <nav className="pf-tabs" aria-label="Seções do financeiro"><button aria-current={tab === 'contracts' ? 'page' : undefined} onClick={() => setTab('contracts')}>Contratos <span>{contracts.length}</span></button><button aria-current={tab === 'invoices' ? 'page' : undefined} onClick={() => setTab('invoices')}>Cobranças</button><button onClick={() => onNavigate('sa-plans')}>Planos e recursos ↗</button></nav>
    {loading && <p role="status">Carregando financeiro…</p>}
    {!loading && pending.length > 0 && <section className="pf-pending" aria-labelledby="pf-pending-title"><div><h2 id="pf-pending-title">Instituições aguardando cobrança <span>{pending.length}</span></h2><p>O plano e as condições de pagamento precisam estar vinculados antes de emitir a primeira fatura.</p></div><ul>{pending.map(item => <li key={item.tenantId}><strong>{item.nome}</strong><span>{item.plan ? 'Plano vinculado · falta valor contratado e vencimento' : 'Sem plano vinculado'}</span></li>)}</ul><button className="primary" onClick={() => onNavigate('sa-plans')}>Configurar planos e cobrança</button></section>}
    {tab === 'contracts' && <>
      <div className="pf-heading"><div><h2>Contratos por instituição</h2><p>O preço e a franquia são definidos aqui. Os recursos de acesso continuam no plano.</p></div><button className="primary" disabled={busy || loading} onClick={() => openEditor()}>Novo contrato</button></div>
      {editing && <form className="pf-editor" onSubmit={saveContract}><h2>{editing.version === null ? 'Cadastrar contrato' : 'Editar contrato'}</h2><fieldset disabled={busy}>
        <label>Instituição<select required disabled={editing.version !== null} value={editing.tenantId} onChange={e => { const row = tenants.find(t => t.tenantId === e.target.value); setEditing({ ...editing, tenantId: e.target.value, terms: { ...editing.terms, billingName: row?.nome || '' } }); }}><option value="">Selecione a instituição</option>{tenants.filter(t => t.tenantId === editing.tenantId || (t.ativo && !!t.plan && !contracts.some(c => c.tenantId === t.tenantId))).map(t => <option key={t.tenantId} value={t.tenantId}>{t.nome}</option>)}</select></label>
        <div className="pf-grid"><label>Mínimo contratado de alunos<input type="number" min="1" max="2147483647" step="1" required value={editing.terms.minimumStudents} onChange={e => update('minimumStudents', Number(e.target.value))} /></label><label>Preço por aluno (R$)<input inputMode="decimal" required value={unit} placeholder="0,00" onChange={e => setUnit(e.target.value)} /></label><label>Dia do vencimento<input type="number" min="1" max="28" step="1" required value={editing.terms.dueDay} onChange={e => update('dueDay', Number(e.target.value))} /></label></div>
        <h3>Instituição contratante</h3><div className="pf-grid">{([['billingName', 'Razão social / nome', 180], ['billingDocument', 'CNPJ / CPF', 60], ['billingEmail', 'E-mail do financeiro', 254], ['billingAddress', 'Endereço completo', 500]] as const).map(([key, label, max]) => <label key={key}>{label}<input type={key === 'billingEmail' ? 'email' : 'text'} maxLength={max} required value={editing.terms[key]} onChange={e => update(key, e.target.value)} /></label>)}</div>
        <h3>Emitente da cobrança</h3><div className="pf-grid">{([['issuerName', 'Razão social / nome', 180], ['issuerDocument', 'CNPJ / CPF', 60], ['issuerAddress', 'Endereço completo', 500]] as const).map(([key, label, max]) => <label key={key}>{label}<input maxLength={max} required value={editing.terms[key]} onChange={e => update(key, e.target.value)} /></label>)}</div>
        <label>Instruções de pagamento<textarea maxLength={2000} rows={3} value={editing.terms.paymentInstructions} placeholder="Informe a forma de pagamento já combinada com o cliente." onChange={e => update('paymentInstructions', e.target.value)} /></label>
        <p>Alterações valem para novas emissões. Uma fatura já emitida não é recalculada.</p><div className="pf-actions"><button className="primary" type="submit">{busy ? 'Salvando…' : 'Salvar contrato'}</button><button type="button" className="ghost" onClick={() => setEditing(null)}>Cancelar</button></div>
      </fieldset></form>}
      <div className="finance-table-wrap"><table className="finance-table"><thead><tr><th>Instituição</th><th>Mínimo / ativos</th><th>Preço por aluno</th><th>Previsão mensal</th><th>Ações</th></tr></thead><tbody>{contracts.map(c => { const linked = !!tenants.find(t => t.tenantId === c.tenantId && t.ativo && t.plan); return <tr key={c.tenantId}><td><b>{c.tenant.nome}</b><small>{!c.tenant.ativo ? 'Instituição desativada' : !linked ? 'Sem plano · emissão bloqueada' : `Vencimento dia ${c.dueDay}`}</small></td><td>{c.minimumStudents.toLocaleString('pt-BR')} / {c.activeStudents.toLocaleString('pt-BR')}</td><td>{money(c.unitCents)}</td><td>{money(Math.max(c.minimumStudents, c.activeStudents) * c.unitCents)}<small>{Math.max(0, c.activeStudents - c.minimumStudents)} excedentes</small></td><td><div className="pf-actions"><button className="ghost" disabled={busy || !c.tenant.ativo} onClick={() => openEditor(c)}>Editar</button><button className="primary" disabled={busy || !c.tenant.ativo || !linked} onClick={() => { setIssuing(c.tenantId); setTab('invoices'); }}>Emitir</button></div></td></tr>; })}</tbody></table>{!loading && !contracts.length && <p className="plans-empty">Nenhum contrato cadastrado. Configure o plano e a cobrança da instituição para começar.</p>}</div>
    </>}
    {tab === 'invoices' && <>
      <form className="pf-editor" onSubmit={e => { e.preventDefault(); if (current && currentLinked) void mutate(() => api.post('/platform-finance/invoices', { tenantId: current.tenantId, competence, expectedContractVersion: current.version }), 'Fatura emitida e salva. Abra o documento para imprimir ou salvar como PDF.', () => setIssuing('')); }}><h2>Emitir cobrança mensal</h2><fieldset disabled={busy || loading}><div className="pf-grid"><label>Contrato<select required value={issuing} onChange={e => setIssuing(e.target.value)}><option value="">Selecione a instituição</option>{contracts.filter(c => c.tenant.ativo && tenants.some(t => t.tenantId === c.tenantId && t.ativo && t.plan)).map(c => <option key={c.tenantId} value={c.tenantId}>{c.tenant.nome} · vence dia {c.dueDay}</option>)}</select></label><label>Competência<input type="month" min="2000-01" max="2099-12" required value={competence} onChange={e => setCompetence(e.target.value)} /></label></div>
        {current && <div className="pf-calculation"><div><span>{Math.max(current.minimumStudents, current.activeStudents).toLocaleString('pt-BR')} alunos faturáveis × {money(current.unitCents)}</span><strong>{money(payable)}</strong></div><p>Mínimo: {current.minimumStudents} · Contas de alunos ativas agora: {current.activeStudents} · Vencimento: {dateLabel(`${competence}-${String(current.dueDay).padStart(2, '0')}`)}</p><small>A quantidade é conferida novamente na emissão. Uma cobrança por instituição e competência, inclusive após cancelamento.</small></div>}
        <button className="primary" disabled={!current || !currentLinked} type="submit">{busy ? 'Emitindo…' : 'Emitir fatura'}</button></fieldset></form>
      <h2>Cobranças emitidas</h2><div className="finance-table-wrap"><table className="finance-table"><thead><tr><th>Instituição / competência</th><th>Vencimento</th><th>Valor</th><th>Situação</th><th>Documento</th></tr></thead><tbody>{invoices.map(invoice => <tr key={invoice.id}><td><b>{invoice.billingName}</b><small>{invoice.competence.split('-').reverse().join('/')}</small></td><td>{dateLabel(invoice.dueDate)}</td><td>{money(invoice.totalCents)}</td><td><span className={`pill ${invoice.status === 'PAID' ? 'good' : 'warn'}`}>{statusLabel(invoice)}</span></td><td><button className="ghost" onClick={() => setSelected(invoice)}>Abrir fatura</button></td></tr>)}</tbody></table>{!loading && !invoices.length && <p className="plans-empty">Nenhuma cobrança emitida. Os contratos não geram faturas automaticamente.</p>}</div>{cursor && <button className="ghost" disabled={loading || busy} onClick={() => void load(true)}>Carregar mais cobranças</button>}
    </>}
  </main>
  {selected && createPortal(<dialog ref={dialog} aria-label="Fatura de cobrança e histórico" className="pf-document-dialog" onCancel={() => setSelected(null)} onClose={() => setSelected(null)}>
    <div className="pf-document-controls"><button className="ghost" onClick={() => window.print()}>Imprimir / salvar PDF</button>{selected.status === 'OPEN' && <><button className="primary" onClick={() => statusAction(selected, 'PAID')}>Registrar baixa manual</button><button className="ghost" onClick={() => statusAction(selected, 'CANCELLED')}>Cancelar cobrança</button></>}<button className="ghost" onClick={() => setSelected(null)}>Fechar</button></div>
    <article className="pf-document"><header><img src="/facilita-estudos-logo.svg" alt="Facilita Estudos" /><div><h1>Fatura de cobrança</h1><span>{statusLabel(selected)}</span></div></header><p className="pf-number">{selected.number}</p><div className="pf-document-parties"><section><h2>Emitente</h2><b>{selected.issuerName}</b><p>{selected.issuerDocument}</p><p>{selected.issuerAddress}</p></section><section><h2>Contratante</h2><b>{selected.billingName}</b><p>{selected.billingDocument}</p><p>{selected.billingAddress}</p><p>{selected.billingEmail}</p></section></div>
    <div className="pf-document-parties"><p>Competência: <b>{selected.competence.split('-').reverse().join('/')}</b><br />Emissão: {dateLabel(selected.createdAt)}</p><p>Vencimento: <b>{dateLabel(selected.dueDate)}</b></p></div><table><thead><tr><th>Descrição</th><th>Quantidade</th><th>Unitário</th><th>Total</th></tr></thead><tbody><tr><td>Mínimo contratado — plataforma</td><td>{selected.minimumStudents}</td><td>{money(selected.unitCents)}</td><td>{money(selected.minimumStudents * selected.unitCents)}</td></tr><tr><td>Alunos excedentes</td><td>{selected.billableStudents - selected.minimumStudents}</td><td>{money(selected.unitCents)}</td><td>{money((selected.billableStudents - selected.minimumStudents) * selected.unitCents)}</td></tr></tbody></table><p>Contas de alunos ativas na emissão: {selected.activeStudents}. Quantidade faturável: {selected.billableStudents}.</p><div className="pf-document-total">Total da fatura <strong>{money(selected.totalCents)}</strong></div><h2>Instruções de pagamento</h2><p className="pf-preserve">{selected.paymentInstructions || 'Entre em contato com o emitente para combinar a forma de pagamento.'}</p><footer>Documento de cobrança interna. Não é boleto bancário e não possui código de barras pagável. A baixa manual representa conferência do operador, sem confirmação bancária integrada.</footer>
    </article><section className="pf-history"><h2>Histórico da cobrança</h2>{selected.events.map(event => <p key={event.id}><b>{event.action === 'CREATED' ? 'Emissão' : event.action === 'PAID' ? 'Baixa manual' : 'Cancelamento'}</b> · {event.actorName} · {dateLabel(event.createdAt)}<br />{event.note}</p>)}</section>
  </dialog>, document.body)}
  {action && createPortal(<dialog ref={actionDialog} className="pf-action-dialog" onCancel={e => { if (busy) e.preventDefault(); else setAction(null); }} onClose={() => setAction(null)}><form onSubmit={e => { e.preventDefault(); void mutate(() => api.patch(`/platform-finance/invoices/${action.invoice.id}/status`, { status: action.status, note, expectedVersion: action.invoice.version }), action.status === 'PAID' ? 'Baixa manual registrada com histórico.' : 'Cobrança cancelada. A competência permanece reservada no histórico.', () => { setAction(null); setSelected(null); }); }}><h2>{action.status === 'PAID' ? 'Confirmar pagamento conferido' : 'Cancelar cobrança'}</h2><p>{action.invoice.billingName} · {money(action.invoice.totalCents)}</p><p>{action.status === 'PAID' ? 'Registre apenas após conferir o recebimento por um meio externo. Esta ação encerra a fatura.' : 'Esta ação encerra a fatura e não gera estorno. Não será possível emitir outra para a mesma competência.'}</p>{error && <p role="alert" className="inline-form-error">{error}</p>}<label>{action.status === 'PAID' ? 'Referência / comprovante conferido' : 'Justificativa'}<textarea autoFocus required minLength={3} maxLength={1000} value={note} disabled={busy} onChange={e => setNote(e.target.value)} /></label><div className="pf-actions"><button className="primary" disabled={busy} type="submit">{busy ? 'Registrando…' : 'Confirmar'}</button><button className="ghost" disabled={busy} type="button" onClick={() => setAction(null)}>Voltar</button></div></form></dialog>, document.body)}
  </>;
};
