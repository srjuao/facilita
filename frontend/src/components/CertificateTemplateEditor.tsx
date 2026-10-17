import React, { FormEvent, useEffect, useState } from 'react';
import { Award, Check, ChevronDown } from 'lucide-react';
import api from '../api/client';
import './certificates.css';

type Scope = 'course' | 'module';
type Template = { scope: Scope; targetId: string; title: string; issuer: string; signatory: string; signatoryRole: string; workloadHours: number; enabled: boolean };
type Props = { courseId: string; courseName: string; moduleId?: string; moduleName?: string; institutionName?: string };
const failureText = (error: unknown) => (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Não foi possível salvar o certificado.';

export const CertificateTemplateEditor: React.FC<Props> = ({ courseId, courseName, moduleId, moduleName, institutionName }) => {
  const scope: Scope = moduleId ? 'module' : 'course';
  const targetId = moduleId || courseId;
  const contentName = moduleName || courseName;
  const [templates, setTemplates] = useState<Template[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState<Template>({ scope, targetId, title: 'Certificado de conclusão', issuer: institutionName || '', signatory: '', signatoryRole: '', workloadHours: 1, enabled: false });
  useEffect(() => {
    const controller = new AbortController();
    setNotice(''); setError(''); setOpen(false);
    api.get<{ templates: Template[] }>('/certificates/templates', { params: { courseId }, signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setTemplates(response.data.templates); })
      .catch(() => { if (!controller.signal.aborted) setError('Não foi possível carregar os certificados configurados.'); });
    return () => controller.abort();
  }, [courseId]);
  useEffect(() => {
    const existing = templates.find(item => item.scope === scope && item.targetId === targetId);
    setForm(existing || { scope, targetId, title: `Certificado de conclusão · ${contentName}`, issuer: institutionName || '', signatory: '', signatoryRole: '', workloadHours: 1, enabled: false });
  }, [templates, scope, targetId, contentName, institutionName]);
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await api.put<{ template: Template }>(`/certificates/templates/${scope}/${encodeURIComponent(targetId)}`, {
        title: form.title.trim(), issuer: form.issuer.trim(), signatory: form.signatory.trim(), signatoryRole: form.signatoryRole.trim(), workloadHours: Number(form.workloadHours), enabled: form.enabled
      });
      setTemplates(current => [...current.filter(item => !(item.scope === scope && item.targetId === targetId)), response.data.template]);
      setNotice('Certificado salvo. Ele será emitido somente após as aulas e a avaliação final serem concluídas.');
    } catch (failure) { setError(failureText(failure)); }
    finally { setBusy(false); }
  };
  const update = (key: keyof Template, value: string | number | boolean) => setForm(current => ({ ...current, [key]: value }));
  return <section className="certificate-editor" aria-label={`Certificado de ${contentName}`}>
    <button className="certificate-editor-toggle" type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}><span className="certificate-editor-icon"><Award size={20} /></span><span><strong>Certificado {moduleId ? 'da matéria' : 'do curso'}</strong><small>{templates.some(item => item.scope === scope && item.targetId === targetId && item.enabled) ? 'Ativo para alunos elegíveis' : 'Configure a identidade da instituição e a carga horária'}</small></span><ChevronDown size={18} className={open ? 'is-open' : ''} /></button>
    {open && <form className="certificate-editor-form" onSubmit={save}><p>O certificado usa o nome e o logotipo da instituição. O aluno poderá emitir o documento somente após concluir o conteúdo e a prova final, quando houver.</p><div className="certificate-editor-grid"><label>Título do certificado<input required maxLength={180} value={form.title} onChange={event => update('title', event.target.value)} /></label><label>Instituição emissora<input required maxLength={180} value={form.issuer} onChange={event => update('issuer', event.target.value)} placeholder="Nome oficial da instituição" /></label><label>Nome do responsável pela assinatura<input required maxLength={120} value={form.signatory} onChange={event => update('signatory', event.target.value)} placeholder="Ex.: Maria Silva" /></label><label>Cargo do responsável<input required maxLength={120} value={form.signatoryRole} onChange={event => update('signatoryRole', event.target.value)} placeholder="Ex.: Coordenação acadêmica" /></label><label>Carga horária (horas)<input required type="number" min={1} max={10000} step={1} value={form.workloadHours} onChange={event => update('workloadHours', Number(event.target.value))} /></label></div><label className="certificate-enabled"><input type="checkbox" checked={form.enabled} onChange={event => update('enabled', event.target.checked)} /> Disponibilizar para alunos que concluírem {moduleId ? 'a matéria' : 'o curso'}</label>{error && <p role="alert" className="inline-form-error">{error}</p>}{notice && <p role="status" className="certificate-success"><Check size={16} />{notice}</p>}<div className="certificate-editor-actions"><button className="btn primary" disabled={busy} type="submit">{busy ? 'Salvando…' : 'Salvar certificado'}</button></div></form>}
  </section>;
};
