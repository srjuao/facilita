import React from 'react';
import { Award, Printer, X, ShieldCheck, QrCode } from 'lucide-react';
import { WordMark } from './WordMark';

interface CertificateModalProps {
  studentName: string;
  courseName: string;
  moduleName: string;
  tenantName: string;
  date?: string;
  onClose: () => void;
}

export const CertificateModal: React.FC<CertificateModalProps> = ({
  studentName,
  courseName,
  moduleName,
  tenantName,
  date = '19 de Setembro de 2026',
  onClose
}) => {
  const handlePrint = () => {
    window.print();
  };

  const certificateCode = `FAC-${Math.random().toString(36).substring(2, 8).toUpperCase()}-2026`;

  return (
    <div 
      className="cert-modal-backdrop"
      style={{ 
        position: 'fixed', 
        inset: 0, 
        background: 'rgba(11, 19, 36, 0.88)', 
        backdropFilter: 'blur(8px)', 
        display: 'grid', 
        placeItems: 'center', 
        zIndex: 2000, 
        padding: '20px',
        overflowY: 'auto'
      }}
    >
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .print-certificate-container, .print-certificate-container * {
            visibility: visible !important;
          }
          .print-certificate-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: 100% !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            padding: 20px !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Container Principal do Certificado */}
      <div style={{ position: 'relative', width: '920px', maxWidth: '98vw' }}>
        {/* Botão de Fechar no topo fora do certificado */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }} className="no-print">
          <button 
            onClick={onClose}
            style={{ 
              background: '#1e293b', 
              border: '1px solid #334155', 
              color: '#fff', 
              borderRadius: '50%', 
              width: '38px', 
              height: '38px', 
              display: 'grid', 
              placeItems: 'center', 
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div 
          className="print-certificate-container"
          style={{ 
            width: '100%', 
            background: '#0f172a', 
            borderRadius: '16px', 
            boxShadow: '0 30px 60px rgba(0,0,0,0.6)', 
            padding: '36px 48px',
            position: 'relative',
            border: '2px solid #2A78D6',
            color: '#f8fafc',
            overflow: 'hidden',
            boxSizing: 'border-box'
          }}
        >
          {/* FITA DIAGONAL GEOMÉTRICA TOPO-ESQUERDA (ESTILO IMAGE 1) */}
          <div 
            style={{ 
              position: 'absolute', 
              top: '-40px', 
              left: '-40px', 
              width: '120px', 
              height: '120px', 
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 45%, #2A78D6 100%)', 
              transform: 'rotate(-45deg)',
              boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
              zIndex: 2
            }} 
          />

          {/* FITA DIAGONAL GEOMÉTRICA BASE-DIREITA (ESTILO IMAGE 1) */}
          <div 
            style={{ 
              position: 'absolute', 
              bottom: '-40px', 
              right: '-40px', 
              width: '120px', 
              height: '120px', 
              background: 'linear-gradient(135deg, #2A78D6 0%, #f59e0b 60%, #d97706 100%)', 
              transform: 'rotate(-45deg)',
              boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
              zIndex: 2
            }} 
          />

          {/* MOLDURA DUPLA DOURADA / FACILITA (ESTILO LUXO DAS REFS) */}
          <div 
            style={{ 
              border: '2px solid #f59e0b', 
              borderRadius: '8px', 
              padding: '36px 32px 28px', 
              textAlign: 'center', 
              position: 'relative',
              background: 'radial-gradient(circle at center, rgba(42,120,214,0.08) 0%, rgba(15,23,42,0.95) 75%)',
              zIndex: 1
            }}
          >
            {/* TOPO: LOGO E QR CODE */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ textAlign: 'left' }}>
                <WordMark courseName={courseName} />
                <div style={{ fontSize: '11px', letterSpacing: '.14em', textTransform: 'uppercase', color: '#94a3b8', marginTop: '4px', fontWeight: 600 }}>
                  {tenantName}
                </div>
              </div>

              {/* QR Code de Autenticidade (Estilo Image 2) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(30, 41, 59, 0.7)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                <div style={{ background: '#fff', padding: '4px', borderRadius: '4px', display: 'grid', placeItems: 'center' }}>
                  <QrCode size={36} style={{ color: '#0f172a' }} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#f59e0b', fontWeight: 700, letterSpacing: '.06em' }}>
                    Autenticidade Verificada
                  </div>
                  <div style={{ fontSize: '11px', color: '#cbd5e1', fontFamily: 'monospace' }}>
                    {certificateCode}
                  </div>
                </div>
              </div>
            </div>

            {/* TÍTULO PRINCIPAL (ESTILO ELEGANTE DAS REFS) */}
            <h1 
              style={{ 
                fontFamily: "'Georgia', 'Playfair Display', serif", 
                fontSize: '38px', 
                color: '#ffffff', 
                letterSpacing: '0.08em', 
                margin: '10px 0 4px', 
                fontWeight: 700,
                textTransform: 'uppercase',
                textShadow: '0 2px 10px rgba(0,0,0,0.5)'
              }}
            >
              CERTIFICADO
            </h1>

            <div 
              style={{ 
                fontSize: '14px', 
                letterSpacing: '0.3em', 
                textTransform: 'uppercase', 
                color: '#f59e0b', 
                fontWeight: 700, 
                marginBottom: '24px' 
              }}
            >
              — DE CONCLUSÃO ACADÊMICA —
            </div>

            {/* SUBTÍTULO */}
            <div style={{ fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '12px', fontWeight: 600 }}>
              ESTE DIPLOMA É CONCEDIDO A
            </div>

            {/* NOME DO ALUNO (CURSIVO / SERIF ELEGANTE DAS REFS) */}
            <h2 
              style={{ 
                fontFamily: "'Playfair Display', 'Georgia', 'Dancing Script', serif", 
                fontSize: '42px', 
                color: '#2A78D6', 
                fontWeight: 700, 
                fontStyle: 'italic', 
                margin: '0 auto 20px', 
                paddingBottom: '8px',
                borderBottom: '1px solid rgba(245, 158, 11, 0.4)',
                display: 'inline-block',
                minWidth: '320px',
                textShadow: '0 2px 12px rgba(42,120,214,0.3)'
              }}
            >
              {studentName}
            </h2>

            {/* DESCRIÇÃO DO CURSO */}
            <p 
              style={{ 
                fontSize: '15px', 
                color: '#cbd5e1', 
                maxWidth: '680px', 
                margin: '0 auto 28px', 
                lineHeight: 1.7,
                fontFamily: 'sans-serif'
              }}
            >
              por concluir com êxito a matéria de <b style={{ color: '#ffffff' }}>{moduleName}</b> no curso de <b style={{ color: '#ffffff' }}>{courseName}</b> ministrado no <b style={{ color: '#ffffff' }}>{tenantName}</b>, cumprindo a carga horária total de <b style={{ color: '#f59e0b' }}>60 horas</b> e demonstrando dedicação e desempenho acadêmico exemplares.
            </p>

            {/* SELO METÁLICO E ASSINATURAS (LAYOUT EXATO DA IMAGE 1) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '24px', alignItems: 'flex-end', marginTop: '20px' }}>
              
              {/* ASSINATURA ESQUERDA (ALUNO / RECEBEDOR) */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '20px', fontWeight: 700, color: '#f8fafc', fontStyle: 'italic', marginBottom: '6px' }}>
                  {studentName}
                </div>
                <div style={{ width: '100%', height: '1px', background: 'rgba(245, 158, 11, 0.5)', marginBottom: '8px' }} />
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#f59e0b', fontWeight: 700 }}>
                  NOME
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Recebedor do certificado</div>
              </div>

              {/* MEDALHA METÁLICA CENTRAL COM FITAS (IMAGE 1 & 2) */}
              <div style={{ position: 'relative', margin: '0 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div 
                  style={{ 
                    width: '74px', 
                    height: '74px', 
                    borderRadius: '50%', 
                    background: 'radial-gradient(circle, #f59e0b 0%, #b45309 70%, #78350f 100%)', 
                    display: 'grid', 
                    placeItems: 'center', 
                    boxShadow: '0 6px 20px rgba(245, 158, 11, 0.4), inset 0 2px 4px rgba(255,255,255,0.6)',
                    border: '3px solid #2A78D6'
                  }}
                >
                  <div 
                    style={{ 
                      width: '58px', 
                      height: '58px', 
                      borderRadius: '50%', 
                      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', 
                      display: 'grid', 
                      placeItems: 'center',
                      border: '1px solid #f59e0b'
                    }}
                  >
                    <Award size={32} style={{ color: '#f59e0b' }} />
                  </div>
                </div>

                {/* FITAS DEPENDURADAS NA MEDALHA */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '-8px' }}>
                  <div style={{ width: '14px', height: '24px', background: 'linear-gradient(180deg, #f59e0b 0%, #2A78D6 100%)', transform: 'rotate(-12deg)', borderRadius: '0 0 4px 4px', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }} />
                  <div style={{ width: '14px', height: '24px', background: 'linear-gradient(180deg, #2A78D6 0%, #f59e0b 100%)', transform: 'rotate(12deg)', borderRadius: '0 0 4px 4px', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }} />
                </div>
              </div>

              {/* ASSINATURA DIREITA (DIRETOR / COORDENADOR) */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '20px', fontWeight: 700, color: '#f8fafc', fontStyle: 'italic', marginBottom: '6px' }}>
                  Prof. Dr. Sérgio Amaral
                </div>
                <div style={{ width: '100%', height: '1px', background: 'rgba(245, 158, 11, 0.5)', marginBottom: '8px' }} />
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#f59e0b', fontWeight: 700 }}>
                  NOME
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Diretor responsável · {tenantName}</div>
              </div>

            </div>

            {/* DATA DE EMISSÃO NO RODAPÉ */}
            <div style={{ marginTop: '24px', fontSize: '12px', color: '#64748b' }}>
              Emitido em <span style={{ color: '#cbd5e1' }}>{date}</span> · Registrado na plataforma FacilitaEstudos
            </div>
          </div>
        </div>

        {/* BOTÕES DE AÇÃO NO RODAPÉ DA MODAL (NÃO IMPRESSOS) */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginTop: '20px' }}>
          <button 
            className="btn primary" 
            onClick={handlePrint} 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 600,
              boxShadow: '0 4px 15px rgba(42, 120, 214, 0.4)'
            }}
          >
            <Printer size={18} /> Imprimir / Salvar Certificado PDF
          </button>
          <button 
            className="btn outline" 
            onClick={onClose}
            style={{ 
              padding: '12px 20px',
              color: '#f8fafc',
              borderColor: '#334155'
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
