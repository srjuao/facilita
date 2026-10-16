import React, { useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export const LeadContactForm: React.FC<{ students?: number }> = ({ students }) => {
  const [form, setForm] = useState({ nome: '', instituicao: '', email: '', telefone: '', alunos: '', mensagem: '', consent: false, website: '' });
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setError('');
    const amount = form.alunos ? Number(form.alunos) : null;
    if (!form.nome.trim() || !form.instituicao.trim()) { setError('Preencha seu nome e o nome da instituição.'); return; }
    if (form.telefone.replace(/\D/g, '').length < 8 || form.telefone.replace(/\D/g, '').length > 15) { setError('Informe um telefone válido, incluindo o DDD.'); return; }
    if (amount !== null && (!Number.isInteger(amount) || amount < 1 || amount > 100000)) { setError('Informe de 1 a 100.000 alunos.'); return; }
    setSaving(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch('/api/public/leads', { signal: controller.signal, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, alunos: amount }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Não foi possível enviar. Tente novamente em instantes.');
      setSent(true);
      setForm({ nome: '', instituicao: '', email: '', telefone: '', alunos: '', mensagem: '', consent: false, website: '' });
    } catch (requestError) { setError(requestError instanceof Error && requestError.name !== 'AbortError' ? requestError.message : 'Não foi possível confirmar o envio. Verifique sua conexão antes de tentar novamente.'); }
    finally { window.clearTimeout(timeout); setSaving(false); }
  };
  return <section id="contato" className="fl-contact fl-container">
    <div className="fl-contact-copy"><span className="fl-eyebrow">VAMOS CONVERSAR</span><h2>O próximo passo<br />começa com <em>você.</em></h2><p>Conte um pouco sobre sua instituição. Nossa equipe poderá conversar sobre a plataforma e ajudar a planejar sua implantação.</p><ul><li>Um espaço com a identidade da sua instituição.</li><li>Organização para cursos, professores e alunos.</li><li>Preços que acompanham seu crescimento.</li></ul><small>Enviar o formulário não gera cobrança ou contratação.</small></div>
    {sent ? <div className="fl-contact-success" role="status"><CheckCircle2 size={38} /><h3>Recebemos seu contato!</h3><p>Obrigado pelo interesse no Facilita Estudos. Nossa equipe poderá retornar pelo e-mail ou telefone informado.</p><button className="fl-button" onClick={() => setSent(false)}>Enviar outro contato</button></div> : <form className="fl-contact-form" onSubmit={submit}>
      <h3>Quero conhecer o Facilita Estudos</h3>
      {error && <p role="alert" className="fl-input-error">{error}</p>}
      <fieldset disabled={saving}><div className="fl-contact-fields">
        <label>Seu nome<input autoComplete="name" required maxLength={120} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></label>
        <label>Nome da instituição<input autoComplete="organization" required maxLength={160} value={form.instituicao} onChange={e => setForm({ ...form, instituicao: e.target.value })} /></label>
        <label>E-mail<input type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
        <label>Telefone com DDD<input type="tel" autoComplete="tel" required maxLength={32} placeholder="(62) 99999-9999" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} /></label>
        <label>Quantidade de alunos <small>(opcional)</small><input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={form.alunos} onChange={e => setForm({ ...form, alunos: e.target.value })} /></label>
        <div className="fl-contact-estimate">{students && <button type="button" onClick={() => setForm({ ...form, alunos: String(students) })}>Usar os {students.toLocaleString('pt-BR')} alunos da simulação</button>}</div>
        <label className="fl-contact-wide">Como podemos ajudar? <small>(opcional)</small><textarea rows={3} maxLength={2000} value={form.mensagem} onChange={e => setForm({ ...form, mensagem: e.target.value })} /></label>
      </div>
      <div className="fl-contact-trap" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} /></label></div>
      <label className="fl-contact-consent"><input type="checkbox" required checked={form.consent} onChange={e => setForm({ ...form, consent: e.target.checked })} /><span>Autorizo o Facilita Estudos a usar os dados acima para responder à minha solicitação por e-mail ou telefone. O contato ficará disponível apenas à equipe administrativa da plataforma.</span></label>
      <button className="fl-button" type="submit">{saving ? 'Enviando contato…' : <>Solicitar contato <ArrowRight size={18} /></>}</button>
      </fieldset>
    </form>}
  </section>;
};
