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

export const InstitutionIdentity: React.FC<{ tenant: Tenant; onSaved: (tenant: Tenant) => void; section?: 'brand' | 'login'; onContinue?: () => void; onBusy?: (busy: boolean) => void }> = ({ tenant, onSaved, section = 'brand', onContinue, onBusy }) => {
  const [draft, setDraft] = useState({ logoUrl: tenant.logoUrl || '', loginImageUrl: tenant.loginImageUrl || '', faviconUrl: tenant.faviconUrl || '', browserTitle: tenant.browserTitle || '', primaryColor: tenant.primaryColor || '#2f7dd1', loginKicker: tenant.loginKicker || '', loginTitle: tenant.loginTitle || '', loginDescription: tenant.loginDescription || '' });
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
    event.preventDefault(); setSaving(true); onBusy?.(true); setMessage(null);
    const values = { ...draft };
    values.loginKicker = values.loginKicker.trim();
    values.loginTitle = values.loginTitle.trim();
    values.loginDescription = values.loginDescription.trim();
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
      if (confirmed.loginKicker !== values.loginKicker || confirmed.loginTitle !== values.loginTitle || confirmed.loginDescription !== values.loginDescription) throw new Error('verification');
      setDraft(values); setFiles({}); onSaved(confirmed); onContinue?.();
      setMessage({ error: false, text: 'Identidade salva e confirmada. Recarregue o portal da instituição para visualizar as alterações.' });
    } catch (error: any) {
      setMessage({ error: true, text: error.response?.data?.error || 'Não foi possível confirmar o salvamento. Os arquivos selecionados continuam aqui para tentar novamente.' });
    } finally { setSaving(false); onBusy?.(false); }
  };
  const src = (key: Key) => previews[key] || draft[key];
  const video = files.loginImageUrl ? files.loginImageUrl.type === 'video/mp4' : /\.mp4(?:\?|$)/i.test(draft.loginImageUrl);
  const logo = src('logoUrl') || '/facilita-estudos-logo.svg';
  const favicon = src('faviconUrl') || '/facilita-estudos-mark.svg';
  const title = draft.browserTitle || `${tenant.nome} | Facilita Estudos`;
  const upload = (field: typeof fields[number]) => <label key={field.key} className="identity-upload">
    <span className="identity-upload-thumb" aria-hidden="true">{src(field.key) ? field.key === 'loginImageUrl' && video ? <video src={src(field.key)} muted playsInline /> : <img src={src(field.key)} alt="" /> : <span>+</span>}</span>
    <span className="identity-upload-copy"><b>{field.label}</b><small>{files[field.key]?.name || (draft[field.key] ? 'Arquivo atual' : 'Usando o padrão do Facilita')}</small><small>{field.key === 'loginImageUrl' ? 'PNG, JPG, WebP ou MP4' : 'PNG, JPG, WebP ou SVG'} · até 50 MB</small></span>
    <span className="identity-upload-action">{src(field.key) ? 'Trocar' : 'Enviar'}</span>
    <input className="identity-file-input" type="file" accept={field.accept} onChange={event => choose(field.key, event.target.files?.[0])} />
  </label>;

  return <form className="institution-identity" onSubmit={save}>
    <div className="identity-heading"><div><p className="eyebrow">IDENTIDADE DA INSTITUIÇÃO</p><h2>{section === 'brand' ? 'Marca e navegador' : 'Tela de login'}</h2></div><p className="muted">Edite à esquerda e confira o resultado à direita antes de salvar.</p></div>
    {message && <div className={message.error ? 'inline-form-error' : 'identity-success'} role={message.error ? 'alert' : 'status'}>{message.text}</div>}
    <fieldset disabled={saving} className="identity-fields" style={{ '--identity-accent': draft.primaryColor } as React.CSSProperties}>
      <div className="identity-editor">
        <div className="identity-controls">
          {section === 'brand' ? <>
            <div className="identity-assets">{fields.filter(field => field.key !== 'loginImageUrl').map(upload)}</div>
            <div className="identity-options"><label>Título da aba<input maxLength={80} value={draft.browserTitle} placeholder={`${tenant.nome} | Facilita Estudos`} onChange={event => setDraft({ ...draft, browserTitle: event.target.value })} /></label><label>Cor principal<div className="identity-color"><input type="color" value={draft.primaryColor} onChange={event => setDraft({ ...draft, primaryColor: event.target.value })} /><span>{draft.primaryColor}</span></div></label></div>
          </> : <>
            <div className="identity-assets">{fields.filter(field => field.key === 'loginImageUrl').map(upload)}</div>
            <div className="identity-copy"><label>Chamada acima do título<input maxLength={100} value={draft.loginKicker} placeholder="Conhecimento que conecta" onChange={event => setDraft({ ...draft, loginKicker: event.target.value })} /></label><label>Título principal<textarea rows={2} maxLength={200} value={draft.loginTitle} placeholder={`Uma experiência feita para ${tenant.nome}.`} onChange={event => setDraft({ ...draft, loginTitle: event.target.value })} /></label><label>Texto de apresentação<textarea rows={3} maxLength={1000} value={draft.loginDescription} placeholder="Uma plataforma para a instituição, coordenação e alunos seguirem juntos." onChange={event => setDraft({ ...draft, loginDescription: event.target.value })} /></label></div>
          </>}
        </div>
        <section className="identity-live-preview" aria-label={section === 'brand' ? 'Prévia da marca no navegador e no menu lateral' : 'Prévia da tela de login'}>
          <div className="identity-preview-heading"><b>Prévia em tempo real</b><span>As alterações só são publicadas ao salvar</span></div>
          {section === 'brand' ? <div className="identity-browser-preview"><div className="identity-browser-bar"><span className="identity-browser-dots" aria-hidden="true">● ● ●</span><span className="identity-browser-tab"><img src={favicon} alt="" />{title}</span></div><div className="identity-browser-body"><div className="identity-sidebar-demo"><img src={logo} alt="" /><small>{tenant.nome}</small><span className="identity-demo-nav active">▦ <span>Dashboard</span></span><span className="identity-demo-nav">▤ <span>Alunos</span></span><span className="identity-demo-nav">▣ <span>Conteúdo</span></span></div><div className="identity-page-demo"><small>PAINEL DA INSTITUIÇÃO</small><strong>Bem-vindo, {tenant.nome}</strong><span className="identity-demo-line" /><span className="identity-demo-line short" /></div></div></div> : <div className="identity-login-demo"><div className="identity-login-art">{src('loginImageUrl') && (video ? <video src={src('loginImageUrl')} autoPlay muted loop playsInline /> : <img src={src('loginImageUrl')} alt="" />)}<div className="identity-login-overlay"><img src={logo} alt="" /><div><small>{draft.loginKicker || 'Conhecimento que conecta'}</small><strong>{draft.loginTitle || `Uma experiência feita para ${tenant.nome}.`}</strong><p>{draft.loginDescription || 'Uma plataforma para a instituição, coordenação e alunos seguirem juntos — com clareza, contexto e evolução em cada etapa.'}</p></div></div></div><div className="identity-login-form-demo"><small>ENTRAR</small><strong>Bem-vindo de volta</strong><span>Acesse sua instituição para continuar.</span><i>E-mail institucional</i><i>Senha</i><span className="identity-login-button">Acessar plataforma</span></div></div>}
        </section>
      </div>
    </fieldset>
    <div className="identity-save"><span>{Object.keys(files).length ? 'Há arquivos selecionados aguardando salvamento.' : 'As alterações são publicadas ao salvar.'}</span><button className="btn primary" disabled={saving}>{saving ? 'Enviando e salvando…' : 'Salvar e continuar'}</button></div>
  </form>;
};
