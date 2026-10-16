import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Plan } from './plans';

export const PublicPricingSelector: React.FC<{ plans: Plan[] }> = ({ plans }) => {
  const [current, setCurrent] = useState<string | null>(null);
  const [choice, setChoice] = useState('');
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const load = async () => {
    setLoading(true); setNotice(null);
    try { const { data } = await api.get('/pricing-setting'); setCurrent(data.planId); setChoice(data.planId || ''); setLoaded(true); }
    catch { setNotice({ error: true, text: 'Não foi possível consultar o plano publicado no site.' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!choice || saving) return;
    setSaving(true); setNotice(null);
    try { const { data } = await api.patch('/pricing-setting', { planId: choice, expectedPlanId: current }); setCurrent(data.planId); setChoice(data.planId || ''); setNotice({ error: false, text: 'Plano publicado na landing. Os preços das instituições já vinculadas não foram alterados.' }); }
    catch (error: any) { setNotice({ error: true, text: error.response?.data?.error || 'Não foi possível publicar os preços.' }); }
    finally { setSaving(false); }
  };
  return <section className="card plan-create"><div className="plans-section-heading"><div><h2>Preços publicados na landing</h2><p className="muted">O site lê as faixas deste plano diretamente do catálogo.</p></div><button className="ghost" disabled={loading || saving} onClick={() => void load()}>Atualizar</button></div>
    {notice && <div className={notice.error ? 'inline-form-error' : 'plans-success'} role={notice.error ? 'alert' : 'status'}>{notice.text}</div>}
    {loading ? <p role="status">Consultando publicação…</p> : loaded && <form onSubmit={save}><label className="plans-search">Plano institucional público<select required disabled={saving} value={choice} onChange={event => setChoice(event.target.value)}><option value="" disabled>Selecione um plano</option>{plans.filter(plan => plan.ativo && plan.billingMode === 'FAIXAS' && plan.studentLimit === null).map(plan => <option key={plan.id} value={plan.id}>{plan.nome}</option>)}</select></label><p className="plans-explanation">Somente planos por faixas, ativos e sem limite de alunos podem ser publicados. Para mudar valores, crie uma nova versão do plano e selecione-a aqui. Contratos existentes preservam sua versão.</p><button className="primary" disabled={saving || !choice || choice === current}>{saving ? 'Publicando…' : 'Publicar preços no site'}</button></form>}
  </section>;
};
