import React from 'react';

interface WordMarkProps {
  courseName?: string;
  extraClass?: string;
}

export const WordMark: React.FC<WordMarkProps> = ({ extraClass = '' }) => (
  <span className={`wm ${extraClass}`}>Facilita<span className="suf sp">Estudos</span></span>
);
