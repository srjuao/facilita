import React, { useEffect, useState } from 'react';
import { Plus, Copy } from 'lucide-react';
import { AppDialog } from '../../components/AppDialog';
import api from '../../api/client';
import { TopBar } from '../../components/TopBar';
import { Plan, priceLabel } from './plans';
import { planPriceCents, planStudentLimit } from '../../plan-input.mjs';
import { validPricePoints } from '../../pricing.mjs';
import { PublicPricingSelector } from './PublicPricingSelector';
import { PlanAssignments } from './PlanAssignments';
import './SuperAdminPlans.css';

const empty = { nome: '', descricao: '', billingMode: 'FAIXAS' as 'FIXO' | 'POR_ALUNO' | 'FAIXAS', points: [{ students: '', price: '' }, { students: '', price: '' }], price: '', limit: '', videoAulas: true, provas: true, ia: false };
export const SuperAdminPlans: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tab, setTab] = useState<'catalog' | 'institutions' | 'public'>('catalog');
  const [filter, setFilter] = useState(true);
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => { if (open) setStep(0); }, [open]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changing, setChanging] = useState('');
  const [statusPlan, setStatusPlan] = useState<Plan | null>(null);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const load = async () => { setLoading(true); try { setPlans((await api.get<Plan[]>('/plans')).data); } catch { setNotice({ error: true, text: 'Não foi possível carregar os planos.' }); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const create = async (event: React.FormEvent) => {
    event.preventDefault(); if (saving) return;
    if (step === 0) {
      if (!form.nome.trim() || (form.billingMode !== 'FAIXAS' && planPriceCents(form.price) === null) || planStudentLimit(form.limit) === undefined) {
        setNotice({ error: true, text: 'Confira o nome, o valor e o limite de alunos antes de continuar.' }); return;
      }
      setNotice(null); setStep(1); return;
    }
    const priceCents = form.billingMode === 'FAIXAS' ? 0 : planPriceCents(form.price);
    const pricePoints = form.billingMode === 'FAIXAS' ? form.points.map(point => ({ students: /^\d+$/.test(point.students) ? Number(point.students) : NaN, unitCents: planPriceCents(point.price) })) : [];
    if (form.billingMode === 'FAIXAS' && !validPricePoints(pricePoints)) { setNotice({ error: true, text: 'Cadastre de 2 a 20 faixas: alunos inteiros crescentes, preço por aluno não crescente e totais mensais não decrescentes.' }); return; }
    const studentLimit = planStudentLimit(form.limit);
    if (priceCents === null || studentLimit === undefined) { setNotice({ error: true, text: 'Informe um valor de até R$ 1.000.000,00, com até duas casas decimais e sem separador de milhar; use limite entre 1 e 1.000.000 de alunos ou deixe vazio.' }); return; }
    setSaving(true); setNotice(null);
    try {
      const { data } = await api.post<Plan>('/plans', { nome: form.nome.trim(), descricao: form.descricao.trim(), billingMode: form.billingMode, priceCents, pricePoints, studentLimit, videoAulas: form.videoAulas, provas: form.provas, ia: form.ia });
      setPlans(current => [...current, data]); setForm(empty); setOpen(false); setStep(0); setFilter(true);
      setNotice({ error: false, text: 'Plano criado. Vincule-o às instituições na aba de vínculos.' });
    } catch (error: any) { setNotice({ error: true, text: error.response?.data?.error || 'Não foi possível criar o plano. Os dados continuam preenchidos.' }); }
    finally { setSaving(false); }
  };
  const toggle = async (plan: Plan) => {
    if (changing || saving) return;
    setChanging(plan.id); setNotice(null);
    try { const { data } = await api.patch<Plan>(`/plans/${plan.id}/status`, { ativo: !plan.ativo }); setPlans(current => current.map(item => item.id === data.id ? data : item)); setStatusPlan(null); setNotice({ error: false, text: data.ativo ? 'Plano reativado no catálogo.' : 'Plano desativado para novos vínculos. Os contratos existentes foram preservados.' }); }
    catch (error: any) { setNotice({ error: true, text: error.response?.data?.error || 'Não foi possível alterar a disponibilidade do plano.' }); }
    finally { setChanging(''); }
  };
  const duplicate = (plan: Plan) => { setForm({ nome: (plan.nome + ' · nova versão').slice(0, 100), descricao: plan.descricao, billingMode: plan.billingMode, price: (plan.priceCents / 100).toFixed(2).replace('.', ','), points: plan.pricePoints.length ? plan.pricePoints.map(point => ({ students: String(point.students), price: (point.unitCents / 100).toFixed(2).replace('.', ',') })) : empty.points.map(point => ({ ...point })), limit: plan.studentLimit?.toString() || '', videoAulas: plan.videoAulas, provas: plan.provas, ia: plan.ia }); setOpen(true); setNotice(null); };
  return <><TopBar currentPage="Planos e assinaturas" /><div className="sa-plans"><header className="plans-section-heading"><div><p className="eyebrow">CONDIÇÕES E ACESSOS</p><h1>Um plano para cada instituição.</h1><p className="muted">Defina o preço mensal, a capacidade e os recursos incluídos.</p></div><button className="primary" disabled={saving} onClick={() => { setTab('catalog'); setForm(empty); setOpen(true); setNotice(null); }}><Plus size={17} /> Criar plano</button></header>
    <div className="tenant-tabs" aria-label="Gestão de planos"><button disabled={saving} className={tab === 'catalog' ? 'on' : ''} onClick={() => setTab('catalog')}>Catálogo de planos</button><button disabled={saving} className={tab === 'institutions' ? 'on' : ''} onClick={() => { setTab('institutions'); setOpen(false); }}>Vínculos por instituição</button><button disabled={saving} className={tab === 'public' ? 'on' : ''} onClick={() => { setTab('public'); setOpen(false); }}>Preços no site</button></div>
    {!open && notice && <div className={notice.error ? 'inline-form-error' : 'plans-success'} role={notice.error ? 'alert' : 'status'}>{notice.text}</div>}
    {tab === 'institutions' ? <PlanAssignments /> : tab === 'public' ? <PublicPricingSelector plans={plans} /> : <>
      {open && <AppDialog title="Configure seu plano" eyebrow="CATÁLOGO · NOVA VERSÃO" description="Defina as condições, os preços e os recursos que a instituição poderá contratar." busy={saving} wide focusKey={step} onClose={() => setOpen(false)}><section className="plan-create">{notice && <div role={notice.error ? 'alert' : 'status'} className={notice.error ? 'inline-form-error' : 'plans-success'}>{notice.text}</div>}<form onSubmit={create}><fieldset disabled={saving}>
        <ol className="plans-progress" aria-label="Etapas do plano">{['Condições', 'Preços e recursos'].map((label, index) => <li key={label} className={step === index ? 'current' : step > index ? 'complete' : ''} aria-current={step === index ? 'step' : undefined}><span>{index + 1}</span>{label}</li>)}</ol>
        {step === 0 && <div className="plans-form-grid"><label>Nome do plano<input required maxLength={100} value={form.nome} onChange={event => setForm({ ...form, nome: event.target.value })} /></label><label>Modelo de cobrança<select value={form.billingMode} onChange={event => setForm({ ...form, billingMode: event.target.value as typeof form.billingMode })}><option value="FAIXAS">Por aluno · faixas progressivas</option><option value="POR_ALUNO">Mensal por aluno cadastrado</option><option value="FIXO">Mensalidade fixa por instituição</option></select></label>{form.billingMode !== 'FAIXAS' && <label>{form.billingMode === 'FIXO' ? 'Mensalidade em reais' : 'Valor mensal por aluno em reais'}<input type="text" inputMode="decimal" required placeholder="Ex.: 57,90" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} /><small>Preço único desta versão do plano.</small></label>}<label>Limite de alunos <small>(opcional)</small><input inputMode="numeric" type="text" maxLength={7} value={form.limit} onChange={event => setForm({ ...form, limit: event.target.value })} placeholder="Vazio = sem limite contratado" /></label><label className="plans-full">Descrição e funcionamento<textarea rows={3} maxLength={1000} value={form.descricao} onChange={event => setForm({ ...form, descricao: event.target.value })} placeholder="Descreva a quem o plano atende e como funciona." /></label></div>}
        {step === 1 && <>
        {form.billingMode === 'FAIXAS' && <section className="plans-tier-editor"><h3>Faixas de quantidade e preço</h3><p className="muted">Cada linha é uma referência de quantidade e preço por aluno. Entre as referências, o total é interpolado; acima da última, vale o último preço por aluno.</p>{form.points.map((point, index) => <div className="plans-tier-row" key={index}><label>Alunos na referência {index + 1}<input required inputMode="numeric" maxLength={6} value={point.students} onChange={event => setForm({ ...form, points: form.points.map((item, row) => row === index ? { ...item, students: event.target.value } : item) })} /></label><label>Preço por aluno (R$)<input required inputMode="decimal" value={point.price} onChange={event => setForm({ ...form, points: form.points.map((item, row) => row === index ? { ...item, price: event.target.value } : item) })} /></label><button type="button" className="ghost" disabled={form.points.length <= 2} aria-label={`Remover faixa ${index + 1}`} onClick={() => setForm({ ...form, points: form.points.filter((_, row) => row !== index) })}>Remover</button></div>)}<button className="ghost" type="button" disabled={form.points.length >= 20} onClick={() => setForm({ ...form, points: [...form.points, { students: '', price: '' }] })}>Adicionar faixa</button></section>}
        <section className="plans-features"><h3>Recursos incluídos</h3><p className="muted">Gestão básica de cursos e usuários permanece disponível. Os recursos abaixo são liberados conforme o plano.</p>{([['videoAulas', 'Videoaulas', 'Publicação e acesso às aulas em vídeo.'], ['provas', 'Provas e simulados', 'Acesso às avaliações cadastradas no curso.'], ['ia', 'Assistente de IA · integração pendente', 'Controla o acesso ao chat. Não configura um provedor de IA; respostas reais dependem dessa integração.']] as const).map(([key, label, hint]) => <label key={key}><input type="checkbox" checked={form[key]} onChange={event => setForm({ ...form, [key]: event.target.checked })} /><span><b>{label}</b><small>{hint}</small></span></label>)}</section>
        <p className="plans-explanation">O preço e os recursos deste plano serão preservados após a criação. Para alterar condições, crie uma nova versão e atualize os vínculos desejados. Nenhum boleto será emitido ao salvar.</p></>}<div className="plan-assignment-actions">{step > 0 && <button type="button" className="ghost" onClick={() => setStep(0)}>Voltar</button>}<button className="primary">{saving ? 'Criando plano…' : step === 0 ? 'Continuar' : 'Criar plano'}</button></div>
      </fieldset></form></section></AppDialog>}
      <div className="plans-section-heading"><div><h2>Planos cadastrados</h2><p className="muted">Condições preservadas por versão, sem alterações retroativas.</p></div><div className="tenant-tabs"><button className={filter ? 'on' : ''} onClick={() => setFilter(true)}>Disponíveis</button><button className={!filter ? 'on' : ''} onClick={() => setFilter(false)}>Desativados</button><button disabled={loading} onClick={() => void load()}>Atualizar</button></div></div>
      {loading ? <p role="status">Carregando catálogo…</p> : <div className="plans-catalog">{plans.filter(plan => plan.ativo === filter).map(plan => <article className="card plan-catalog-card" key={plan.id}><p className="eyebrow">{plan.ativo ? 'DISPONÍVEL PARA VÍNCULO' : 'DESATIVADO NO CATÁLOGO'}</p><h2>{plan.nome}</h2><strong>{priceLabel(plan)}</strong>{plan.billingMode === 'FAIXAS' && <table className="plan-tier-table"><caption>Referências desta versão</caption><thead><tr><th>Alunos</th><th>R$/aluno</th></tr></thead><tbody>{plan.pricePoints.filter(point => plan.studentLimit === null || point.students <= plan.studentLimit).map(point => <tr key={point.students}><td>{point.students.toLocaleString('pt-BR')}</td><td>{(point.unitCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>)}</tbody></table>}<p className="plan-description">{plan.descricao || 'Sem descrição adicional.'}</p><span className="pill">{plan.studentLimit ? 'Até ' + plan.studentLimit.toLocaleString('pt-BR') + ' alunos' : 'Sem limite contratado de alunos'}</span><ul><li>{plan.videoAulas ? 'Inclui' : 'Não inclui'} videoaulas</li><li>{plan.provas ? 'Inclui' : 'Não inclui'} provas e simulados</li><li>{plan.ia ? 'Inclui' : 'Não inclui'} assistente de IA</li></ul><small>{plan._count?.tenants ?? 0} instituições vinculadas · criado em {new Date(plan.createdAt).toLocaleDateString('pt-BR')}</small><div className="plan-card-actions"><button className="ghost" disabled={saving || !!changing} onClick={() => duplicate(plan)}><Copy size={15} /> Criar nova versão</button><button className="ghost" disabled={saving || !!changing} onClick={() => { setNotice(null); setStatusPlan(plan); }}>{changing === plan.id ? 'Salvando…' : plan.ativo ? 'Desativar no catálogo' : 'Reativar no catálogo'}</button></div></article>)}
        {!plans.some(plan => plan.ativo === filter) && <div className="card plans-empty"><h3>Nenhum plano nesta aba.</h3><p>Crie as condições da sua plataforma. Nenhum plano de demonstração é adicionado automaticamente.</p></div>}
      </div>}
    </>}
    {statusPlan && <AppDialog title={statusPlan.ativo ? 'Desativar plano?' : 'Reativar plano?'} eyebrow={statusPlan.nome} busy={!!changing} onClose={() => setStatusPlan(null)}><p>{statusPlan.ativo ? 'O plano ficará indisponível para novos vínculos. Os contratos das instituições que já usam esta versão serão preservados.' : 'Esta versão voltará a ficar disponível para novas instituições.'}</p>{notice?.error && <p className="inline-form-error" role="alert">{notice.text}</p>}<div className="plan-assignment-actions"><button className="ghost" disabled={!!changing} onClick={() => setStatusPlan(null)}>Cancelar</button><button className={statusPlan.ativo ? 'danger-action' : 'primary'} disabled={!!changing} onClick={() => void toggle(statusPlan)}>{changing ? 'Salvando…' : statusPlan.ativo ? 'Desativar plano' : 'Reativar plano'}</button></div></AppDialog>}
  </div></>;
};
