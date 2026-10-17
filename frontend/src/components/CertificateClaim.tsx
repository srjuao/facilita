import React, { useEffect, useState } from 'react';
import { Award, Download, LockKeyhole } from 'lucide-react';
import api from '../api/client';
import './certificates.css';

type Scope = 'course' | 'module';
type Certificate = { code: string; scope: Scope; targetId: string; downloadUrl: string };
type Props = { scope: Scope; targetId: string; title: string; lessonsCompleted: boolean };
const failureText = (error: unknown) => (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Não foi possível emitir o certificado. Tente novamente.';

export const CertificateClaim: React.FC<Props> = ({ scope, targetId, title, lessonsCompleted }) => {
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setCertificate(null); setError('');
    api.get<{ certificates: Certificate[] }>('/certificates/mine', { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setCertificate(response.data.certificates.find(item => item.scope === scope && item.targetId === targetId) || null); })
      .catch(() => { if (!controller.signal.aborted) setError('Não foi possível verificar seus certificados.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [scope, targetId]);
  const download = async (item: Certificate) => {
    setBusy(true); setError('');
    try {
      const path = item.downloadUrl.replace(/^\/api\//, '/');
      const response = await api.get<Blob>(path, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'text/html;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `certificado-${item.code}.html`; document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch { setError('Não foi possível baixar o certificado. Tente novamente.'); }
    finally { setBusy(false); }
  };
  const issue = async () => {
    if (busy || !lessonsCompleted) return;
    setBusy(true); setError('');
    try { const response = await api.post<{ certificate: Certificate }>('/certificates/issue', { scope, targetId }); setCertificate(response.data.certificate); }
    catch (failure) { setError(failureText(failure)); }
    finally { setBusy(false); }
  };
  return <section className="certificate-claim" aria-label={`Certificado de ${title}`}><span className="certificate-claim-icon"><Award size={22} /></span><div className="certificate-claim-copy"><strong>Certificado {scope === 'module' ? 'da matéria' : 'do curso'}</strong><small>{certificate ? 'Emitido em seu nome pela instituição.' : lessonsCompleted ? 'Concluiu as aulas? Emita após aprovação na avaliação final, quando houver.' : 'Conclua todas as aulas para solicitar seu certificado.'}</small>{error && <p role="alert" className="certificate-claim-error">{error}</p>}</div>{loading ? <span className="muted">Verificando…</span> : certificate ? <button className="btn" disabled={busy} onClick={() => void download(certificate)}><Download size={16} />{busy ? 'Baixando…' : 'Baixar'}</button> : <button className="btn" disabled={busy || !lessonsCompleted} onClick={() => void issue()}>{lessonsCompleted ? <Award size={16} /> : <LockKeyhole size={15} />}{busy ? 'Emitindo…' : 'Emitir'}</button>}</section>;
};
