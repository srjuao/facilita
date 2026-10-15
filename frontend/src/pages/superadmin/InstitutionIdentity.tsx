import React, { FormEvent, useEffect, useRef, useState } from 'react';
import api from '../../api/client';
import { Tenant } from '../../types';
import './InstitutionIdentity.css';

type Key = 'logoUrl' | 'loginImageUrl' | 'faviconUrl';
const fields: { key: Key; type: string; label: string; accept: string }[] = [
  { key: 'logoUrl', type: 'logo', label: 'Logotipo — login e sidebar', accept: 'image/png,image/jpeg,image/webp,image/svg+xml' },
  { key: 'loginImageUrl', type: 'loginMedia', label: 'Imagem ou vídeo de login', accept: 'image/png,image/jpeg,image/webp,video/mp4' },
  { key: 'faviconUrl', type: 'favicon', label: 'Ícone do navegador', accept: 'image/png,image/jpeg,image/webp,image/svg+xml' }
];

export const InstitutionIdentity: React.FC<{ tenant: Tenant; onSaved: (tenant: Tenant) => void }> = ({ tenant, onSaved }) => {
  const [draft, setDraft] = useState({ logoUrl: tenant.logoUrl || '', loginImageUrl: tenant.loginImageUrl || '', faviconUrl: tenant.faviconUrl || '', browserTitle: tenant.browserTitle || '', primaryColor: tenant.primaryColor || '#2f7dd1' });
  const [files, setFiles] = useState<Partial<Record<Key, File>>>({});
  const [previews, setPreviews] = useState<Partial<Record<Key, string>>>({});
  const urls = useRef<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  useEffect(() => () => urls.current.forEach(url => URL.revokeObjectURL(url)), []);

  const choose = (key: Key, file?: File) => {
    if (!file) return;
    const allowed = key === 'loginImageUrl' ? ['image/png', 'image/jpeg', 'image/webp', 'video/mp4'] : ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.type) || file.size > 50 * 1024 * 1024) {
      setMessage({ error: true, text: 'Selecione um formato permitido de até 50 MB.' }); return;
    }
    const url = URL.createObjectURL(file); urls.current.push(url);
    setFiles(current => ({ ...current, [key]: file }));
    setPreviews(current => ({ ...current, [key]: url }));
    setMessage(null);
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage(null);
    const values = { ...draft };
    try {
      for (const field of fields) {
        const file = files[field.key];
        if (!file) continue;
        const body = new FormData(); body.append('assetType', field.type); body.append('file', file);
        const response = await api.post(`/tenants/${tenant.id}/branding/upload`, body, { timeout: 120000 });
        values[field.key] = response.data.url;
      }
      const updated = (await api.patch(`/tenants/${tenant.id}/branding`, values)).data as Tenant;
      const confirmed = (await api.get(`/tenants/${tenant.id}`)).data as Tenant;
      if (fields.some(field => confirmed[field.key] !== updated[field.key]) || confirmed.browserTitle !== values.browserTitle || confirmed.primaryColor !== values.primaryColor) throw new Error('verification');
      setDraft(values); setFiles({}); onSaved(confirmed);
      setMessage({ error: false, text: 'Identidade salva e confirmada. Recarregue o portal da instituição para visualizar as alterações.' });
    } catch (error: any) {
      setMessage({ error: true, text: error.response?.data?.error || 'Não foi possível confirmar o salvamento. Os arquivos selecionados continuam aqui para tentar novamente.' });
    } finally { setSaving(false); }
  };
  const src = (key: Key) => previews[key] || draft[key];
  const video = files.loginImageUrl ? files.loginImageUrl.type === 'video/mp4' : /\.mp4$/i.test(draft.loginImageUrl);

  return <form className="institution-identity" onSubmit={save}>
    <div><p className="eyebrow">IDENTIDADE DA INSTITUIÇÃO</p><h2>Marca, login e navegador</h2><p className="muted">Veja a prévia antes de salvar. O logotipo aparece no login e no menu lateral da unidade.</p></div>
    {message && <div className={message.error ? 'inline-form-error' : 'identity-success'} role={message.error ? 'alert' : 'status'}>{message.text}</div>}
    <fieldset disabled={saving} className="identity-fields">
      <div className="identity-assets">{fields.map(field => <label key={field.key} className="identity-upload"><b>{field.label}</b><small>{field.key === 'loginImageUrl' ? 'PNG, JPG, WebP ou MP4' : 'PNG, JPG, WebP ou SVG'} · até 50 MB</small><div className={`identity-preview ${field.key === 'faviconUrl' ? 'favicon-preview' : ''}`}>{src(field.key) ? field.key === 'loginImageUrl' && video ? <video src={src(field.key)} controls muted playsInline /> : <img src={src(field.key)} alt={`Prévia de ${field.label}`} /> : <span>Nenhum arquivo definido</span>}</div><input type="file" accept={field.accept} onChange={event => choose(field.key, event.target.files?.[0])} /><small>{files[field.key]?.name || (draft[field.key] ? 'Arquivo atual da instituição' : 'Será usada a identidade padrão')}</small></label>)}</div>
      <div className="identity-options"><label>Título da aba<input maxLength={80} value={draft.browserTitle} placeholder={`${tenant.nome} | Facilita Estudos`} onChange={event => setDraft({ ...draft, browserTitle: event.target.value })} /></label><label>Cor principal<div className="identity-color"><input type="color" value={draft.primaryColor} onChange={event => setDraft({ ...draft, primaryColor: event.target.value })} /><span>{draft.primaryColor}</span></div></label></div>
      <section className="identity-sidebar-preview"><p className="eyebrow">PRÉVIA DA SIDEBAR</p><img src={src('logoUrl') || '/facilita-estudos-logo.svg'} alt="Logotipo na sidebar" /><small>{tenant.nome}</small></section>
    </fieldset>
    <div className="identity-save"><span>{Object.keys(files).length ? 'Há arquivos selecionados aguardando salvamento.' : 'As alterações são publicadas ao salvar.'}</span><button className="btn primary" disabled={saving}>{saving ? 'Enviando e salvando…' : 'Salvar configurações'}</button></div>
  </form>;
};
