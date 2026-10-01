import React from 'react';
import { Search } from 'lucide-react';
import { WordMark } from './WordMark';

interface TopBarProps {
  courseName?: string;
  currentPage: string;
}

export const TopBar: React.FC<TopBarProps> = ({ courseName = 'Medicina', currentPage }) => {
  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 28px',
      borderBottom: '1px solid var(--line-2)',
      background: 'var(--paper)',
      marginBottom: '20px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--muted)' }}>
        <WordMark courseName={courseName} />
        <span>›</span>
        <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{currentPage}</span>
      </div>

      <div style={{ position: 'relative', width: '320px' }}>
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
        <input 
          type="text" 
          placeholder="Buscar aluno, aula, matéria..." 
          style={{
            paddingLeft: '36px',
            fontSize: '13px',
            borderRadius: '999px',
            background: 'var(--paper-2)',
            border: '1px solid var(--line)',
            height: '36px'
          }}
        />
      </div>
    </header>
  );
};
