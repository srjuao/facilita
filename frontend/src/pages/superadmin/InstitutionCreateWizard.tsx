import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Upload, X } from 'lucide-react';
import api from '../../api/client';
import { Tenant } from '../../types';

const initial = { nome: '', full: '', cidade: '', subdomain: '', admin: '', adminEmail: '', adminPassword: '' };
type AssetKey = 'logo' | 'loginMedia' | 'favicon';
type Asset = { file: File; preview: string };

export const InstitutionCreateWizard: React.FC<{ onClose: () => void; onCreated: (tenant: Tenant) => void }> = ({ onClose, onCreated }) => {
  const [step, setStep] = useState(1);
  const createdTenant = useRef<Tenant | null>(null);
  const previewUrls = useRef<string[]>([]);
  useEffect(() => () => previewUrls.current.forEach(url => URL.revokeObjectURL(url)), []);
  const go = (next: number) => { setError(''); setStep(next); };
  const [data, setData] = useState(initial);
  const [assets, setAssets] = useState<Partial<Record<AssetKey, Asset>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const domain = useMemo(() => `${data.subdomain.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'sua-faculdade'}.facilitaestudos.com.br`, [data.subdomain]);

  const chooseAsset = (key: AssetKey, file?: File) => {
    if (!file) return;
    const allowed = key === 'loginMedia' ? ['image/png', 'image/jpeg', 'image/webp', 'video/mp4'] : ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.type) || file.size > 50 * 1024 * 1024) { setError('Escolha um formato permitido de até 50 MB.'); return; }
    const preview = URL.createObjectURL(file); previewUrls.current.push(preview);
    setAssets(current => ({ ...current, [key]: { file, preview } })); setError('');
  };

  const create = async () => {
    setSaving(true); setError('');
    try {
      const created = createdTenant.current || (await api.post('/tenants', data)).data as Tenant;
      createdTenant.current = created;
      const branding: Record<string, string> = {};
      for (const [key, asset] of Object.entries(assets) as [AssetKey, Asset][]) {
        const body = new FormData(); body.append('assetType', key); body.append('file', asset.file);
        const response = await api.post(`/tenants/${created.id}/branding/upload`, body, { timeout: 120000 });
        branding[key === 'logo' ? 'logoUrl' : key === 'favicon' ? 'faviconUrl' : 'loginImageUrl'] = response.data.url;
      }
      const tenant = Object.keys(branding).length ? (await api.patch(`/tenants/${created.id}/branding`, { ...branding, browserTitle: '', primaryColor: '#2f7dd1' })).data as Tenant : created;
      onCreated(tenant);
    } catch (requestError: any) { setError(createdTenant.current ? 'A instituição já foi criada, mas a identidade não foi concluída. Tente novamente para reenviar os arquivos, sem criar outra instituição.' : requestError.response?.data?.error || 'Não foi possível criar a instituição.'); }
    finally { setSaving(false); }
  };

  return <div className="modal-backdrop"><section className="card institution-wizard" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
    <button type="button" disabled={saving} onClick={onClose} className="close wizard-close" aria-label="Fechar"><X size={20} /></button>
    <div className="wizard-steps" aria-label={`Etapa ${step} de 4`}><span className={step >= 1 ? 'on' : ''}>1 <b>Instituição</b></span><i /><span className={step >= 2 ? 'on' : ''}>2 <b>Coordenação</b></span><i /><span className={step >= 3 ? 'on' : ''}>3 <b>Identidade</b></span><i /><span className={step >= 4 ? 'on' : ''}>4 <b>Revisão</b></span></div>
    {error && <div className="inline-form-error" role="alert"><b>Não foi possível continuar.</b><span>{error}</span></div>}
    {step === 1 && <><p className="eyebrow">NOVA INSTITUIÇÃO</p><h2 id="wizard-title">Dados da instituição</h2><p className="muted">Reserve o endereço que será usado por alunos, docentes e coordenação.</p><div className="wizard-fields"><label>Nome de exibição<input required value={data.nome} placeholder="UniGoiás" onChange={event => setData({ ...data, nome: event.target.value })} /></label><label>Razão social<input required value={data.full} placeholder="Faculdade UniGoiás" onChange={event => setData({ ...data, full: event.target.value })} /></label><label>Cidade<input required value={data.cidade} placeholder="Goiânia, GO" onChange={event => setData({ ...data, cidade: event.target.value })} /></label><label>Subdomínio<input required value={data.subdomain} placeholder="unigoias" onChange={event => setData({ ...data, subdomain: event.target.value })} /><small>Endereço reservado: <b>{domain}</b></small></label></div><div className="wizard-actions"><button className="primary" onClick={() => data.nome.trim() && data.full.trim() && data.cidade.trim() && data.subdomain.trim() ? go(2) : setError('Preencha todos os dados da instituição para continuar.')}>Continuar</button></div></>}
    {step === 2 && <><p className="eyebrow">ACESSO ADMINISTRATIVO</p><h2 id="wizard-title">Quem administra esta unidade?</h2><p className="muted">Essa conta cria cursos, vincula docentes e acompanha a operação acadêmica.</p><div className="wizard-fields"><label>Nome do coordenador<input required value={data.admin} onChange={event => setData({ ...data, admin: event.target.value })} /></label><label>E-mail de acesso<input required type="email" value={data.adminEmail} onChange={event => setData({ ...data, adminEmail: event.target.value })} /></label><label>Senha de acesso<input required type="password" minLength={8} value={data.adminPassword} onChange={event => setData({ ...data, adminPassword: event.target.value })} /><small>8+ caracteres, com letra, número e caractere especial.</small></label></div><div className="wizard-actions"><button className="ghost" onClick={() => go(1)}><ArrowLeft size={16} /> Voltar</button><button className="primary" onClick={() => data.admin.trim() && /^\S+@\S+\.\S+$/.test(data.adminEmail.trim()) && data.adminPassword.length >= 8 && /[A-Za-z]/.test(data.adminPassword) && /\d/.test(data.adminPassword) && /[^A-Za-z0-9]/.test(data.adminPassword) ? go(3) : setError('Use nome, e-mail válido e senha de 8+ caracteres com letra, número e caractere especial.')}>Continuar</button></div></>}
    {step === 3 && <><p className="eyebrow">IDENTIDADE VISUAL</p><h2 id="wizard-title">Personalize a entrada</h2><p className="muted">Opcional: os arquivos são enviados junto com a criação da instituição.</p><div className="asset-grid"><AssetInput label="Logotipo" accept="image/png,image/jpeg,image/webp,image/svg+xml" asset={assets.logo} onChange={file => chooseAsset('logo', file)} /><AssetInput label="Imagem ou vídeo de login" accept="image/png,image/jpeg,image/webp,video/mp4" asset={assets.loginMedia} onChange={file => chooseAsset('loginMedia', file)} video /><AssetInput label="Ícone do navegador" accept="image/png,image/jpeg,image/webp,image/svg+xml" asset={assets.favicon} onChange={file => chooseAsset('favicon', file)} /></div><div className="wizard-actions"><button className="ghost" onClick={() => go(2)}><ArrowLeft size={16} /> Voltar</button><button className="primary" onClick={() => go(4)}>Revisar instituição →</button></div></>}
    {step === 4 && <><p className="eyebrow">ETAPA FINAL</p><h2 id="wizard-title">Confira antes de criar</h2><dl className="wizard-review"><dt>Instituição</dt><dd>{data.nome} · {data.full}</dd><dt>Cidade</dt><dd>{data.cidade}</dd><dt>Endereço</dt><dd>{domain}</dd><dt>Responsável</dt><dd>{data.admin} · {data.adminEmail}</dd><dt>Identidade visual</dt><dd>{Object.values(assets).map(asset => asset.file.name).join(' · ') || 'Identidade padrão do Facilita Estudos'}</dd></dl><p className="muted">A unidade começa vazia, sem cursos, alunos ou conteúdos de demonstração. Apenas a conta responsável será vinculada.</p><div className="wizard-actions"><button className="ghost" disabled={saving || !!createdTenant.current} onClick={() => go(3)}>← Voltar</button><button className="primary" disabled={saving} onClick={() => void create()}>{saving ? 'Criando…' : <><Check size={16} /> {createdTenant.current ? 'Tentar concluir identidade' : 'Criar instituição'}</>}</button></div></>}
  </section></div>;
};

const AssetInput: React.FC<{ label: string; accept: string; asset?: Asset; onChange: (file?: File) => void; video?: boolean }> = ({ label, accept, asset, onChange, video }) => <label className="asset-input"><span>{label}</span><input type="file" accept={accept} onChange={event => onChange(event.target.files?.[0])} />{asset ? <div className="asset-preview">{video && asset.file.type === 'video/mp4' ? <video src={asset.preview} muted controls playsInline /> : <img src={asset.preview} alt={`Prévia de ${label}`} />}<small>{asset.file.name}</small></div> : <div className="asset-empty"><Upload size={18} /><small>Escolher arquivo</small></div>}</label>;
