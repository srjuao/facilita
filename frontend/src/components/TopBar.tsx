import React from 'react';
import { WordMark } from './WordMark';

interface TopBarProps {
  courseName?: string;
  currentPage: string;
}

export const TopBar: React.FC<TopBarProps> = ({ courseName, currentPage }) => {
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


    </header>
  );
};
