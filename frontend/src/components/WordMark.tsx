import React from 'react';

interface WordMarkProps {
  courseName?: string;
  extraClass?: string;
}

const COURSE_BRANDS: Record<string, { suf: string; joined?: boolean; color: string }> = {
  'Medicina': { suf: 'Med', joined: true, color: '#2A78D6' },
  'Odontologia': { suf: 'Odonto', color: '#1B8F5A' },
  'Enfermagem': { suf: 'Enf', color: '#1B8F5A' },
  'Direito': { suf: 'Direito', color: '#3949AB' },
  'Psicologia': { suf: 'Psico', color: '#8E24AA' },
  'Fisioterapia': { suf: 'Fisio', color: '#00897B' },
};

export const WordMark: React.FC<WordMarkProps> = ({ courseName, extraClass = '' }) => {
  const brand = courseName ? (COURSE_BRANDS[courseName] || { suf: courseName, color: '#2A78D6' }) : null;
  
  return (
    <span 
      className={`wm ${extraClass}`} 
      style={brand ? ({ '--brand': brand.color } as React.CSSProperties) : undefined}
    >
      Facilita
      {brand && (
        <span className={`suf ${brand.joined ? '' : 'sp'}`}>
          {brand.suf}
        </span>
      )}
    </span>
  );
};
